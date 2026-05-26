import { expect, test } from '@playwright/test';
import { getBridge, leseSpielZustand, aktiviereTurbo, meldeVorbehalt, spieleKarte, warteAufSzene, leseHudZustand, schliesseRundenEndeModal } from './helpers';

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

    await warteAufSzene(page, 'TischSzene', 15_000);
    await aktiviereTurbo(page);

    // Runden werden per Phasenwechsel gezählt: STICHPHASE → VORBEHALT_ANSAGE = 1 abgeschlossene Runde.
    // Der Backend startet neue Runden automatisch (kein manuelles Weiter-Klicken nötig).
    let abgeschlosseneRunden = 0;
    let warInStichphase = false;

    for (let i = 0; i < 1000 && abgeschlosseneRunden < 2; i++) {
      const hudState = await leseHudZustand(page);
      if (hudState.rundenEndeSichtbar) {
        await schliesseRundenEndeModal(page);
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
          await page.locator('canvas').focus();
          await page.keyboard.press('k');
        } else if (zustand.moeglicheAnsagen.includes('RE')) {
          await page.locator('canvas').focus();
          await page.keyboard.press('r');
        }
        await spieleKarte(page);
        continue;
      }

      await page.waitForTimeout(100);
    }

    expect(abgeschlosseneRunden).toBeGreaterThanOrEqual(2);
    expect(jsFehler).toHaveLength(0);
  });
});
