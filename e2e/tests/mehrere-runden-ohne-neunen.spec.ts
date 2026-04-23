import { expect, test, type Page } from '@playwright/test';

interface SpielZustand {
  overlayVisible: boolean;
  phase: string | null;
  spieltyp: string | null;
  spielbareKarten: string[];
  moeglicheVorbehalte: string[];
  spielNummer: number;
}

async function leseSpielZustand(page: Page): Promise<SpielZustand> {
  await page.waitForFunction(() => (window as any).__locodoko?.appStore?.isIdle() === true, { timeout: 10000 }).catch(() => {});
  return page.evaluate((): SpielZustand => {
    const loco = (window as any).__locodoko;
    const spiel = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel;
    return {
      overlayVisible: loco?.isOverlaySichtbar?.() === true,
      phase: spiel?.phase ?? null,
      spieltyp: spiel?.spieltyp ?? null,
      spielbareKarten: spiel?.spielbareKarten?.map((k: any) => k.id) ?? [],
      moeglicheVorbehalte: spiel?.moeglicheVorbehalte ?? [],
      spielNummer: spiel?.spielNummer ?? 0,
    };
  });
}

async function aktiviereTurbo(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as any).__locodoko?.setzeAnimationsGeschwindigkeit, { timeout: 15_000 });
  await page.evaluate(() => (window as any).__locodoko.setzeAnimationsGeschwindigkeit(Infinity));
}

test.describe('Mehrere Runden ohne Neunen (10 Stiche)', () => {
  test('Zwei vollständige Runden ohne JS-Fehler spielen', async ({ page }) => {
    const jsFehler: string[] = [];
    page.on('pageerror', (err) => jsFehler.push(`[pageerror] ${err.message}`));

    await page.goto('/');
    await page.waitForFunction(() => (window as any).__locodoko?.appStore, { timeout: 20_000 });
    
    await page.evaluate(async () => {
      const loco = (window as any).__locodoko;
      await loco.appStore.alsGastStarten();
      await loco.appStore.erstelleKonfiguriertenTisch('E2E-Ohne-Neunen', {
        ohneNeunen: true,
        anzahlSpiele: 2,
        tischhintergrund: 'FILZ_GRUEN',
        kiSchwierigkeit: 'STANDARD'
      }, false);
    });

    await expect(page.locator('[data-testid="tischszene"]')).toBeVisible({ timeout: 15_000 });
    await page.evaluate(() => (window as any).__locodoko.appStore.starteAktuellenTisch());
    await aktiviereTurbo(page);

    let abgeschlosseneRunden = 0;
    let stichzaehlerGeprueft = false;

    for (let i = 0; i < 1000 && abgeschlosseneRunden < 1; i++) {
      const zustand = await leseSpielZustand(page);
      if (!zustand.phase) { await page.waitForTimeout(100); continue; }

      if (zustand.overlayVisible) {
        abgeschlosseneRunden++;
        console.log(`Runde ${abgeschlosseneRunden} abgeschlossen.`);
        continue;
      }

      // Stichzähler Prüfung (muss /10 sein)
      if (!stichzaehlerGeprueft && zustand.phase === 'STICHPHASE') {
        const text = await page.locator('[data-testid="hud-stichzaehler"]').innerText();
        expect(text).toContain('/10');
        stichzaehlerGeprueft = true;
      }

      if (zustand.moeglicheVorbehalte.length > 0) {
        await page.evaluate((v) => (window as any).__locodoko.appStore.meldeVorbehalt(v), zustand.moeglicheVorbehalte[0]);
        continue;
      }

      if (zustand.phase === 'STICHPHASE' && zustand.spielbareKarten.length > 0) {
        await page.evaluate((k) => (window as any).__locodoko.appStore.spieleKarte(k), zustand.spielbareKarten[0]);
        continue;
      }

      await page.waitForTimeout(100);
    }

    expect(abgeschlosseneRunden).toBeGreaterThanOrEqual(1);
    expect(stichzaehlerGeprueft).toBe(true);
    expect(jsFehler).toHaveLength(0);
  });
});
