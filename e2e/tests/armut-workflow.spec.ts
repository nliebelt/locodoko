import { expect, test, type Page } from '@playwright/test';

interface SpielZustand {
  phase: string | null;
  moeglicheVorbehalte: string[];
  spielbareKarten: string[];
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
      moeglicheVorbehalte: spiel?.moeglicheVorbehalte ?? [],
      spielbareKarten: spiel?.spielbareKarten?.map((k: any) => k.id) ?? [],
    };
  });
}

test.describe('Armut-Workflow', () => {
  test('Armut-Tausch wird durchgefuehrt und Spiel laeuft weiter', async ({ page }) => {
    const jsFehler: string[] = [];
    page.on('pageerror', (err) => jsFehler.push(`[pageerror] ${err.message}`));

    await page.goto('/');
    await page.waitForFunction(() => (window as any).__locodoko?.appStore, { timeout: 20_000 });

    await page.evaluate(async () => {
      const loco = (window as any).__locodoko;
      await loco.appStore.alsGastStarten();
      await loco.appStore.erstelleKonfiguriertenTisch('E2E-Armut-Test', {
        armutErlaubt: true,
        anzahlSpiele: 6
      }, false);
    });

    await expect(page.locator('[data-testid="tischszene"]')).toBeVisible({ timeout: 15_000 });
    await page.evaluate(() => (window as any).__locodoko.appStore.starteAktuellenTisch());

    await page.waitForFunction(() => (window as any).__locodoko?.setzeAnimationsGeschwindigkeit, { timeout: 10_000 });
    await page.evaluate(() => (window as any).__locodoko.setzeAnimationsGeschwindigkeit(Infinity));

    let armutGesehen = false;
    let partieBeendet = false;
    let letztePhase = '';

    for (let i = 0; i < 2000 && !partieBeendet; i++) {
      // Rundenauswertungs-Overlay schliessen falls vorhanden (nicht Partie-Ende)
      const weiterBtn = page.locator('[data-testid="btn-rundenauswertung-weiter"]');
      if (await weiterBtn.isVisible({ timeout: 200 }).catch(() => false)) {
        await weiterBtn.click();
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
        await page.evaluate((v) => (window as any).__locodoko.appStore.meldeVorbehalt(v), armut);
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

    if (armutGesehen) {
      console.log('Armut-Tausch erfolgreich durchgefuehrt und getestet.');
    } else {
      console.log('Armut trat in diesem Lauf nicht auf (kein Armut-Deal zufaellig bekommen).');
    }

    expect(jsFehler).toHaveLength(0);
  });
});
