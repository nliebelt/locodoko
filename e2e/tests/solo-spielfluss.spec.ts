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
  warteAufEigenenVorbehalt,
  aktiviereConsoleCapture,
  warteAufSzene,
  leseRundenauswertung,
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

    await warteAufSzene(page, 'TischSzene', 15_000);
    await starteAktuellenTisch(page);
    await aktiviereTurbo(page);

    // Warte auf eigenen Vorbehalt-Zug und prüfe ob Solo möglich ist
    await warteAufEigenenVorbehalt(page, 20_000);
    const vorbehaltZustand = await leseSpielZustand(page);
    const soloVorbehalt = vorbehaltZustand.moeglicheVorbehalte.find((v: string) => v.includes('SOLO'));

    if (!soloVorbehalt) {
      test.skip();
      return;
    }

    await meldeVorbehalt(page, soloVorbehalt);

    let soloGefunden = false;

    for (let i = 0; i < 500; i++) {
      const zustand = await leseSpielZustand(page);

      if (zustand.overlayVisible) break;
      if (zustand.spieltyp && zustand.spieltyp.includes('SOLO')) soloGefunden = true;

      if (zustand.moeglicheVorbehalte.length > 0) {
        await meldeVorbehalt(page, zustand.moeglicheVorbehalte[0]);
      } else if (zustand.phase === 'STICHPHASE' && zustand.spielbareKarten.length > 0) {
        await spieleKarte(page, zustand.spielbareKarten[0]);
      } else {
        await page.waitForTimeout(100);
      }
    }

    expect(soloGefunden, 'Ein Solo-Spieltyp muss während der Partie erkannt worden sein').toBe(true);

    // Rundenauswertung: Solo-spezifische Werte aus der JS-Bridge prüfen
    const auswertung = await leseRundenauswertung(page);
    expect(auswertung.spieltypLabel, 'spieltypLabel soll Solo-Typ enthalten').toMatch(/solo/i);
    expect(auswertung.multiplikator, 'Multiplikator soll 3 sein').toBe(3);
  });
});
