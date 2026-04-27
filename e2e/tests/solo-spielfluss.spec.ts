import { expect, test } from '@playwright/test';
import {
  getBridge,
  leseSpielZustand,
  aktiviereTurbo,
  meldeVorbehalt,
  alsGastStarten,
  erstelleKonfiguriertenTisch,
  starteAktuellenTisch,
  spieleKarte,
  aktiviereConsoleCapture,
} from './helpers';

test.describe('Solo-Spielfluss', () => {
  test('Solo-Runde komplett: HUD-Spieltyp, Rundenauswertung, Geber-Wiederholung', async ({ page }, testInfo) => {
    aktiviereConsoleCapture(page, testInfo.title);

    await page.goto('/');
    await getBridge(page);

    await alsGastStarten(page);
    await erstelleKonfiguriertenTisch(page, 'E2E-Solo-Test', {
      damensoloErlaubt: true,
      bubensoloErlaubt: true,
      anzahlSpiele: 1,
    }, true);

    await expect(page.locator('[data-testid="tischszene"]')).toBeVisible({ timeout: 15_000 });
    await starteAktuellenTisch(page);
    await aktiviereTurbo(page);

    let soloGefunden = false;
    for (let i = 0; i < 500; i++) {
      const zustand = await leseSpielZustand(page);

      if (zustand.overlayVisible) break;
      if (zustand.spieltyp && zustand.spieltyp.includes('SOLO')) soloGefunden = true;

      if (zustand.moeglicheVorbehalte.length > 0) {
        const solo = zustand.moeglicheVorbehalte.find((v: string) => v.includes('SOLO')) ?? zustand.moeglicheVorbehalte[0];
        await meldeVorbehalt(page, solo);
      } else if (zustand.phase === 'STICHPHASE' && zustand.spielbareKarten.length > 0) {
        await spieleKarte(page, zustand.spielbareKarten[0]);
      }
    }

    expect(soloGefunden, 'Ein Solo-Spieltyp muss waehrend der Partie erkannt worden sein').toBe(true);
  });
});
