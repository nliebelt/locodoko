import { expect, test } from '@playwright/test';
import { getBridge, aktiviereTurbo, leseSpielZustand, meldeVorbehalt, warteAufEigenenVorbehalt, warteAufEigenenZug, spieleErsteHandkarte, alsGastStarten, erstelleKonfiguriertenTisch, starteAktuellenTisch, aktiviereConsoleCapture } from './helpers';

test.describe('Partie gegen KI', () => {
  test('Erste Partie bis zum ersten abgeschlossenen Stich', async ({ page }, testInfo) => {
    aktiviereConsoleCapture(page, testInfo.title);
    const jsFehler: string[] = [];
    page.on('pageerror', (err) => jsFehler.push(`[pageerror] ${err.message}`));

    await page.goto('/');
    await getBridge(page);

    await alsGastStarten(page);
    await erstelleKonfiguriertenTisch(page, 'E2E-Test-Tisch', {
      ohneNeunen: false,
      anzahlSpiele: 8,
      tischhintergrund: 'FILZ_GRUEN',
      kiSchwierigkeit: 'STANDARD',
    }, true);

    await expect(page.locator('[data-testid="tischszene"]')).toBeVisible({ timeout: 15_000 });

    await starteAktuellenTisch(page);
    await aktiviereTurbo(page);

    // Warten bis UNSER Vorbehalt-Zug kommt, dann GESUND melden
    // (moeglicheVorbehalte ist nur > 0 wenn genau wir dran sind)
    await warteAufEigenenVorbehalt(page, 20_000);
    const zustand = await leseSpielZustand(page);
    await meldeVorbehalt(page, zustand.moeglicheVorbehalte[0]);

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
