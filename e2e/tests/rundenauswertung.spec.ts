/**
 * E2E-Test: Rundenauswertung
 *
 * Prüft ob nach Spielende das Rundenauswertungs-Overlay korrekt erscheint,
 * die wichtigsten Inhalte zeigt und per Button geschlossen werden kann.
 *
 * Voraussetzung: Backend läuft auf localhost:8080
 *   cd e2e && npx playwright test rundenauswertung.spec.ts
 */

import { test, expect, type Page } from '@playwright/test';

// Liest Spielzustand aus dem AppStore — ein einzelnes page.evaluate pro Iteration
interface SpielZustand {
  overlayVisible: boolean;
  phase: string | null;
  spielbareKarten: number;
  moeglicheVorbehalte: number;
  moeglicheAnsagen: string[];
  spielNummer: number;
}
async function leseSpielZustand(page: Page): Promise<SpielZustand> {
  return page.evaluate((): SpielZustand => {
    const el = document.querySelector('[data-testid="rundenauswertung-overlay"]') as HTMLElement | null;
    const overlayVisible = !!el && !el.hidden;

    interface B { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: {
      spielbareKarten?: unknown[]; phase?: string; moeglicheVorbehalte?: unknown[];
      moeglicheAnsagen?: string[]; spielNummer?: number;
    } } } } }
    const loco = (window as unknown as Record<string, B>)['__locodoko'];
    const spiel = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel;
    return {
      overlayVisible,
      phase: spiel?.phase ?? null,
      spielbareKarten: spiel?.spielbareKarten?.length ?? 0,
      moeglicheVorbehalte: spiel?.moeglicheVorbehalte?.length ?? 0,
      moeglicheAnsagen: spiel?.moeglicheAnsagen ?? [],
      spielNummer: spiel?.spielNummer ?? 0,
    };
  });
}

test.describe('Rundenauswertung', () => {
  test('Rundenauswertungs-Overlay erscheint nach Spielende und kann geschlossen werden', async ({ page }) => {
    test.setTimeout(360_000);

    // JS-Fehler abfangen damit wir sehen ob die Animationskette abstuerzt
    const seitenFehler: string[] = [];
    page.on('pageerror', (err) => { seitenFehler.push(err.message); });

    // ── 1. Lobby → Quick Game ─────────────────────────────────────────────────
    await page.goto('/');
    await expect(page.locator('button', { hasText: /Quick Game/i })).toBeVisible({ timeout: 20_000 });
    await page.locator('button', { hasText: /Quick Game/i }).click();
    await expect(
      page.locator('[data-testid="tischszene"]'),
      'TischSzene muss geladen sein bevor Tastatureingaben moeglich sind',
    ).toBeVisible({ timeout: 15_000 });

    // ── 2. E2E-Bridge konfigurieren ───────────────────────────────────────────
    // geschwindigkeitsfaktor=Infinity: alle Tweens/Flipper/Warte sofort aufgeloest.
    // reduziereRendering: Phaser-GameLoop von RAF(60fps) auf setTimeout(2fps),
    // verhindert dass Firefox den Tab nach ~2.5min Canvas2D-Rendering killt.
    await page.evaluate(() => {
      const bridge = (window as Record<string, Record<string, unknown>>)['__locodoko'];
      if (typeof bridge?.['setzeAnimationsGeschwindigkeit'] === 'function') {
        (bridge['setzeAnimationsGeschwindigkeit'] as (f: number) => void)(Infinity);
      }
      if (typeof bridge?.['reduziereRendering'] === 'function') {
        (bridge['reduziereRendering'] as () => void)();
      }
    });

    // ── 3. Spiel durchspielen ─────────────────────────────────────────────────
    // Einfache Polling-Schleife: alle 500ms Zustand pruefen.
    // Spielt durch beliebig viele Spiele bis das Overlay erscheint.
    const overlay = page.locator('[data-testid="rundenauswertung-overlay"]');
    let overlayGefunden = false;

    for (let i = 0; i < 600; i++) {       // 600 × 500ms = 300s Budget
      const zustand = await leseSpielZustand(page).catch(() => null);
      if (!zustand) { await page.waitForTimeout(500); continue; }

      if (zustand.overlayVisible) { overlayGefunden = true; break; }

      if (zustand.moeglicheVorbehalte > 0) {
        await page.keyboard.press('1'); // GESUND
        await page.waitForTimeout(200);
        continue;
      }
      if (zustand.phase === 'ARMUT_TAUSCH') {
        await page.keyboard.press('n');
        await page.waitForTimeout(300);
        continue;
      }
      if (zustand.phase === 'STICHPHASE' && zustand.spielbareKarten > 0) {
        // Pflichtansage pruefen
        if (zustand.moeglicheAnsagen.includes('KONTRA')) await page.keyboard.press('k');
        else if (zustand.moeglicheAnsagen.includes('RE')) await page.keyboard.press('r');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(200);
        continue;
      }
      // Warten (KI am Zug oder Uebergang zwischen Spielen)
      await page.waitForTimeout(500);
    }

    // ── 4. Overlay muss sichtbar sein ─────────────────────────────────────────
    if (!overlayGefunden) {
      // Debug-Info sammeln bevor der Assertion fehlschlaegt
      const debugInfo = await page.evaluate(() => {
        const el = document.querySelector('[data-testid="rundenauswertung-overlay"]') as HTMLElement | null;
        interface B { appStore: { snapshot: () => Record<string, unknown> } }
        const loco = (window as unknown as Record<string, B>)['__locodoko'];
        const snap = loco?.appStore?.snapshot();
        const ps = snap?.['partieStand'] as Record<string, unknown> | undefined;
        const ls = ps?.['laufendesSpiel'] as Record<string, unknown> | undefined;
        return {
          overlayExists: !!el,
          overlayHidden: el?.hidden,
          overlayChildCount: el?.childElementCount ?? 0,
          spielPhase: ls?.['phase'],
          spielNummer: ls?.['spielNummer'],
          hatErgebnis: !!ps?.['letztesSpielergebnis'],
        };
      }).catch(() => ({ error: 'evaluate failed' }));
      console.log('DEBUG overlay nicht gefunden:', JSON.stringify(debugInfo));
      console.log('JS-Fehler:', seitenFehler.join('; ') || 'keine');
    }
    await expect(overlay).toBeVisible({ timeout: 30_000 });

    // ── 5. Overlay pruefen ────────────────────────────────────────────────────
    const weiterButton = page.locator('[data-testid="btn-rundenauswertung-weiter"]');
    await expect(weiterButton).toBeVisible({ timeout: 10_000 });

    // ── 6. Overlay per Button-Klick schliessen ────────────────────────────────
    await weiterButton.click();
    await expect(overlay).toBeHidden({ timeout: 5_000 });

    // ── 7. Spiel laeuft weiter ───────────────────────────────────────────────
    const naechstePhase = await page.evaluate(() => {
      interface LocodokoBridge { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: { phase?: string } } } } }
      const loco = (window as unknown as Record<string, LocodokoBridge>)['__locodoko'];
      return loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel?.phase ?? null;
    });
    expect(naechstePhase).not.toBeNull();
  });
});
