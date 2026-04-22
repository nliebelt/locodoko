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
 * Voraussetzung: Backend läuft auf localhost:8081
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
  // Warten bis die Engine im Leerlauf ist (keine Animationen, keine Event-Queue)
  await page.waitForFunction(() => {
    const loco = (window as any).__locodoko;
    return loco?.appStore?.isIdle() === true;
  }, { timeout: 10000 }).catch(() => {
     // Timeout ignorieren, wir versuchen es trotzdem (vielleicht haengt die Bridge)
     console.log('E2E: isIdle-Timeout beim Lesen des Zustands.');
  });

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
    page.on('pageerror', (err) => {
        jsFehler.push(`[pageerror] ${err.message}`);
        console.log(`[BROWSER ERROR] ${err.message}`);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') jsFehler.push(`[console.error] ${msg.text()}`);
      // Alle Browser-Logs anzeigen für Debugging
      if (msg.text().includes('renderTisch')) return; // Zu viel Rauschen
      console.log(`[BROWSER ${msg.type()}] ${msg.text()}`);
    });

    // ── 1. Gast-Session starten & Quick Game triggern ────────────────────
    await page.goto('/');
    
    // Warten bis die Bridge bereit ist
    await page.waitForFunction(() => (window as any).__locodoko?.appStore, { timeout: 20_000 });
    
    // Als Gast anmelden
    await page.evaluate(() => (window as any).__locodoko.appStore.alsGastStarten());
    
    // Warten bis authentifiziert
    await page.waitForFunction(() => (window as any).__locodoko.appStore.snapshot().authentifiziert, { timeout: 10_000 });
    
    // Quick Game triggern
    await page.evaluate(() => (window as any).__locodoko.appStore.erstelleQuickGame());
    
    await expect(page.locator('[data-testid="tischszene"]')).toBeVisible({ timeout: 15_000 });

    // ── 2. Animationen beschleunigen ──────────────────────────────────────
    await setzeAnimationsGeschwindigkeit(page);

    // ── 3. Zwei Runden durchspielen ───────────────────────────────────────
    const weiterButton = page.locator('[data-testid="btn-rundenauswertung-weiter"]');

    let abgeschlosseneRunden = 0;
    let letztePhase = '';
    let letzteSpielNummer = 0;
    let letztesSpieltyp = '';

    for (let i = 0; i < 2000 && abgeschlosseneRunden < 2; i++) {
      const zustand = await leseSpielZustand(page).catch(() => null);
      if (!zustand) { await page.waitForTimeout(300); continue; }

      // Fortschritt loggen bei Änderungen
      if (zustand.phase !== letztePhase || zustand.spielNummer !== letzteSpielNummer || i % 100 === 0) {
        console.log(`[i=${i}] Runde ${abgeschlosseneRunden + 1}/2 | Spiel ${zustand.spielNummer} | Phase=${zustand.phase} | Vorbehalte=${zustand.moeglicheVorbehalte} | Karten=${zustand.spielbareKarten}`);
        letztePhase = zustand.phase ?? '';
        letzteSpielNummer = zustand.spielNummer;
      }
      // Sonderankündigung loggen
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
          await page.waitForTimeout(1000);
          await setzeAnimationsGeschwindigkeit(page).catch(() => {});
        }
        continue;
      }

      // Vorbehalt: immer GESUND (Taste 1)
      if (zustand.moeglicheVorbehalte > 0) {
        await page.keyboard.press('1');
        // Warten bis Zustand sich aendert
        await page.waitForFunction(() => {
          const loco = (window as any).__locodoko;
          const s = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel;
          return !s || s.moeglicheVorbehalte.length === 0 || s.phase !== 'VORBEHALT_ANSAGE';
        }, { timeout: 5000 }).catch(() => {});
        continue;
      }

      // Armut ablehnen
      if (zustand.armutPhase) {
        await page.keyboard.press('n');
        await page.waitForTimeout(500);
        continue;
      }

      // Karte spielen (und evtl. Ansagen)
      if (zustand.phase === 'STICHPHASE' && zustand.spielbareKarten > 0) {
        const kartenVorher = zustand.spielbareKarten;
        if (zustand.moeglicheAnsagen.includes('KONTRA')) await page.keyboard.press('k');
        else if (zustand.moeglicheAnsagen.includes('RE')) await page.keyboard.press('r');
        
        await page.keyboard.press('Enter');
        
        // Warten bis Karte weg ist oder nicht mehr am Zug
        await page.waitForFunction((alt) => {
          const loco = (window as any).__locodoko;
          const s = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel;
          if (!s) return true;
          return s.spielbareKarten.length < alt || s.aktuellerSpieler !== 'SUED';
        }, kartenVorher, { timeout: 5000 }).catch(() => {});
        continue;
      }

      // KI am Zug oder Übergang — kurz warten
      await page.waitForTimeout(200);
    }

    // ── 4. Assertions ─────────────────────────────────────────────────────

    expect(
      abgeschlosseneRunden,
      'Mindestens 2 Runden müssen vollständig abgeschlossen worden sein',
    ).toBeGreaterThanOrEqual(2);

    const zustandFinal = await leseSpielZustand(page);
    expect(zustandFinal.spielNummer).toBeGreaterThan(1);

    expect(
      jsFehler,
      `JavaScript-Fehler während der Partie:\n${jsFehler.join('\n')}`,
    ).toHaveLength(0);
  });
});
