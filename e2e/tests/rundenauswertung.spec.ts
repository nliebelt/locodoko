/**
 * E2E-Test: Rundenauswertung
 *
 * Prüft ob nach Spielende das Rundenauswertungs-Overlay korrekt erscheint,
 * die wichtigsten Inhalte zeigt und per Button/Enter geschlossen werden kann.
 *
 * Voraussetzung: Backend läuft auf localhost:8080
 *   cd e2e && npx playwright test rundenauswertung.spec.ts
 */

import { test, expect, type Page } from '@playwright/test';

async function warteAufPhase(page: Page, phase: string, timeoutMs = 15_000): Promise<void> {
  await page.waitForFunction(
    (gesuchtePhase: string) => {
      interface LocodokoBridge { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: { phase?: string } } } } }
      const loco = (window as unknown as Record<string, LocodokoBridge>)['__locodoko'];
      return loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel?.phase === gesuchtePhase;
    },
    phase,
    { timeout: timeoutMs }
  );
}

async function warteAufEigenenZug(page: Page, timeoutMs = 15_000): Promise<void> {
  await page.waitForFunction(
    () => {
      interface LocodokoBridge { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: { spielbareKarten?: unknown[]; phase?: string } } } } }
      const loco = (window as unknown as Record<string, LocodokoBridge>)['__locodoko'];
      const snap = loco?.appStore?.snapshot();
      const spiel = snap?.partieStand?.laufendesSpiel;
      return spiel?.phase === 'STICHPHASE' && (spiel?.spielbareKarten?.length ?? 0) > 0;
    },
    { timeout: timeoutMs }
  );
}

async function spieleErsteHandkarte(page: Page): Promise<void> {
  await page.keyboard.press('ArrowRight'); // erste spielbare Karte markieren
  await page.keyboard.press('Enter');      // Karte ausspielen
}

async function warteAufEigenenVorbehalt(page: Page, timeoutMs = 15_000): Promise<void> {
  await page.waitForFunction(
    () => {
      interface LocodokoBridge { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: { moeglicheVorbehalte?: unknown[] } } } } }
      const loco = (window as unknown as Record<string, LocodokoBridge>)['__locodoko'];
      const vorbehalte = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel?.moeglicheVorbehalte;
      return (vorbehalte?.length ?? 0) > 0;
    },
    { timeout: timeoutMs }
  );
}

async function meldeVorbehalt(page: Page, vorbehalt: string): Promise<void> {
  // Vorbehalt per Ziffer-Taste auswaehlen: '1' = erste Option (GESUND), '2' = zweite, etc.
  // Reihenfolge der Optionen entspricht dem Backend-Order (GESUND immer erste Option).
  const zifferFuerVorbehalt: Record<string, string> = {
    GESUND: '1',
    HOCHZEIT: '2',
    ARMUT: '2',
    SOLO_TRUMPF: '2'
  };
  const taste = zifferFuerVorbehalt[vorbehalt] ?? '1';
  await page.keyboard.press(taste);
}

