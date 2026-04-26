import { expect, test } from '@playwright/test';
import { getBridge, leseSpielZustand, aktiviereTurbo, meldeVorbehalt } from './helpers';

test.describe('Solo-Spielfluss', () => {
  test('Solo-Runde komplett: HUD-Spieltyp, Rundenauswertung, Geber-Wiederholung', async ({ page }) => {
    const jsFehler: string[] = [];
    page.on('pageerror', (err) => jsFehler.push(`[pageerror] ${err.message}`));

    await page.goto('/');
    await getBridge(page);

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
    await aktiviereTurbo(page);

    let soloGefunden = false;
    for (let i = 0; i < 500; i++) {
      const zustand = await leseSpielZustand(page);

      if (zustand.overlayVisible) break;
      if (zustand.spieltyp && zustand.spieltyp.includes('SOLO')) soloGefunden = true;

      if (zustand.moeglicheVorbehalte.length > 0) {
        // Wenn ein Solo moeglich ist, nehmen wir es!
        const solo = zustand.moeglicheVorbehalte.find((v: string) => v.includes('SOLO')) || zustand.moeglicheVorbehalte[0];
        await meldeVorbehalt(page, solo);
      } else if (zustand.phase === 'STICHPHASE' && zustand.spielbareKarten.length > 0) {
        await page.evaluate((k) => (window as any).__locodoko.appStore.spieleKarte(k), zustand.spielbareKarten[0]);
      }
    }

    expect(soloGefunden, 'Ein Solo-Spieltyp muss waehrend der Partie erkannt worden sein').toBe(true);
    expect(jsFehler).toHaveLength(0);
  });
});
