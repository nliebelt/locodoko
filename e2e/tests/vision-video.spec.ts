import { test, expect } from '@playwright/test';
import {
  alsGastStarten,
  getBridge,
  setzeAnimationsGeschwindigkeit,
  leseSpielZustand,
  leseRundenEndeModalCount,
  warteAufSzene,
  meldeVorbehalt,
  beantworteArmut,
  spieleKarte,
  aktiviereConsoleCapture,
} from './helpers';

// Video-basierter Vision-Loop: spielt eine vollständige Runde in Echtzeit durch, während
// Playwright durchgehend ein .webm aufzeichnet (Config: playwright.config.video.ts → video:'on').
// Anders als der Screenshot-Loop wird hier NICHT geblitzt und NICHT in Turbo gespielt — das
// Ziel ist gerade, die Animationen/Tweens/Flash-Texte im Bewegtbild zu konservieren.
//
// Nach dem Lauf liegt das Video unter test-results/video/. Frames für die Sichtung:
//   node extrahiere-video-frames.mjs --video <pfad.webm> --fps 4
test.describe('Vision Video Loop — durchgehende Aufnahme', () => {
  test('Vollstaendige Runde in Echtzeit aufzeichnen', async ({ page }, testInfo) => {
    aktiviereConsoleCapture(page, testInfo.title);

    await page.goto('/');
    await getBridge(page);
    await alsGastStarten(page);
    await warteAufSzene(page, 'SpielverwaltungsSzene');
    // Kurz warten, damit WebSocket-Verbindung und Tischliste vollständig initialisiert sind
    // (analog vision-loop.spec.ts Z. 40 — ohne diese Pause schlägt erstelleQuickGame silent fehl)
    await page.waitForTimeout(2000);

    // Quick Game starten
    await page.evaluate(() => (window as any).__locodoko.appStore.erstelleQuickGame());
    await warteAufSzene(page, 'TischSzene', 30_000);
    await page.locator('canvas').focus();

    // 3× Geschwindigkeit: Animationen laufen 3× schneller, bleiben aber bei 4fps noch sichtbar.
    // (Kein aktiviereTurbo — Turbo überspringt Übergänge; 1.0× war zu langsam für 200 Iterationen.)
    await setzeAnimationsGeschwindigkeit(page, 3.0);
    // KI-Delay auf 400ms statt 800ms reduzieren, damit eine Runde in ~20-30s statt ~80s abläuft.
    await page.evaluate(() => (window as any).__locodoko?.appStore?.setzeKiKartenVerzögerung(400));

    let rundeAbgeschlossen = false;
    let zugZaehler = 0;
    const maxZuege = 200; // Sicherheitsnetz gegen Endlosschleife

    while (!rundeAbgeschlossen && zugZaehler < maxZuege) {
      zugZaehler++;

      const modalCount = await leseRundenEndeModalCount(page);
      if (modalCount > 0) {
        // Modal-Animation (CountUp/Yoyo) kurz im Video stehen lassen, dann fertig.
        await page.waitForTimeout(2500);
        rundeAbgeschlossen = true;
        break;
      }

      const zustand = await leseSpielZustand(page);

      if (zustand.phase === 'VORBEHALT_ANSAGE' && zustand.moeglicheVorbehalte.length === 0) {
        // Eigener Vorbehalt schon gemeldet, KI noch am Ansagen — kurz warten.
        await page.waitForTimeout(300);
        continue;
      }
      if (zustand.moeglicheVorbehalte.length > 0) {
        await meldeVorbehalt(page, 'GESUND');
        continue;
      }
      if (zustand.armutPhase) {
        await beantworteArmut(page, false, []);
        continue;
      }
      if (zustand.spielbareKarten.length > 0) {
        await spieleKarte(page, zustand.spielbareKarten[0]);
        continue;
      }

      // Nichts zu tun (KI am Zug) — Animationen im Video laufen lassen.
      await page.waitForTimeout(400);
    }

    expect(rundeAbgeschlossen, 'Eine vollstaendige Runde muss aufgezeichnet worden sein').toBe(true);

    const videoPfad = await page.video()?.path();
    console.log(`\n=== Vision-Video-Loop fertig (${zugZaehler} Zustands-Iterationen) ===`);
    console.log(`Video: ${videoPfad ?? 'test-results/video/<test>/video.webm'}`);
    console.log('Frames extrahieren: node extrahiere-video-frames.mjs --video <pfad.webm> --fps 4');
  });
});
