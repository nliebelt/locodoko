import { expect, test, type Page } from '@playwright/test';

interface SpielZustand {
  overlayVisible: boolean;
  phase: string | null;
  spielbareKarten: string[];
  moeglicheVorbehalte: string[];
}

async function leseSpielZustand(page: Page): Promise<SpielZustand> {
  await page.waitForFunction(() => (window as any).__locodoko?.appStore?.isIdle() === true, { timeout: 10000 }).catch(() => {});
  return page.evaluate((): SpielZustand => {
    const loco = (window as any).__locodoko;
    const spiel = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel;
    return {
      overlayVisible: loco?.isOverlaySichtbar?.() === true,
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
    
    await page.evaluate(() => {
      const loco = (window as any).__locodoko;
      loco.setzeAnimationsGeschwindigkeit(Infinity);
    });

    let overlayGefunden = false;
    for (let i = 0; i < 500 && !overlayGefunden; i++) {
      const zustand = await leseSpielZustand(page);
      if (zustand.overlayVisible) {
        overlayGefunden = true;
        break;
      }
      if (zustand.moeglicheVorbehalte.length > 0) {
        await page.evaluate((v) => (window as any).__locodoko.appStore.meldeVorbehalt(v), zustand.moeglicheVorbehalte[0]);
      } else if (zustand.phase === 'STICHPHASE' && zustand.spielbareKarten.length > 0) {
        await page.evaluate((k) => (window as any).__locodoko.appStore.spieleKarte(k), zustand.spielbareKarten[0]);
      }
      await page.waitForTimeout(50);
    }

    expect(overlayGefunden, 'Overlay muss nach Spielende sichtbar sein').toBe(true);

    // Overlay schließen via Bridge
    await page.evaluate(() => (window as any).__locodoko.appStore.starteNeuePartie());
    
    await page.waitForFunction(() => (window as any).__locodoko.isOverlaySichtbar() === false, { timeout: 10_000 });
    expect(seitenFehler).toHaveLength(0);
  });
});
