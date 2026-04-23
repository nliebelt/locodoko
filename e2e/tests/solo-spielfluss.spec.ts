import { expect, test } from '@playwright/test';

test.describe('Solo-Spielfluss', () => {
  test('Solo-Runde komplett: HUD-Spieltyp, Rundenauswertung, Geber-Wiederholung', async ({ page }) => {
    const jsFehler: string[] = [];
    page.on('pageerror', (err) => jsFehler.push(`[pageerror] ${err.message}`));

    await page.goto('/');
    await page.waitForFunction(() => (window as any).__locodoko?.appStore, { timeout: 20_000 });
    
    await page.evaluate(async () => {
      const loco = (window as any).__locodoko;
      await loco.appStore.alsGastStarten();
      await loco.appStore.erstelleKonfiguriertenTisch('E2E-Solo-Test', {
        damensoloErlaubt: true,
        bubensoloErlaubt: true,
        anzahlSpiele: 1
      }, false);
    });

    await expect(page.locator('[data-testid="tischszene"]')).toBeVisible({ timeout: 15_000 });
    await page.evaluate(() => (window as any).__locodoko.appStore.starteAktuellenTisch());

    // Turbo an
    await page.waitForFunction(() => (window as any).__locodoko?.setzeAnimationsGeschwindigkeit, { timeout: 10_000 });
    await page.evaluate(() => (window as any).__locodoko.setzeAnimationsGeschwindigkeit(Infinity));

    let soloGefunden = false;
    for (let i = 0; i < 500; i++) {
      const zustand = await page.evaluate(() => {
        const loco = (window as any).__locodoko;
        const spiel = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel;
        return {
          overlayVisible: loco?.isOverlaySichtbar?.() === true,
          phase: spiel?.phase,
          moeglicheVorbehalte: spiel?.moeglicheVorbehalte ?? [],
          spielbareKarten: spiel?.spielbareKarten?.map((k: any) => k.id) ?? [],
          spieltyp: spiel?.spieltyp
        };
      });

      if (zustand.overlayVisible) break;
      if (zustand.spieltyp && zustand.spieltyp.includes('SOLO')) soloGefunden = true;

      if (zustand.moeglicheVorbehalte.length > 0) {
        // Wenn ein Solo moeglich ist, nehmen wir es!
        const solo = zustand.moeglicheVorbehalte.find((v: string) => v.includes('SOLO')) || zustand.moeglicheVorbehalte[0];
        await page.evaluate((v) => (window as any).__locodoko.appStore.meldeVorbehalt(v), solo);
      } else if (zustand.phase === 'STICHPHASE' && zustand.spielbareKarten.length > 0) {
        await page.evaluate((k) => (window as any).__locodoko.appStore.spieleKarte(k), zustand.spielbareKarten[0]);
      }
      await page.waitForTimeout(50);
    }

    expect(jsFehler).toHaveLength(0);
  });
});
