import { expect, test, type Page } from '@playwright/test';

interface SpielZustand {
  overlayVisible: boolean;
  phase: string | null;
  spieltyp: string | null;
  spielbareKarten: string[];
  moeglicheVorbehalte: string[];
  moeglicheAnsagen: string[];
  armutPhase: boolean;
  spielNummer: number;
}

async function leseSpielZustand(page: Page): Promise<SpielZustand> {
  await page.waitForFunction(() => {
    const loco = (window as any).__locodoko;
    return loco?.appStore?.isIdle() === true;
  }, { timeout: 10000 });

  return page.evaluate((): SpielZustand => {
    const loco = (window as any).__locodoko;
    const spiel = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel;
    return {
      overlayVisible: loco?.isOverlaySichtbar?.() === true,
      phase: spiel?.phase ?? null,
      spieltyp: spiel?.spieltyp ?? null,
      spielbareKarten: spiel?.spielbareKarten?.map((k: any) => k.id) ?? [],
      moeglicheVorbehalte: spiel?.moeglicheVorbehalte ?? [],
      moeglicheAnsagen: spiel?.moeglicheAnsagen ?? [],
      armutPhase: spiel?.phase === 'ARMUT_TAUSCH',
      spielNummer: spiel?.spielNummer ?? 0,
    };
  });
}

async function aktiviereTurbo(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as any).__locodoko?.setzeAnimationsGeschwindigkeit, { timeout: 15_000 });
  await page.evaluate(() => {
    const loco = (window as any).__locodoko;
    loco.setzeAnimationsGeschwindigkeit(Infinity);
  });
}

test.describe('Mehrere Runden gegen KI', () => {
  test('Zwei vollständige Runden ohne JS-Fehler spielen', async ({ page }) => {
    const jsFehler: string[] = [];
    page.on('pageerror', (err) => jsFehler.push(`[pageerror] ${err.message}`));

    await page.goto('/');
    
    await page.waitForFunction(() => (window as any).__locodoko?.appStore, { timeout: 20_000 });
    
    await page.evaluate(async () => {
      const loco = (window as any).__locodoko;
      await loco.appStore.alsGastStarten();
      await loco.appStore.erstelleQuickGame();
    });

    await expect(page.locator('[data-testid="tischszene"]')).toBeVisible({ timeout: 15_000 });
    await aktiviereTurbo(page);

    let abgeschlosseneRunden = 0;
    let letztePhase = '';
    let letzteSpielNummer = 0;

    for (let i = 0; i < 1000 && abgeschlosseneRunden < 2; i++) {
      const zustand = await leseSpielZustand(page);

      if (zustand.phase !== letztePhase || zustand.spielNummer !== letzteSpielNummer) {
        console.log(`[i=${i}] Runde ${abgeschlosseneRunden + 1}/2 | Spiel ${zustand.spielNummer} | Phase=${zustand.phase}`);
        letztePhase = zustand.phase ?? '';
        letzteSpielNummer = zustand.spielNummer;
      }

      if (zustand.overlayVisible) {
        abgeschlosseneRunden++;
        console.log(`Runde ${abgeschlosseneRunden} abgeschlossen.`);
        continue;
      }

      if (zustand.moeglicheVorbehalte.length > 0) {
        await page.evaluate((v) => (window as any).__locodoko.appStore.meldeVorbehalt(v), zustand.moeglicheVorbehalte[0]);
        continue;
      }

      if (zustand.armutPhase) {
        await page.evaluate(() => (window as any).__locodoko.appStore.beantworteArmut(false, []));
        continue;
      }

      if (zustand.phase === 'STICHPHASE' && zustand.spielbareKarten.length > 0) {
        if (zustand.moeglicheAnsagen.includes('KONTRA')) {
           await page.evaluate(() => (window as any).__locodoko.appStore.sageAnsageAn('KONTRA'));
        } else if (zustand.moeglicheAnsagen.includes('RE')) {
           await page.evaluate(() => (window as any).__locodoko.appStore.sageAnsageAn('RE'));
        }
        await page.evaluate((k) => (window as any).__locodoko.appStore.spieleKarte(k), zustand.spielbareKarten[0]);
        continue;
      }

      await page.waitForTimeout(100);
    }

    expect(abgeschlosseneRunden).toBeGreaterThanOrEqual(2);
    expect(jsFehler).toHaveLength(0);
  });
});
