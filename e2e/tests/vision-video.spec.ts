import { test, expect } from '@playwright/test';
import {
  alsGastStarten,
  sicherAbmelden,
  getBridge,
  setzeAnimationsGeschwindigkeit,
  warteAufSzene,
  meldeVorbehalt,
  beantworteArmut,
  spieleKarte,
  aktiviereConsoleCapture,
  erstelleKonfiguriertenTisch,
  starteAktuellenTisch,
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

    await sicherAbmelden(page);
    await page.goto('/');
    await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch { /* ignorieren */ } });
    await getBridge(page);
    await alsGastStarten(page);
    await warteAufSzene(page, 'SpielverwaltungsSzene');
    await page.waitForTimeout(1000);

    // Eigenen frischen Tisch erstellen + sofort starten (statt schnellEinsteigen, das offene
    // Tische anderer Tests beitreten könnte → Deadlock wenn der andere Spieler offline ist)
    await erstelleKonfiguriertenTisch(page, 'VisionVideo', {
      ohneNeunen: true,
      anzahlSpiele: 4,
      tischhintergrund: 'FILZ_GRUEN',
      kiSchwierigkeit: 'STANDARD',
    }, false);
    await page.waitForFunction(
      () => (window as any).__locodoko?.appStore?.snapshot()?.bereich === 'TISCH',
      { timeout: 10_000 }
    );
    await starteAktuellenTisch(page);
    await warteAufSzene(page, 'TischSzene', 15_000);
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

      // Warte auf isIdle() ODER auf das Rundenende-Modal (kommt bevor isIdle, weil Countdown-Timer
      // läuft und die neue Partie startet bevor Animationen fertig sind).
      await page.waitForFunction(
        () => {
          const loco = (window as any).__locodoko;
          if ((loco?._rundenEndeModalGezeigt ?? 0) > 0) return true;
          if (typeof loco?.isIdle === 'function') return loco.isIdle() === true;
          return loco?.appStore?.isIdle?.() === true;
        },
        { timeout: 20_000 }
      );

      // Modal-Check direkt (ohne erneuten isIdle-Wait)
      const modalCount = await page.evaluate(() => (window as any).__locodoko?._rundenEndeModalGezeigt ?? 0);
      if (modalCount > 0) {
        // Modal-Animation (CountUp/Yoyo) kurz im Video stehen lassen, dann fertig.
        await page.waitForTimeout(2500);
        rundeAbgeschlossen = true;
        break;
      }

      // Spielzustand direkt lesen (isIdle() ist bereits sichergestellt oben)
      const zustand = await page.evaluate(() => {
        const loco = (window as any).__locodoko;
        const spiel = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel;
        return {
          phase: (spiel?.phase ?? null) as string | null,
          spielbareKarten: (spiel?.spielbareKarten?.map((k: any) => k.id) ?? []) as string[],
          moeglicheVorbehalte: (spiel?.moeglicheVorbehalte ?? []) as string[],
          armutPhase: spiel?.phase === 'ARMUT_TAUSCH',
        };
      });

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
