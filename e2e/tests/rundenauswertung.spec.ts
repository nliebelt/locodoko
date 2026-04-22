/**
 * E2E-Test: Rundenauswertung
 *
 * Prüft ob nach Spielende das Rundenauswertungs-Overlay korrekt erscheint,
 * die wichtigsten Inhalte zeigt und per Button geschlossen werden kann.
 *
 * Voraussetzung: Backend läuft auf localhost:8081
 *   cd e2e && npx playwright test rundenauswertung.spec.ts
 */

import { test, expect, type Page } from '@playwright/test';
import { join } from 'path';

// Liest Spielzustand aus dem AppStore — ein einzelnes page.evaluate pro Iteration
interface SpielZustand {
  overlayVisible: boolean;
  phase: string | null;
  spielbareKarten: number;
  moeglicheVorbehalte: number;
  spielNummer: number;
}
async function leseSpielZustand(page: Page): Promise<SpielZustand> {
  await page.waitForFunction(() => {
    const loco = (window as any).__locodoko;
    return loco?.appStore?.isIdle() === true;
  }, { timeout: 10000 }).catch(() => {});

  return page.evaluate((): SpielZustand => {
    const el = document.querySelector('[data-testid="rundenauswertung-overlay"]') as HTMLElement | null;
    const overlayVisible = !!el && !el.hidden;

    interface B { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: {
      spielbareKarten?: unknown[]; phase?: string; moeglicheVorbehalte?: unknown[];
      spielNummer?: number;
    } } } } }
    const loco = (window as unknown as Record<string, B>)['__locodoko'];
    const spiel = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel;
    return {
      overlayVisible,
      phase: spiel?.phase ?? null,
      spielbareKarten: spiel?.spielbareKarten?.length ?? 0,
      moeglicheVorbehalte: spiel?.moeglicheVorbehalte?.length ?? 0,
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
    // reduziereRendering wird NICHT verwendet — bei 60fps funktioniert die
    // Tastatursteuerung zuverlaessiger, und das Spiel endet in unter 90s
    // (weit unter der 2.5-Minuten-Grenze fuer Firefox-Tab-Kills).
    await page.waitForFunction(() => {
      const b = (window as unknown as Record<string, Record<string, unknown>>)['__locodoko'];
      return typeof b?.['setzeAnimationsGeschwindigkeit'] === 'function';
    }, undefined, { timeout: 10_000 });
    await page.evaluate(() => {
      const bridge = (window as unknown as Record<string, Record<string, unknown>>)['__locodoko'];
      (bridge['setzeAnimationsGeschwindigkeit'] as (f: number) => void)(Infinity);
    });

    // ── 3. Spiel durchspielen ─────────────────────────────────────────────────
    // Polling-Schleife: Zustand pruefen, eigene Karte spielen wenn am Zug,
    // Vorbehalt als GESUND melden, Armut ablehnen. Laeuft bis Overlay erscheint.
    const overlay = page.locator('[data-testid="rundenauswertung-overlay"]');
    let overlayGefunden = false;
    let letztePhase = '';
    let letztesSpiel = 0;

    for (let i = 0; i < 600; i++) {
      const zustand = await leseSpielZustand(page).catch(() => null);
      if (!zustand) { await page.waitForTimeout(500); continue; }

      // Fortschritt loggen bei Phase/Spiel-Wechsel
      if (zustand.phase !== letztePhase || zustand.spielNummer !== letztesSpiel) {
        console.log(`[${i}] Spiel ${zustand.spielNummer} Phase=${zustand.phase} Karten=${zustand.spielbareKarten} Vorbehalte=${zustand.moeglicheVorbehalte}`);
        letztePhase = zustand.phase ?? '';
        letztesSpiel = zustand.spielNummer;
      }

      if (zustand.overlayVisible) { overlayGefunden = true; break; }

      if (zustand.moeglicheVorbehalte > 0) {
        await page.keyboard.press('1'); // GESUND
        await page.waitForTimeout(300);
        continue;
      }
      if (zustand.phase === 'ARMUT_TAUSCH') {
        await page.keyboard.press('n');
        await page.waitForTimeout(300);
        continue;
      }
      if (zustand.phase === 'STICHPHASE' && zustand.spielbareKarten > 0) {
        await page.keyboard.press('Enter');
        await page.waitForTimeout(300);
        continue;
      }
      // KI am Zug oder Phase-Uebergang
      await page.waitForTimeout(500);
    }

    // ── 4. Overlay muss sichtbar sein ─────────────────────────────────────────
    // Wir erhöhen das Timeout auf 60s, um dem neuen Event-Batching-Delay (600ms pro Event)
    // und der sequenziellen Verarbeitung im Store genügend Puffer zu geben.
    await expect(overlay).toBeVisible({ timeout: 60_000 });

    // ── 5. Screenshot fuer visuelles Review (Vision Loop 10.6) ───────────────
    await page.screenshot({ path: join(__dirname, '..', 'screenshots', '09-rundenauswertung-overlay.png') });

    // ── 6. Overlay pruefen ────────────────────────────────────────────────────
    const weiterButton = page.locator('[data-testid="btn-rundenauswertung-weiter"]');
    await expect(weiterButton).toBeVisible({ timeout: 10_000 });

    // ── 7. Overlay per Button-Klick schliessen ────────────────────────────────
    await weiterButton.click();
    await expect(overlay).toBeHidden({ timeout: 5_000 });

    // ── 8. Spiel laeuft weiter ───────────────────────────────────────────────
    const naechstePhase = await page.evaluate(() => {
      interface LocodokoBridge { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: { phase?: string } } } } }
      const loco = (window as unknown as Record<string, LocodokoBridge>)['__locodoko'];
      return loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel?.phase ?? null;
    });
    expect(naechstePhase).not.toBeNull();
  });
});
