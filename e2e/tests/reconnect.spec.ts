/**
 * E2E-Test: Reconnect nach Tab-Reload
 *
 * Testet dass ein Spieler nach Tab-Reload (Session-Recovery) zurueck ins
 * laufende Spiel gelangt und der Spielstand korrekt wiederhergestellt wird.
 *
 * Warum dieser Test wichtig ist: Verbindungsabbrueche sind im Multiplayer
 * unvermeidlich. Ohne funktionierende Session-Recovery verliert der Spieler
 * seinen Platz und blockiert die gesamte Runde. Der Test stellt sicher, dass
 * BootSzene den aktiverTischId erkennt, automatisch zur TischSzene weiterleitet,
 * den WebSocket neu aufbaut und den Spielstand via Snapshot wiederherstellt.
 *
 * Voraussetzung: Backend laeuft auf localhost:8081
 *   cd e2e && npx playwright test reconnect.spec.ts
 */

import { test, expect, type Page } from '@playwright/test';
import { getBridge, warteAufPhase, warteAufEigenenVorbehalt, warteAufEigenenZug, warteAufSzene, leseHudZustand } from './helpers';

// ── Reconnect-spezifische Typen ──────────────────────────────────────────

interface LaufendesSpielDto {
  phase: string;
  spieltyp: string;
  spielbareKarten: { id: string }[];
  moeglicheVorbehalte: string[];
  moeglicheAnsagen: string[];
  aktuellerSpieler: string | null;
  stiche: unknown[];
  spieler: {
    istSelbst: boolean;
    verbleibendeKarten: number | null;
    sichtbareHandkarten: { id: string }[] | null;
  }[];
}

/**
 * Wartet auf ein Spielereignis: Overlay, Vorbehalt oder eigener Zug.
 */
async function warteAufNaechstesEreignisLocal(page: Page, timeoutMs = 30_000): Promise<string> {
  return page.waitForFunction(
    (): string | null => {
      const loco = (window as any)['__locodoko'];
      const hud = loco?.getHudState?.();
      if (hud?.rundenEndeSichtbar) return 'overlay';
      const spiel = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel;
      if (!spiel) return null;
      if ((spiel.moeglicheVorbehalte?.length ?? 0) > 0) return 'vorbehalt';
      if (spiel.phase === 'STICHPHASE' && (spiel.spielbareKarten?.length ?? 0) > 0) return 'zug';
      return null;
    },
    { timeout: timeoutMs, polling: 200 }
  ).then(h => h.jsonValue() as Promise<string>).catch(() => 'timeout');
}

/**
 * Liest den aktuellen Stichzaehler-Text aus dem HUD.
 */
async function leseStichzaehlerLocal(page: Page): Promise<string> {
  const hud = await leseHudZustand(page);
  return hud.stichzaehler;
}

/**
 * Liest die Anzahl verbleibender Handkarten des eigenen Spielers.
 */
