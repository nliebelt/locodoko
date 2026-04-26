import { expect, test } from '@playwright/test';
import { getBridge, leseSpielZustand, aktiviereTurbo, meldeVorbehalt } from './helpers';

test.describe('Mehrere Runden gegen KI', () => {
  test('Zwei vollständige Runden ohne JS-Fehler spielen', async ({ page }) => {
    const jsFehler: string[] = [];
    page.on('pageerror', (err) => jsFehler.push(`[pageerror] ${err.message}`));

    await page.goto('/');
    await getBridge(page);

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
        await meldeVorbehalt(page, zustand.moeglicheVorbehalte[0]);
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
