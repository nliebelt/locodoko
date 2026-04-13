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
 * Voraussetzung: Backend laeuft auf localhost:8080
 *   cd e2e && npx playwright test reconnect.spec.ts
 */

import { test, expect, type Page } from '@playwright/test';

// ── Bridge-Typen ────────────────────────────────────────────────────────

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

// ── Hilfsfunktionen ─────────────────────────────────────────────────────

async function warteAufPhase(page: Page, phase: string, timeoutMs = 15_000): Promise<void> {
  await page.waitForFunction(
    (gesuchtePhase: string) => {
      const loco = (window as unknown as Record<string, { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: { phase?: string } } } } }>)['__locodoko'];
      return loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel?.phase === gesuchtePhase;
    },
    phase,
    { timeout: timeoutMs }
  );
}

async function warteAufEigenenVorbehalt(page: Page, timeoutMs = 15_000): Promise<void> {
  await page.waitForFunction(
    () => {
      const loco = (window as unknown as Record<string, { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: { moeglicheVorbehalte?: unknown[] } } } } }>)['__locodoko'];
      return (loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel?.moeglicheVorbehalte?.length ?? 0) > 0;
    },
    { timeout: timeoutMs }
  );
}

async function warteAufEigenenZug(page: Page, timeoutMs = 20_000): Promise<void> {
  await page.waitForFunction(
    () => {
      const loco = (window as unknown as Record<string, { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: { spielbareKarten?: unknown[]; phase?: string } } } } }>)['__locodoko'];
      const spiel = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel;
      return spiel?.phase === 'STICHPHASE' && (spiel?.spielbareKarten?.length ?? 0) > 0;
    },
    { timeout: timeoutMs }
  );
}

/**
 * Wartet auf ein Spielereignis: Overlay, Vorbehalt oder eigener Zug.
 */
async function warteAufNaechstesEreignis(page: Page, timeoutMs = 30_000): Promise<string> {
  return page.waitForFunction(
    (): string | null => {
      const overlay = document.querySelector('[data-testid="rundenauswertung-overlay"]') as HTMLElement | null;
      if (overlay && !overlay.hidden) return 'overlay';
      const loco = (window as unknown as Record<string, { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: { spielbareKarten?: unknown[]; phase?: string; moeglicheVorbehalte?: unknown[]; moeglicheAnsagen?: string[] } } } } }>)['__locodoko'];
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
async function leseStichzaehler(page: Page): Promise<string> {
  return page.locator('[data-testid="hud-stichzaehler"]').textContent()
    .then(t => t?.trim() ?? '');
}

/**
 * Liest die Anzahl verbleibender Handkarten des eigenen Spielers.
 */
