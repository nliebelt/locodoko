import { expect, test } from '@playwright/test';
import { getBridge, aktiviereTurbo, leseSpielZustand, meldeVorbehalt, warteAufEigenenVorbehalt, warteAufEigenenZug, alsGastStarten, erstelleQuickGame, aktiviereConsoleCapture, warteAufSzene } from './helpers';

test.describe('Ungueltige Karte', () => {
  test('Fehler-Toast erscheint bei ungueltiger Karte und Spiel laeuft weiter', async ({ page }, testInfo) => {
    aktiviereConsoleCapture(page, testInfo.title);
    const jsFehler: string[] = [];
    page.on('pageerror', (err) => jsFehler.push(`[pageerror] ${err.message}`));

    await page.goto('/');
    await getBridge(page);

    await alsGastStarten(page);
    await erstelleQuickGame(page);

    console.log('Start');
    await warteAufSzene(page, 'TischSzene', 15_000);
    console.log('TischSzene reached');
    await aktiviereTurbo(page);

    // Vorbehalt-Phase durchlaufen: warten bis wir dran sind, dann GESUND melden
    console.log('Waiting for Vorbehalt');
    await warteAufEigenenVorbehalt(page, 20_000);
    console.log('Vorbehalt reached');
    const vorbehaltZustand = await leseSpielZustand(page);
    await meldeVorbehalt(page, vorbehaltZustand.moeglicheVorbehalte[0]);

    // Warten auf den ersten Stichphase-Zug
    console.log('Waiting for Zug');
    await warteAufEigenenZug(page, 30_000);
    console.log('Zug reached');

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
    console.log('Karte played');

    // Wir prüfen ob eine Fehlermeldung im Store ankommt
    await page.waitForFunction(() => {
      const loco = (window as any).__locodoko;
      return !!loco?._letzterFehlerToast;
    }, undefined, { timeout: 5000 });
    console.log('Fehler checked');

    expect(jsFehler).toHaveLength(0);
  });
});
