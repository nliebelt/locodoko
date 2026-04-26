import { expect, test } from '@playwright/test';
import { getBridge, aktiviereTurbo, warteAufEigenenZug } from './helpers';

test.describe('Ungueltige Karte', () => {
  test('Fehler-Toast erscheint bei ungueltiger Karte und Spiel laeuft weiter', async ({ page }) => {
    const jsFehler: string[] = [];
    page.on('pageerror', (err) => jsFehler.push(`[pageerror] ${err.message}`));

    await page.goto('/');
    await getBridge(page);

    await page.evaluate(async () => {
      const loco = (window as any).__locodoko;
      await loco.appStore.alsGastStarten();
      await loco.appStore.erstelleQuickGame();
    });

    await expect(page.locator('[data-testid="tischszene"]')).toBeVisible({ timeout: 15_000 });
    await aktiviereTurbo(page);

    // Warten auf den ersten Stichphase-Zug
    await warteAufEigenenZug(page, 30_000);

    // Wir versuchen eine Karte zu spielen, die NICHT spielbar ist
    await page.evaluate(async () => {
      const loco = (window as any).__locodoko;
      const spiel = loco.appStore.snapshot().partieStand.laufendesSpiel;
      const alleHandkarten = spiel.spieler.find((s: any) => s.istSelbst).sichtbareHandkarten;
      const spielbareIds = new Set(spiel.spielbareKarten.map((k: any) => k.id));
      const ungueltigeKarte = alleHandkarten.find((k: any) => !spielbareIds.has(k.id));

      if (ungueltigeKarte) {
        await loco.appStore.spieleKarte(ungueltigeKarte.id);
      } else {
        console.warn('Keine ungültige Karte in der Hand gefunden (evtl. alles spielbar).');
      }
    });

    // Wir prüfen ob eine Fehlermeldung im Store ankommt
    await page.waitForFunction(() => {
      const loco = (window as any).__locodoko;
      return loco?.appStore?.snapshot()?.meldung?.typ === 'fehler';
    }, { timeout: 5000 });

    expect(jsFehler).toHaveLength(0);
  });
});
