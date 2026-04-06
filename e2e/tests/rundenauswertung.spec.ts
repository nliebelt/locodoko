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

    // Strategie: Warte auf "Overlay sichtbar" ODER "eigener Zug verfuegbar" mit grossem
    // Timeout (120s) fuer die gesamte Spielphase. Bei eigenem Zug: Enter druecken und
    // 3.5s warten (Kartenanimation + bis zu 3 KI-Karten a 800ms). Loop laeuft bis
    // Overlay erscheint oder max 15 Iterationen (mehr als genug fuer 12 Stiche).
    for (let versuch = 0; versuch < 15; versuch++) {
      if (await overlay.isVisible()) break;

      // Kombiniert warten: Overlay ODER eigener Zug.
      // Timeout 120s: fuer rein-KI-Stiche (3x 800ms + Overhead) reicht das sicher.
      const ereignis = await page.waitForFunction(
        (): string | null => {
          const el = document.querySelector('[data-testid="rundenauswertung-overlay"]') as HTMLElement | null;
          if (el && !el.hidden) return 'overlay';
          interface B { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: { spielbareKarten?: unknown[]; phase?: string } } } } }
          const loco = (window as unknown as Record<string, B>)['__locodoko'];
          const spiel = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel;
          if (spiel?.phase === 'STICHPHASE' && (spiel?.spielbareKarten?.length ?? 0) > 0) return 'zug';
          return null;
        },
        { timeout: 120_000 }
      ).then((h) => h.jsonValue() as Promise<string>).catch(() => 'timeout');

      if (ereignis === 'overlay' || ereignis === 'timeout') break;

      // Eigener Zug: Enter spielt die auto-ausgewaehlte Karte (tastaturKarteIndex = 0)
      await page.keyboard.press('Enter');
      // Pause fuer Kartenanimation (400ms Tween) + KI-Verarbeitung mit 800ms-Delays.
      // Mit bis zu 3 KI-Karten a 800ms benoetigen wir 2.4s KI-Zeit + Puffer.
      await page.waitForTimeout(3_500);
    }

    // ── 4. Rundenauswertungs-Overlay prüfen ──────────────────────────────────
    await expect(overlay).toBeVisible({ timeout: 30_000 });

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