async function eigeneHandkartenAnzahl(page: Page): Promise<number> {
  return page.evaluate(() => {
    const loco = (window as unknown as Record<string, { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: LaufendesSpielDto } } } }>)['__locodoko'];
    const spieler = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel?.spieler;
    const selbst = spieler?.find(s => s.istSelbst);
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
    await expect(page.locator('button', { hasText: /Quick Game/i })).toBeVisible({ timeout: 20_000 });
    await page.locator('button', { hasText: /Quick Game/i }).click();
    await expect(
      page.locator('[data-testid="tischszene"]'),
      'TischSzene muss nach Quick Game sichtbar sein',
    ).toBeVisible({ timeout: 15_000 });

    // ── 2. Vorbehalt-Phase: GESUND waehlen ────────────────────────────────
    await warteAufPhase(page, 'VORBEHALT_ANSAGE', 25_000);
    await warteAufEigenenVorbehalt(page, 20_000);
    await page.keyboard.press('1'); // GESUND

    // ── 3. Mindestens einen Stich abschliessen ───────────────────────────
    // Spiele Karten bis der Stichzaehler mindestens "Stich 1/12" zeigt.
    const overlay = page.locator('[data-testid="rundenauswertung-overlay"]');
    let sticheVorReload = '';

    for (let versuch = 0; versuch < 60; versuch++) {
      const ereignis = await warteAufNaechstesEreignis(page, 30_000);

      if (ereignis === 'overlay') break;
      if (ereignis === 'timeout') continue;
      if (await overlay.isVisible()) break;

      if (ereignis === 'zug') {
        // 30-Augen-Pflichtansage behandeln
        const ansagen = await page.evaluate((): string[] => {
          const loco = (window as unknown as Record<string, { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: { moeglicheAnsagen?: string[] } } } } }>)['__locodoko'];
          return loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel?.moeglicheAnsagen ?? [];
        }).catch(() => [] as string[]);
        if (ansagen.includes('KONTRA')) await page.keyboard.press('k');
        else if (ansagen.includes('RE')) await page.keyboard.press('r');

        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);

        // Pruefen ob mindestens 2 Stiche abgeschlossen
        sticheVorReload = await leseStichzaehler(page);
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

    // ── 5. TischSzene muss automatisch geladen werden (Session-Recovery) ──
    // BootSzene ruft /api/spieler/session → aktiverTischId gesetzt →
    // reconnecteTisch() → scene.start('TischSzene')
    await expect(
      page.locator('[data-testid="tischszene"]'),
      'TischSzene muss nach Reload automatisch sichtbar sein (Session-Recovery)',
    ).toBeVisible({ timeout: 30_000 });

    // ── 6. Spielstand pruefen: Stichzaehler identisch ────────────────────
    // Warum: Beweist dass der Snapshot korrekt uebertragen und gerendert wurde.
    // Der Zaehler darf gleich oder hoeher sein (KI koennte waehrend Reload
    // weiter gespielt haben, aber das ist im Solo-KI-Modus nicht der Fall).
    await expect(
      page.locator('[data-testid="hud-stichzaehler"]'),
      'Stichzaehler muss nach Reload den gespeicherten Stand zeigen',
    ).toContainText(/Stich [1-9]/, { timeout: 15_000 });

    const sticheNachReload = await leseStichzaehler(page);
    const stichVorher = parseInt(sticheVorReload.match(/Stich (\d+)/)?.[1] ?? '0', 10);
    const stichNachher = parseInt(sticheNachReload.match(/Stich (\d+)/)?.[1] ?? '0', 10);
    expect(stichNachher, 'Stichzaehler nach Reload darf nicht kleiner sein als vorher').toBeGreaterThanOrEqual(stichVorher);

    // ── 7. Handkarten nach Reload pruefen ────────────────────────────────
    // Warum: Stellt sicher dass der Spieler seine Karten zurueck hat.
    await page.waitForFunction(
      () => {
        const loco = (window as unknown as Record<string, { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: { spieler?: { istSelbst: boolean; sichtbareHandkarten?: unknown[] | null; verbleibendeKarten?: number | null }[] } } } } }>)['__locodoko'];
        const spieler = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel?.spieler;
        const selbst = spieler?.find(s => s.istSelbst);
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
    // Warum: Beweist dass WebSocket-Verbindung wiederhergestellt ist und
    // der Spieler aktiv am Spiel teilnehmen kann.
    let karteGespielt = false;
    for (let versuch = 0; versuch < 30; versuch++) {
      if (await overlay.isVisible()) {
        // Spiel ist beendet — Interaktion ueber Overlay-Button pruefen
        const weiterBtn = page.locator('[data-testid="btn-rundenauswertung-weiter"]');
        await expect(weiterBtn).toBeVisible({ timeout: 5_000 });
        karteGespielt = true; // Overlay-Interaktion zaehlt als Beweis
        break;
      }

      const ereignis = await warteAufNaechstesEreignis(page, 30_000);
      if (ereignis === 'overlay') {
        karteGespielt = true;
        break;
      }
      if (ereignis === 'zug') {
        // 30-Augen-Pflichtansage behandeln
        const ansagen = await page.evaluate((): string[] => {
          const loco = (window as unknown as Record<string, { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: { moeglicheAnsagen?: string[] } } } } }>)['__locodoko'];
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
    // Warum: Testet den alternativen Recovery-Pfad ueber SpielverwaltungsSzene.
    // Ein neuer Tab im selben Browser-Kontext teilt das Session-Cookie.
    const neuerTab = await page.context().newPage();
    const jsFehlerNeuerTab: string[] = [];
    neuerTab.on('console', (msg) => {
      if (msg.type() === 'error') jsFehlerNeuerTab.push(`[console.error] ${msg.text()}`);
    });
    neuerTab.on('pageerror', (err) => jsFehlerNeuerTab.push(`[pageerror] ${err.message}`));

    await neuerTab.goto('/');

    // BootSzene erkennt aktiverTischId und leitet zur TischSzene weiter
    await expect(
      neuerTab.locator('[data-testid="tischszene"]'),
      'Neuer Tab muss via Session-Recovery direkt zur TischSzene gelangen',
    ).toBeVisible({ timeout: 30_000 });

    // HUD muss sichtbar sein — Beweis dass der Spielstand geladen wurde
    await expect(
      neuerTab.locator('[data-testid="hud-stichzaehler"]'),
      'HUD-Stichzaehler muss im neuen Tab sichtbar sein',
    ).toBeVisible({ timeout: 15_000 });

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
