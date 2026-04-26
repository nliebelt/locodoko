import { expect, test } from '@playwright/test';
import { getBridge, aktiviereTurbo, leseSpielZustand, meldeVorbehalt, warteAufEigenenZug, spieleErsteHandkarte } from './helpers';

test.describe('Partie gegen KI', () => {
  test('Erste Partie bis zum ersten abgeschlossenen Stich', async ({ page }) => {
    const jsFehler: string[] = [];
    page.on('pageerror', (err) => jsFehler.push(`[pageerror] ${err.message}`));

    await page.goto('/');
    await getBridge(page);

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
      await (window as any).__locodoko.appStore.starteAktuellenTisch();
    });
    await aktiviereTurbo(page);

    // Vorbehalt melden falls vorhanden, dann auf eigenen Zug warten
    const zustand = await leseSpielZustand(page);
    if (zustand.moeglicheVorbehalte.length > 0) {
      await meldeVorbehalt(page, zustand.moeglicheVorbehalte[0]);
    }

    await warteAufEigenenZug(page, 30_000);
    await spieleErsteHandkarte(page);

    // Warten bis der erste Stich abgeschlossen ist (jemand hat Punkte)
    await page.waitForFunction(() => {
      const loco = (window as any).__locodoko;
      const spieler = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel?.spieler;
      return spieler?.some((s: any) => s.gewonneneStiche > 0);
    }, { timeout: 30_000 });

    expect(jsFehler).toHaveLength(0);
  });
});