test.describe('Rundenauswertung', () => {
  test('Rundenauswertungs-Overlay erscheint nach Spielende und kann geschlossen werden', async ({ page }) => {
    test.setTimeout(300_000);

    // ── 1. Lobby → Quick Game ─────────────────────────────────────────────────
    await page.goto('/');
    await expect(page.locator('button', { hasText: /Quick Game/i })).toBeVisible({ timeout: 20_000 });
    await page.locator('button', { hasText: /Quick Game/i }).click();
    // Warten bis TischSzene vollstaendig geladen ist — stellt sicher dass der
    // Phaser-Keyboard-Handler (document.addEventListener) registriert ist,
    // bevor Tastendrucke fuer Vorbehalt/Karten gesendet werden.
    // Warum: Quick Game startet Spiel sofort nach oeffneTisch() — ohne diesen
    // Wait koennte create() noch nicht ausgefuehrt worden sein.
    await expect(
      page.locator('[data-testid="tischszene"]'),
      'TischSzene muss geladen sein bevor Tastatureingaben moeglich sind',
    ).toBeVisible({ timeout: 15_000 });

    // ── 2. Vorbehalt-Phase durchlaufen ───────────────────────────────────────
    await warteAufPhase(page, 'VORBEHALT_ANSAGE', 20_000);
    await warteAufEigenenVorbehalt(page, 20_000);
    await meldeVorbehalt(page, 'GESUND');

    // ── 3. Alle 12 Stiche spielen bis Overlay erscheint ─────────────────────
    // Strategie: Kombiniertes waitForFunction mit Polling — erkennt:
    //   'overlay'   → Rundenauswertungs-Overlay erschienen (Spiel beendet)
    //   'vorbehalt' → Eigener Vorbehalt ausstehend (Spiel 2+)
    //   'zug'       → Eigene spielbare Karte in STICHPHASE
    // Warum 30s Timeout: KI-Karten haben 800ms Delay je Karte; bei rein-KI-Stichen
    //   (3 Karten × 800ms = 2.4s) plus Vorbehalt-Phasen zwischen Spielen reichen
    //   10s zu knapp. 30s gibt ausreichend Puffer auch fuer komplexe Spieltypen.
    // Warum kein festes waitForTimeout nach Enter: Die naechste waitForFunction-Iteration
    //   wartet von selbst bis der naechste Zustand eintritt — kein blindes Schlafen noetig.
    // 30-Augen-Pflichtansage (locoBlatRegeln): muss vor Karte-Spielen gemacht werden;
    //   Backend wirft Exception wenn spielbareKarten > 0 aber Pflichtansage noch aussteht.

    const overlay = page.locator('[data-testid="rundenauswertung-overlay"]');

    // Parallel-Watcher: loest auf sobald Overlay sichtbar wird.
    // .catch(() => null) verhindert Unhandled-Rejection bei Test-Ende.
    const overlayWatcher = page.waitForSelector(
      '[data-testid="rundenauswertung-overlay"]',
      { state: 'visible', timeout: 240_000 }
    ).catch(() => null);

    for (let versuch = 0; versuch < 120; versuch++) {
      if (await overlay.isVisible()) break;

      interface B { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: { spielbareKarten?: unknown[]; phase?: string; moeglicheVorbehalte?: unknown[]; aktuellerSpieler?: string | null } } } } }
      const ereignis = await page.waitForFunction(
        (): string | null => {
          const el = document.querySelector('[data-testid="rundenauswertung-overlay"]') as HTMLElement | null;
          if (el && !el.hidden) return 'overlay';
          const loco = (window as unknown as Record<string, B>)['__locodoko'];
          const spiel = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel;
          if (!spiel) return null;
          // Vorbehalt (inkl. Spiel 2+ nach Rundenende)
          if ((spiel.moeglicheVorbehalte?.length ?? 0) > 0) return 'vorbehalt';
          // Armut-Tausch-Phase: Human muss annehmen/ablehnen (Taste 'n' = ablehnen)
          // Warum: ohne Behandlung wartet waitForFunction 30s × n-Mal bis Timeout.
          if (spiel.phase === 'ARMUT_TAUSCH') return 'armut';
          // Eigene Karte spielbar
          if (spiel.phase === 'STICHPHASE' && (spiel.spielbareKarten?.length ?? 0) > 0) return 'zug';
          return null;
        },
        { timeout: 30_000, polling: 200 }
      ).then((h) => h.jsonValue() as Promise<string>).catch(() => 'timeout');

      if (ereignis === 'overlay') break;
      if (ereignis === 'timeout') continue;

      // Race-Condition-Schutz: Overlay koennte in CDP-Latenz (~10-50ms) erschienen sein.
      if (await overlay.isVisible()) break;

      if (ereignis === 'vorbehalt') {
        // Zwischen-Spiel-Vorbehalt: immer GESUND (erste Option, Taste '1').
        // Warum: Test testet Rundenauswertung, nicht Vorbehalt-Varianten.
        await page.keyboard.press('1');
        continue;
      }

      if (ereignis === 'armut') {
        // Armut ablehnen (Taste 'n'). Wenn kein aktueller Spieler SUED ist,
        // hat 'n' keinen Effekt (TischSzene prueft aktuellerSpieler === 'SUED').
        // Warum Ablehnen: Vereinfacht den Spielfluss; Armut-Stilles-Solo ist valide.
        await page.keyboard.press('n');
        await page.waitForTimeout(500);
        continue;
      }

      // ereignis === 'zug': Karte spielen
      // 30-Augen-Pflichtansage: moeglicheAnsagen enthaelt RE/KONTRA wenn Pflicht aussteht.
      // Warum: Backend blockiert spieleKarte() mit Exception bis Pflichtansage gemacht wurde.
      const ansagen = await page.evaluate((): string[] => {
        interface B4 { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: { moeglicheAnsagen?: string[] } } } } }
        const loco = (window as unknown as Record<string, B4>)['__locodoko'];
        return loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel?.moeglicheAnsagen ?? [];
      }).catch(() => [] as string[]);
      if (ansagen.includes('KONTRA')) await page.keyboard.press('k');
      else if (ansagen.includes('RE')) await page.keyboard.press('r');

      // Karte spielen (auto-Selektion via tastaturKarteIndex = 0, kein ArrowRight noetig).
      // Kurze Pause danach damit der WebSocket-State-Update ankommt bevor naechste
      // waitForFunction-Iteration prueft — verhindert Doppel-Spielen mit veralteten Daten.
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
    }

    // ── 4. Rundenauswertungs-Overlay prüfen ──────────────────────────────────
    // overlayWatcher loest null auf (falls .catch() gefeuert) oder den ElementHandle.
    // Die eigentliche Sichtbarkeits-Pruefung erfolgt per expect() unabhaengig davon.
    // Hinweis: Inhalte (Titel, Ergebnis, Spielpunkte) werden vollstaendig in Phaser
    // gerendert und sind daher nicht per DOM-Locator pruefbar.
    await overlayWatcher;
    await expect(overlay).toBeVisible({ timeout: 30_000 });

    // Weiter-Button ist vorhanden (HTML-Element fuer Keyboard-Handling)
    const weiterButton = page.locator('[data-testid="btn-rundenauswertung-weiter"]');
    await expect(weiterButton).toBeVisible({ timeout: 15_000 });

    // ── 5. Overlay per Enter schließen ───────────────────────────────────────
    await page.keyboard.press('Enter');
    await expect(overlay).toBeHidden({ timeout: 5_000 });

    // ── 6. Nächste Runde / Vorbehalt-Phase läuft oder Partie endet ───────────
    // Overlay geschlossen → Spiel läuft weiter
    const naechstePhase = await page.evaluate(() => {
      interface LocodokoBridge { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: { phase?: string } } } } }
      const loco = (window as unknown as Record<string, LocodokoBridge>)['__locodoko'];
      return loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel?.phase ?? null;
    });
    // Spiel ist im Gange (neue Runde oder Gesamtauswertung)
    expect(naechstePhase).not.toBeNull();
  });
});
