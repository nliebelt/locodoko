import { expect, test, type Page } from '@playwright/test';

interface SpielZustand {
  phase: string | null;
  spielbareKarten: string[];
  moeglicheVorbehalte: string[];
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
      spielbareKarten: spiel?.spielbareKarten?.map((k: any) => k.id) ?? [],
      moeglicheVorbehalte: spiel?.moeglicheVorbehalte ?? [],
    };
  });
}

test.describe('Rundenauswertung', () => {
  test('Rundenauswertungs-Overlay erscheint nach Spielende und kann geschlossen werden', async ({ page }) => {
    const seitenFehler: string[] = [];
    page.on('pageerror', (err) => { seitenFehler.push(err.message); });

    await page.goto('/');
    await page.waitForFunction(() => (window as any).__locodoko?.appStore, { timeout: 20_000 });

    await page.evaluate(async () => {
      const loco = (window as any).__locodoko;
      await loco.appStore.alsGastStarten();
      await loco.appStore.erstelleQuickGame();
    });

    await expect(page.locator('[data-testid="tischszene"]')).toBeVisible({ timeout: 15_000 });

    // Turbo: Animationen sofort, KI-Verzögerung 0
    await page.waitForFunction(() => (window as any).__locodoko?.setzeAnimationsGeschwindigkeit, { timeout: 10_000 });
    await page.evaluate(() => (window as any).__locodoko.setzeAnimationsGeschwindigkeit(Infinity));

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
        await page.evaluate((v) => (window as any).__locodoko.appStore.meldeVorbehalt(v), zustand.moeglicheVorbehalte[0]);
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
