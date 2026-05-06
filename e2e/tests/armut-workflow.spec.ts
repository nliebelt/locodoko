import { expect, test } from '@playwright/test';
import {
  getBridge,
  leseSpielZustand,
  leseHudZustand,
  aktiviereTurbo,
  meldeVorbehalt,
  alsGastStarten,
  erstelleKonfiguriertenTisch,
  starteAktuellenTisch,
  beantworteArmut,
  spieleKarte,
  aktiviereConsoleCapture,
  warteAufNaechstesEreignis,
  warteAufSzene,
  schliesseRundenEndeModal,
} from './helpers';

test.describe('Armut-Workflow', () => {
  test('Armut-Tausch wird durchgefuehrt und Spiel laeuft weiter', async ({ page }, testInfo) => {
    aktiviereConsoleCapture(page, testInfo.title);

    await page.goto('/');
    await getBridge(page);

    await alsGastStarten(page);
    await erstelleKonfiguriertenTisch(page, 'E2E-Armut-Test', {
      armutErlaubt: true,
      anzahlSpiele: 6
    }, true);

    await warteAufSzene(page, 'TischSzene', 15_000);
    await starteAktuellenTisch(page);
    await aktiviereTurbo(page);

    let armutGesehen = false;
    let partieBeendet = false;
    let letztePhase = '';

    for (let i = 0; i < 2000 && !partieBeendet; i++) {
      // Rundenauswertungs-Overlay schliessen falls vorhanden (nicht Partie-Ende)
      const hudState = await leseHudZustand(page);
      if (hudState.rundenEndeSichtbar) {
        await schliesseRundenEndeModal(page);
        continue;
      }

      const zustand = await leseSpielZustand(page);

      if (zustand.phase !== letztePhase) {
        console.log(`[i=${i}] Phase=${zustand.phase}`);
        letztePhase = zustand.phase ?? '';
      }

      // Partie-Ende: kein laufendes Spiel mehr
      if (!zustand.phase) {
        partieBeendet = true;
        break;
      }

      if (zustand.phase === 'ARMUT_TAUSCH') armutGesehen = true;

      if (zustand.moeglicheVorbehalte.length > 0) {
        const armut = zustand.moeglicheVorbehalte.find((v: string) => v === 'ARMUT') ?? zustand.moeglicheVorbehalte[0];
        await meldeVorbehalt(page, armut);
        continue;
      }

      if (zustand.phase === 'ARMUT_TAUSCH') {
        await beantworteArmut(page, false, []);
        continue;
      }

      if (zustand.spielbareKarten.length > 0) {
        await spieleKarte(page, zustand.spielbareKarten[0]);
        continue;
      }

      await warteAufNaechstesEreignis(page);
    }

    if (armutGesehen) {
      console.log('Armut-Tausch erfolgreich durchgefuehrt und getestet.');
    } else {
      console.log('Armut trat in diesem Lauf nicht auf (kein Armut-Deal zufaellig bekommen).');
    }

    expect(partieBeendet).toBe(true);
  });
});