async function eigeneHandkartenAnzahl(page: Page): Promise<number> {
  return page.evaluate(() => {
    const loco = (window as any)['__locodoko'];
    const spieler = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel?.spieler;
    const selbst = spieler?.find((s: any) => s.istSelbst);
    return selbst?.sichtbareHandkarten?.length ?? selbst?.verbleibendeKarten ?? -1;
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────

test.describe('Reconnect', () => {
  test('Tab-Reload stellt Spielstand wieder her und Spiel bleibt interaktiv', async ({ page }) => {
    test.setTimeout(300_000);

    // JavaScript-Fehler sammeln
    const jsFehler: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') jsFehler.push(`[console.error] ${msg.text()}`);
    });
    page.on('pageerror', (err) => jsFehler.push(`[pageerror] ${err.message}`));

    // ── 1. Quick Game starten ─────────────────────────────────────────────
    await page.goto('/');
    await getBridge(page);

    // Als Gast starten und Quick Game triggern
    await page.evaluate(async () => {
      const loco = (window as any).__locodoko;
      await loco.appStore.alsGastStarten();
      await loco.appStore.erstelleQuickGame();
    });

    await warteAufSzene(page, 'TischSzene', 25_000);

    // ── 2. Vorbehalt-Phase: GESUND waehlen ────────────────────────────────
    await warteAufPhase(page, 'VORBEHALT_ANSAGE', 25_000);
    await warteAufEigenenVorbehalt(page, 20_000);
    await page.keyboard.press('1'); // GESUND

    // ── 3. Mindestens einen Stich abschliessen ───────────────────────────
    // Spiele Karten bis der Stichzaehler mindestens "Stich 1/12" zeigt.
    let sticheVorReload = '';

    for (let versuch = 0; versuch < 60; versuch++) {
      const ereignis = await warteAufNaechstesEreignisLocal(page, 30_000);

      if (ereignis === 'overlay') break;
      if (ereignis === 'timeout') continue;

      if (ereignis === 'zug') {
        // 30-Augen-Pflichtansage behandeln
        const ansagen = await page.evaluate((): string[] => {
          const loco = (window as any)['__locodoko'];
          return loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel?.moeglicheAnsagen ?? [];
        }).catch(() => [] as string[]);
        if (ansagen.includes('KONTRA')) await page.keyboard.press('k');
        else if (ansagen.includes('RE')) await page.keyboard.press('r');

        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);

        // Pruefen ob mindestens 2 Stiche abgeschlossen
        sticheVorReload = await leseStichzaehlerLocal(page);
        const stichMatch = sticheVorReload.match(/Stich (\d+)/);
        if (stichMatch && parseInt(stichMatch[1], 10) >= 2) {
          break;
        }
      }
    }

    // Sicherstellen dass wir mindestens einen Stich gespielt haben
    expect(sticheVorReload, 'Stichzaehler muss vor Reload mindestens 1 Stich zeigen').toMatch(/Stich [1-9]/);

    // Handkarten-Anzahl vor Reload merken
    const handkartenVorReload = await eigeneHandkartenAnzahl(page);
    expect(handkartenVorReload, 'Spieler muss vor Reload Handkarten haben').toBeGreaterThan(0);

    // ── 4. Tab-Reload: Seite neu laden ───────────────────────────────────
    // Warum: Simuliert Tab-Schliessung und Neuoeffnung. Session-Cookie bleibt
    // im selben Browser-Kontext erhalten. BootSzene erkennt aktiverTischId
    // und leitet automatisch zur TischSzene weiter.
    jsFehler.length = 0; // JS-Fehler zuruecksetzen fuer Reconnect-Phase
    await page.reload();
    await getBridge(page);

    // ── 5. TischSzene muss automatisch geladen werden (Session-Recovery) ──
    await warteAufSzene(page, 'TischSzene', 30_000);

    // ── 6. Spielstand pruefen: Stichzaehler identisch ────────────────────
    await expect.poll(async () => {
      const hud = await leseHudZustand(page);
      return hud.stichzaehler;
    }, { timeout: 15_000 }).toContain(/Stich [1-9]/);

    const sticheNachReload = await leseStichzaehlerLocal(page);
    const stichVorher = parseInt(sticheVorReload.match(/Stich (\d+)/)?.[1] ?? '0', 10);
    const stichNachher = parseInt(sticheNachReload.match(/Stich (\d+)/)?.[1] ?? '0', 10);
    expect(stichNachher, 'Stichzaehler nach Reload darf nicht kleiner sein als vorher').toBeGreaterThanOrEqual(stichVorher);

    // ── 7. Handkarten nach Reload pruefen ────────────────────────────────
    await page.waitForFunction(
      () => {
        const loco = (window as any)['__locodoko'];
        const spieler = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel?.spieler;
        const selbst = spieler?.find((s: any) => s.istSelbst);
        const anzahl = selbst?.sichtbareHandkarten?.length ?? selbst?.verbleibendeKarten ?? 0;
        return anzahl > 0;
      },
      { timeout: 15_000 }
    );
    const handkartenNachReload = await eigeneHandkartenAnzahl(page);
    expect(handkartenNachReload, 'Handkarten nach Reload muessen vorhanden sein').toBeGreaterThan(0);
    // Handkarten duerfen gleich oder weniger sein (KI koennte gespielt haben)
    expect(handkartenNachReload, 'Handkarten nach Reload duerfen nicht mehr sein als vorher').toBeLessThanOrEqual(handkartenVorReload);

    // ── 8. Interaktivitaet: Weitere Karte spielen ────────────────────────
    let karteGespielt = false;
    for (let versuch = 0; versuch < 30; versuch++) {
      const hud = await leseHudZustand(page);
      if (hud.rundenEndeSichtbar) {
        karteGespielt = true; // Overlay-Interaktion zaehlt als Beweis
        break;
      }

      const ereignis = await warteAufNaechstesEreignisLocal(page, 30_000);
      if (ereignis === 'overlay') {
        karteGespielt = true;
        break;
      }
      if (ereignis === 'zug') {
        // 30-Augen-Pflichtansage behandeln
        const ansagen = await page.evaluate((): string[] => {
          const loco = (window as any)['__locodoko'];
          return loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel?.moeglicheAnsagen ?? [];
        }).catch(() => [] as string[]);
        if (ansagen.includes('KONTRA')) await page.keyboard.press('k');
        else if (ansagen.includes('RE')) await page.keyboard.press('r');

        await page.keyboard.press('Enter');
        karteGespielt = true;
        break;
      }
      if (ereignis === 'vorbehalt') {
        // Neues Spiel hat begonnen — Session-Recovery hat funktioniert
        karteGespielt = true;
        break;
      }
    }

    expect(karteGespielt, 'Nach Reconnect muss der Spieler interagieren koennen').toBe(true);

    // ── 9. Neuer Tab: Session-Recovery-Button testen ─────────────────────
    const neuerTab = await page.context().newPage();
    const jsFehlerNeuerTab: string[] = [];
    neuerTab.on('console', (msg) => {
      if (msg.type() === 'error') jsFehlerNeuerTab.push(`[console.error] ${msg.text()}`);
    });
    neuerTab.on('pageerror', (err) => jsFehlerNeuerTab.push(`[pageerror] ${err.message}`));

    await neuerTab.goto('/');
    await getBridge(neuerTab);

    // BootSzene erkennt aktiverTischId und leitet zur TischSzene weiter
    await warteAufSzene(neuerTab, 'TischSzene', 30_000);

    // HUD muss sichtbar sein — Beweis dass der Spielstand geladen wurde
    await expect.poll(async () => {
      const hud = await leseHudZustand(neuerTab);
      return hud.stichzaehler;
    }, { timeout: 15_000 }).toContain(/Stich [1-9]/);

    await neuerTab.close();

    // ── Abschlusskontrolle: Keine JavaScript-Fehler ──────────────────────
    expect(
      jsFehler,
      `JavaScript-Fehler nach Reload:\n${jsFehler.join('\n')}`,
    ).toHaveLength(0);
    expect(
      jsFehlerNeuerTab,
      `JavaScript-Fehler im neuen Tab:\n${jsFehlerNeuerTab.join('\n')}`,
    ).toHaveLength(0);
  });
});
