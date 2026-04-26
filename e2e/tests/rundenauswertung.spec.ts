import { expect, test } from '@playwright/test';
import { getBridge, leseSpielZustand, aktiviereTurbo, meldeVorbehalt } from './helpers';

test.describe('Rundenauswertung', () => {
  test('Rundenauswertungs-Overlay erscheint nach Spielende und kann geschlossen werden', async ({ page }) => {
    const seitenFehler: string[] = [];
    page.on('pageerror', (err) => { seitenFehler.push(err.message); });

    await page.goto('/');
    await getBridge(page);

    await page.evaluate(async () => {
      const loco = (window as any).__locodoko;
      await loco.appStore.alsGastStarten();
      await loco.appStore.erstelleQuickGame();
    });

    await expect(page.locator('[data-testid="tischszene"]')).toBeVisible({ timeout: 15_000 });
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
        await page.evaluate(() => (window as any).__locodoko.appStore.beantworteArmut(false, []));
        continue;
      }

      if (zustand.spielbareKarten.length > 0) {
        await page.evaluate((k) => (window as any).__locodoko.appStore.spieleKarte(k), zustand.spielbareKarten[0]);
        continue;
      }

      await page.waitForTimeout(100);
    }

    expect(rundeAbgeschlossen, 'Mindestens eine Runde muss abgeschlossen sein').toBe(true);

    // Bridge-Counter: zeigeRundenEndeModal() wurde erfolgreich aufgerufen
    const modalGezeigt = await page.evaluate(() => (window as any).__locodoko?._rundenEndeModalGezeigt ?? 0);
    expect(modalGezeigt, 'Rundenauswertungs-Overlay muss nach Spielende angezeigt worden sein').toBeGreaterThan(0);

    expect(seitenFehler).toHaveLength(0);
  });
});
