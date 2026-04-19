/**
 * E2E-Test: Mehrere Runden gegen KI
 *
 * Spielt 2 vollständige Runden durch und prüft dabei die Bug-Fixes aus BF-13–15:
 * - BF-13: Letzte KI-Karte eines Stichs wird korrekt animiert (kein AppStore-Crash)
 * - BF-14: Sonderankündigungen (Solo etc.) erscheinen ohne Timing-Fehler
 * - BF-15: kein veralteter Stand nach möglichem Reconnect
 *
 * Ein JS-Fehler oder pageerror während des Spiels gilt als Testfehler —
 * denn genau diese Crashes traten vor den Fixes auf.
 *
 * Voraussetzung: Backend läuft auf localhost:8080
 *   cd e2e && npx playwright test mehrere-runden.spec.ts
 */

import { test, expect, type Page } from '@playwright/test';

// ── Bridge ────────────────────────────────────────────────────────────────

interface SpielZustand {
  overlayVisible: boolean;
  phase: string | null;
  spieltyp: string | null;
  spielbareKarten: number;
  moeglicheVorbehalte: number;
  moeglicheAnsagen: string[];
  armutPhase: boolean;
  spielNummer: number;
}

async function leseSpielZustand(page: Page): Promise<SpielZustand> {
  return page.evaluate((): SpielZustand => {
    const overlay = document.querySelector('[data-testid="rundenauswertung-overlay"]') as HTMLElement | null;
    type B = { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: {
      phase?: string; spieltyp?: string; spielbareKarten?: unknown[];
      moeglicheVorbehalte?: unknown[]; moeglicheAnsagen?: string[];
      spielNummer?: number;
    } } } } };
    const loco = (window as unknown as Record<string, B>)['__locodoko'];
    const spiel = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel;
    return {
      overlayVisible: !!overlay && !overlay.hidden,
      phase: spiel?.phase ?? null,
      spieltyp: spiel?.spieltyp ?? null,
      spielbareKarten: spiel?.spielbareKarten?.length ?? 0,
      moeglicheVorbehalte: spiel?.moeglicheVorbehalte?.length ?? 0,
      moeglicheAnsagen: spiel?.moeglicheAnsagen ?? [],
      armutPhase: spiel?.phase === 'ARMUT_TAUSCH',
      spielNummer: spiel?.spielNummer ?? 0,
    };
  });
}

async function setzeAnimationsGeschwindigkeit(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const b = (window as unknown as Record<string, Record<string, unknown>>)['__locodoko'];
    return typeof b?.['setzeAnimationsGeschwindigkeit'] === 'function';
  }, undefined, { timeout: 10_000 });
  await page.evaluate(() => {
    const b = (window as unknown as Record<string, Record<string, unknown>>)['__locodoko'];
    (b['setzeAnimationsGeschwindigkeit'] as (f: number) => void)(Infinity);
  });
}

// ── Test ──────────────────────────────────────────────────────────────────

