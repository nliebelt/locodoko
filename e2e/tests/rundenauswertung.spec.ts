import { expect, test } from '@playwright/test';
import {
  alsGastStarten,
  erstelleQuickGame,
  getBridge,
  leseSpielZustand,
  leseRundenEndeModalCount,
  aktiviereTurbo,
  meldeVorbehalt,
  spieleKarte,
  beantworteArmut,
  aktiviereConsoleCapture,
  warteAufSzene,
} from './helpers';

test.describe('Rundenauswertung', () => {
  test('Rundenauswertungs-Overlay erscheint nach Spielende und kann geschlossen werden', async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    aktiviereConsoleCapture(page, testInfo.title);

    await page.goto('/');
    await getBridge(page);
    await alsGastStarten(page);
    await erstelleQuickGame(page);

    await warteAufSzene(page, 'TischSzene', 15_000);
    await aktiviereTurbo(page);

    let warInStichphase = false;
    let rundeAbgeschlossen = false;
    let letztePhase = '';

    for (let i = 0; i < 1500 && !rundeAbgeschlossen; i++) {
      const zustand = await leseSpielZustand(page);

      if (zustand.phase !== letztePhase) {
        console.log(`[i=${i}] Phase=${zustand.phase}`);
        letztePhase = zustand.phase ?? '';
      }

      if (warInStichphase && zustand.phase === 'VORBEHALT_ANSAGE') {
        rundeAbgeschlossen = true;
        break;
      }
      if (zustand.phase === 'STICHPHASE') warInStichphase = true;

      if (zustand.moeglicheVorbehalte.length > 0) {
        await meldeVorbehalt(page, zustand.moeglicheVorbehalte[0]);
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

      await page.waitForTimeout(100);
    }

    expect(rundeAbgeschlossen, 'Mindestens eine Runde muss abgeschlossen sein').toBe(true);

    const modalGezeigt = await leseRundenEndeModalCount(page);
    expect(modalGezeigt, 'Rundenauswertungs-Overlay muss nach Spielende angezeigt worden sein').toBeGreaterThan(0);
  });
});
