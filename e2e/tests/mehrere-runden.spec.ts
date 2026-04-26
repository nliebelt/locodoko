import { expect, test, type Page } from '@playwright/test';

interface SpielZustand {
  phase: string | null;
  spieltyp: string | null;
  spielbareKarten: string[];
  moeglicheVorbehalte: string[];
  moeglicheAnsagen: string[];
  armutPhase: boolean;
}

async function leseSpielZustand(page: Page): Promise<SpielZustand> {
  await page.waitForFunction(() => {
    const loco = (window as any).__locodoko;
    if (typeof loco?.isIdle === 'function') return loco.isIdle() === true;
    return loco?.appStore?.isIdle() === true;
  }, { timeout: 15_000 });

  return page.evaluate((): SpielZustand => {
    const loco = (window as any).__locodoko;
    const spiel = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel;
    return {
      phase: spiel?.phase ?? null,
      spieltyp: spiel?.spieltyp ?? null,
      spielbareKarten: spiel?.spielbareKarten?.map((k: any) => k.id) ?? [],
      moeglicheVorbehalte: spiel?.moeglicheVorbehalte ?? [],
      moeglicheAnsagen: spiel?.moeglicheAnsagen ?? [],
      armutPhase: spiel?.phase === 'ARMUT_TAUSCH',
    };
  });
}

async function aktiviereTurbo(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as any).__locodoko?.setzeAnimationsGeschwindigkeit, { timeout: 15_000 });
  await page.evaluate(() => {
    const loco = (window as any).__locodoko;
    loco.setzeAnimationsGeschwindigkeit(Infinity);
  });
}

test.describe('Mehrere Runden gegen KI', () => {
  test('Zwei vollständige Runden ohne JS-Fehler spielen', async ({ page }) => {
    const jsFehler: string[] = [];
    page.on('pageerror', (err) => jsFehler.push(`[pageerror] ${err.message}`));

    await page.goto('/');
    await page.waitForFunction(() => (window as any).__locodoko?.appStore, { timeout: 20_000 });

    await page.evaluate(async () => {
      const loco = (window as any).__locodoko;
      await loco.appStore.alsGastStarten();
      await loco.appStore.erstelleQuickGame();
    });

    await expect(page.locator('[data-testid="tischszene"]')).toBeVisible({ timeout: 15_000 });
    await aktiviereTurbo(page);

    // Runden werden per Phasenwechsel gezählt: STICHPHASE → VORBEHALT_ANSAGE = 1 abgeschlossene Runde.
    // Der Backend startet neue Runden automatisch (kein manuelles Weiter-Klicken nötig).
    let abgeschlosseneRunden = 0;
    let warInStichphase = false;

    for (let i = 0; i < 1000 && abgeschlosseneRunden < 2; i++) {
      const weiterBtn = page.locator('[data-testid="btn-rundenauswertung-weiter"]');
      if (await weiterBtn.isVisible({ timeout: 200 }).catch(() => false)) {
        await weiterBtn.click();
        continue;
      }

      const zustand = await leseSpielZustand(page);

      if (warInStichphase && zustand.phase === 'VORBEHALT_ANSAGE') {
        abgeschlosseneRunden++;
        console.log(`Runde ${abgeschlosseneRunden} abgeschlossen.`);
        warInStichphase = false;
      }
      if (zustand.phase === 'STICHPHASE') warInStichphase = true;

      if (zustand.moeglicheVorbehalte.length > 0) {
        await page.evaluate((v) => (window as any).__locodoko.appStore.meldeVorbehalt(v), zustand.moeglicheVorbehalte[0]);
        continue;
      }

      if (zustand.armutPhase) {
        await page.evaluate(() => (window as any).__locodoko.appStore.beantworteArmut(false, []));
        continue;
      }

      if (zustand.phase === 'STICHPHASE' && zustand.spielbareKarten.length > 0) {
        if (zustand.moeglicheAnsagen.includes('KONTRA')) {
          await page.evaluate(() => (window as any).__locodoko.appStore.sageAnsageAn('KONTRA'));
        } else if (zustand.moeglicheAnsagen.includes('RE')) {
          await page.evaluate(() => (window as any).__locodoko.appStore.sageAnsageAn('RE'));
        }
        await page.evaluate((k) => (window as any).__locodoko.appStore.spieleKarte(k), zustand.spielbareKarten[0]);
        continue;
      }

      await page.waitForTimeout(100);
    }

    expect(abgeschlosseneRunden).toBeGreaterThanOrEqual(2);
    expect(jsFehler).toHaveLength(0);
  });
});