test.describe('Mehrere Runden gegen KI', () => {
  test('Zwei vollständige Runden ohne JS-Fehler spielen', async ({ page }) => {
    test.setTimeout(600_000);

    const jsFehler: string[] = [];
    page.on('pageerror', (err) => jsFehler.push(`[pageerror] ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') jsFehler.push(`[console.error] ${msg.text()}`);
    });

    // ── 1. Quick Game starten ─────────────────────────────────────────────
    await page.goto('/');
    await expect(page.locator('button', { hasText: /Quick Game/i })).toBeVisible({ timeout: 20_000 });
    await page.locator('button', { hasText: /Quick Game/i }).click();
    await expect(page.locator('[data-testid="tischszene"]')).toBeVisible({ timeout: 15_000 });

    // ── 2. Animationen beschleunigen ──────────────────────────────────────
    await setzeAnimationsGeschwindigkeit(page);

    // ── 3. Zwei Runden durchspielen ───────────────────────────────────────
    // Pro Runde: Vorbehalte melden, Stiche spielen, Overlay bestätigen.
    // Nach 2 abgeschlossenen Runden bricht die Schleife ab.
    const overlay = page.locator('[data-testid="rundenauswertung-overlay"]');
    const weiterButton = page.locator('[data-testid="btn-rundenauswertung-weiter"]');

    let abgeschlosseneRunden = 0;
    let letztePhase = '';
    let letzteSpielNummer = 0;
    let letztesSpieltyp = '';

    for (let i = 0; i < 1200 && abgeschlosseneRunden < 2; i++) {
      const zustand = await leseSpielZustand(page).catch(() => null);
      if (!zustand) { await page.waitForTimeout(300); continue; }

      // Fortschritt loggen bei Änderungen
      if (zustand.phase !== letztePhase || zustand.spielNummer !== letzteSpielNummer) {
        console.log(`[i=${i}] Runde ${abgeschlosseneRunden + 1}/2 | Spiel ${zustand.spielNummer} | Phase=${zustand.phase} | Typ=${zustand.spieltyp}`);
        letztePhase = zustand.phase ?? '';
        letzteSpielNummer = zustand.spielNummer;
      }
      // Sonderankündigung loggen (BF-14)
      if (zustand.spieltyp && zustand.spieltyp !== 'NORMALSPIEL' && zustand.spieltyp !== letztesSpieltyp) {
        console.log(`[BF-14] Spieltyp-Ankündigung: ${zustand.spieltyp} in Spiel ${zustand.spielNummer}`);
        letztesSpieltyp = zustand.spieltyp;
      }

      // Rundenauswertungs-Overlay: bestätigen und weiter
      if (zustand.overlayVisible) {
        await expect(weiterButton).toBeVisible({ timeout: 5_000 });
        abgeschlosseneRunden++;
        console.log(`Runde ${abgeschlosseneRunden} abgeschlossen.`);
        if (abgeschlosseneRunden < 2) {
          await weiterButton.click();
          // Nach Klick: Animationsgeschwindigkeit für neue Runde neu setzen
          await page.waitForTimeout(500);
          await setzeAnimationsGeschwindigkeit(page).catch(() => { /* ignorieren falls Bridge kurz weg */ });
        }
        continue;
      }

      // Vorbehalt: immer GESUND (Taste 1)
      if (zustand.moeglicheVorbehalte > 0) {
        await page.keyboard.press('1');
        await page.waitForTimeout(200);
        continue;
      }

      // Armut ablehnen
      if (zustand.armutPhase) {
        await page.keyboard.press('n');
        await page.waitForTimeout(200);
        continue;
      }

      // Pflichtansagen (Re/Kontra bei 30-Augen-Schwelle)
      if (zustand.phase === 'STICHPHASE' && zustand.spielbareKarten > 0) {
        if (zustand.moeglicheAnsagen.includes('KONTRA')) await page.keyboard.press('k');
        else if (zustand.moeglicheAnsagen.includes('RE')) await page.keyboard.press('r');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(200);
        continue;
      }

      // KI am Zug oder Übergang — kurz warten
      await page.waitForTimeout(300);
    }

    // ── 4. Assertions ─────────────────────────────────────────────────────

    expect(
      abgeschlosseneRunden,
      'Mindestens 2 Runden müssen vollständig abgeschlossen worden sein',
    ).toBeGreaterThanOrEqual(2);

    // spielNummer muss nach 2 Runden > 1 sein (neues Spiel gestartet)
    const zustandFinal = await leseSpielZustand(page);
    expect(
      zustandFinal.spielNummer,
      'spielNummer muss nach 2 Runden größer als 1 sein',
    ).toBeGreaterThan(1);

    // Keine JS-Fehler — ein AppStore/Animation-Crash (wie vor BF-13–15) würde hier auftauchen
    expect(
      jsFehler,
      `JavaScript-Fehler während der Partie:\n${jsFehler.join('\n')}`,
    ).toHaveLength(0);
  });
});
