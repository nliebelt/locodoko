import { expect, test } from '@playwright/test';

test.describe('Partie gegen KI', () => {
  test('Erste Partie bis zum ersten abgeschlossenen Stich', async ({ page }) => {
    const jsFehler: string[] = [];
    page.on('pageerror', (err) => jsFehler.push(`[pageerror] ${err.message}`));

    await page.goto('/');
    
    await page.waitForFunction(() => (window as any).__locodoko?.appStore, { timeout: 20_000 });
    
    await page.evaluate(async () => {
      const loco = (window as any).__locodoko;
      await loco.appStore.alsGastStarten();
      await loco.appStore.erstelleKonfiguriertenTisch('E2E-Test-Tisch', {
        ohneNeunen: false,
        anzahlSpiele: 8,
        tischhintergrund: 'FILZ_GRUEN',
        kiSchwierigkeit: 'STANDARD'
      }, false);
    });

    await expect(page.locator('[data-testid="tischszene"]')).toBeVisible({ timeout: 15_000 });

    await page.evaluate(async () => {
      const loco = (window as any).__locodoko;
      await loco.appStore.starteAktuellenTisch();
      if (typeof loco.setzeAnimationsGeschwindigkeit === 'function') {
        loco.setzeAnimationsGeschwindigkeit(Infinity);
      }
    });

    // Wir warten bis SUED an der Reihe ist oder Vorbehalte erwartet werden
    await page.waitForFunction(() => {
      const loco = (window as any).__locodoko;
      const spiel = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel;
      return (spiel?.moeglicheVorbehalte?.length ?? 0) > 0 || (spiel?.spielbareKarten?.length ?? 0) > 0;
    }, { timeout: 30_000 });

    // Vorbehalt melden oder Karte spielen (Bridge!)
    await page.evaluate(async () => {
      const loco = (window as any).__locodoko;
      const spiel = loco.appStore.snapshot().partieStand.laufendesSpiel;
      if (spiel.moeglicheVorbehalte.length > 0) {
        await loco.appStore.meldeVorbehalt(spiel.moeglicheVorbehalte[0]);
      }
    });

    // Warten bis Stichphase erreicht ist
    await page.waitForFunction(() => {
      const loco = (window as any).__locodoko;
      const spiel = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel;
      return spiel?.phase === 'STICHPHASE' && (spiel?.spielbareKarten?.length ?? 0) > 0;
    }, { timeout: 15_000 });

    // Karte spielen
    await page.evaluate(async () => {
      const loco = (window as any).__locodoko;
      const spiel = loco.appStore.snapshot().partieStand.laufendesSpiel;
      await loco.appStore.spieleKarte(spiel.spielbareKarten[0].id);
    });

    // Warten bis der erste Stich abgeschlossen ist (jemand hat Punkte)
    await page.waitForFunction(() => {
      const loco = (window as any).__locodoko;
      const spieler = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel?.spieler;
      return spieler?.some((s: any) => s.gewonneneStiche > 0);
    }, { timeout: 30_000 });

    expect(jsFehler).toHaveLength(0);
  });
});
