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
    // Strategie: Kombiniertes waitForFunction — wartet auf "Overlay sichtbar"
    // ODER "eigener Zug" (spielbareKarten > 0 in STICHPHASE). Bei eigenem Zug
    // wird Enter gedrueckt (auto-Selektion setzt tastaturKarteIndex = 0).
    // Warum dieser Ansatz: Einfacher Poll-Loop fuehrt bei schnellen Uebergaengen
    // zu verpassten Zuegen oder falschen Spieler-Zuordnungen.

    const overlay = page.locator('[data-testid="rundenauswertung-overlay"]');

    // MutationObserver-basierter Watcher: erkennt Overlay-Erscheinen sofort (nicht Polling).
    // Wird parallel zum Karten-Loop gestartet — loest auf sobald hidden=false gesetzt wird,
    // auch wenn das Overlay millisekunden spaeter wieder geschlossen wird (Race-Schutz).
    const overlayWatcher = page.waitForSelector(
      '[data-testid="rundenauswertung-overlay"]',
      { state: 'visible', timeout: 240_000 }
    );

    // Strategie: Kombiniertes waitForFunction mit kurzem Polling-Intervall.
    // Wartet auf "Overlay sichtbar" ODER "eigener Zug" (STICHPHASE + spielbareKarten > 0).
    // polling: 200ms — erkennt Zustandsaenderungen schnell (nicht erst nach mehreren Sekunden).
    // timeout: 4s — bei rein-KI-Stichen (kein eigener Zug, kein Overlay) laeuft der Timeout
    //   nach 4s ab statt nach 30s; die naechste Iteration pollt erneut. So entstehen keine
    //   langen Blockaden, wenn die KI mehrere Karten in Folge spielt (3 KI x 800ms = 2,4s).
    // Limit 60: Mit 4s Timeout pro KI-Stich und bis zu 12 Stichen 48s Puffer, plus eigene
    //   Zuege — bleibt weit unter dem aeusseren 300s-Timeout.
    for (let versuch = 0; versuch < 60; versuch++) {
      if (await overlay.isVisible()) break;

      interface B { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: { spielbareKarten?: unknown[]; phase?: string } } } } }
      const ereignis = await page.waitForFunction(
        (): string | null => {
          const el = document.querySelector('[data-testid="rundenauswertung-overlay"]') as HTMLElement | null;
          if (el && !el.hidden) return 'overlay';
          const loco = (window as unknown as Record<string, B>)['__locodoko'];
          const spiel = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel;
          if (spiel?.phase === 'STICHPHASE' && (spiel?.spielbareKarten?.length ?? 0) > 0) return 'zug';
          return null;
        },
        { timeout: 4_000, polling: 200 }
      ).then((h) => h.jsonValue() as Promise<string>).catch(() => 'timeout');

      // Debug: Spielzustand bei Timeout loggen
      if (ereignis === 'timeout') {
        const dbgState = await page.evaluate(() => {
          interface B2 { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: { spielbareKarten?: unknown[]; phase?: string } } } } }
          const loco = (window as unknown as Record<string, B2>)['__locodoko'];
          const spiel = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel;
          const el = document.querySelector('[data-testid="rundenauswertung-overlay"]') as HTMLElement | null;
          return {
            phase: spiel?.phase ?? 'n/a',
            karten: spiel?.spielbareKarten?.length ?? -1,
            overlayHidden: el?.hidden,
          };
        }).catch(() => ({ phase: 'error', karten: -1, overlayHidden: undefined }));
        console.log(`[rundenauswertung] TIMEOUT state: phase=${dbgState.phase} karten=${dbgState.karten} overlayHidden=${String(dbgState.overlayHidden)}`);
      }

      console.log(`[rundenauswertung] versuch=${versuch} ereignis=${ereignis}`);

      // Overlay: Schleife beenden.
      // Timeout: NICHT abbrechen — KI koennte kurz geblockt haben; naechste Iteration versucht es erneut.
      if (ereignis === 'overlay') break;
      if (ereignis === 'timeout') continue;

      // Race-Condition-Schutz: Overlay koennte zwischen waitForFunction-Rueckgabe und
      // dem Enter-Tastendruck erschienen sein (CDP-Latenz ~10-50ms). Ein zweiter Check
      // verhindert dass Enter das Overlay schliesst statt eine Karte zu spielen.
      if (await overlay.isVisible()) break;

      // Eigener Zug: Enter spielt die auto-ausgewaehlte Karte (tastaturKarteIndex = 0)
      await page.keyboard.press('Enter');
      // Pause fuer Kartenanimation (400ms Tween) + KI-Verarbeitung mit 800ms-Delays.
      // Mit bis zu 3 KI-Karten a 800ms benoetigen wir 2.4s KI-Zeit + Puffer.
      await page.waitForTimeout(3_500);
    }

    // ── 4. Rundenauswertungs-Overlay prüfen ──────────────────────────────────
    // overlayWatcher (MutationObserver) hat das Erscheinen bereits registriert
    // oder wartet noch darauf. Zuverlässiger als nur expect().toBeVisible().
    await overlayWatcher;
    await expect(overlay).toBeVisible({ timeout: 10_000 });

    // Kopfzeile: enthält Spieltyp und Spielnummer
    const titel = overlay.locator('h2');
    await expect(titel).toBeVisible();
    const titelText = await titel.textContent();
    expect(titelText).toMatch(/Spiel \d+ von \d+/);

    // Ergebnis-Zeile: enthält gewinnende Partei
    const ergebnisZeile = overlay.locator('strong').first();
    await expect(ergebnisZeile).toBeVisible();
    const ergebnisText = await ergebnisZeile.textContent();
    expect(ergebnisText).toMatch(/(RE|KONTRA) gewinnt/);

    // Weiter-Button ist vorhanden
    const weiterButton = page.locator('[data-testid="btn-rundenauswertung-weiter"]');
    await expect(weiterButton).toBeVisible();

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
