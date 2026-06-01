import { test, expect } from '@playwright/test';
import {
  alsGastStarten,
  getBridge,
  aktiviereTurbo,
  setzeAnimationsGeschwindigkeit,
  leseSpielZustand,
  leseHudZustand,
  leseRundenEndeModalCount,
  warteAufSzene,
  warteAufPhase,
  warteAufEigenenVorbehalt,
  warteAufEigenenZug,
  warteAufNaechstesEreignis,
  spieleErsteHandkarte,
  spieleKarte,
  meldeVorbehalt,
  beantworteArmut,
  aktiviereConsoleCapture,
  screenshot,
  screenshotKeyframes,
} from './helpers';

test.describe('Vision Loop — UI Screenshots', () => {
  test('Alle wichtigen Spielzustaende screenshotten', async ({ page }, testInfo) => {
    aktiviereConsoleCapture(page, testInfo.title);
    page.on('console', msg => console.log('BROWSER:', msg.text()));

    console.log('Navigating to /...');
    await page.goto('/');
    await getBridge(page);
    await alsGastStarten(page);

    await warteAufSzene(page, 'SpielverwaltungsSzene');
    await page.waitForTimeout(2000);
    await screenshot(page, '01-lobby');

    // ── 1. Offene Tische (Permanent sichtbar in neuer Lobby) ──────────────────
    console.log('Taking screenshot of Offene Tische...');
    await page.waitForTimeout(1000);
    await screenshot(page, '11-offene-tische');

    // ── 2. Neuen Tisch Modal ────────────────────────────────────────────────
    console.log('Opening Erstelle Tisch Modal...');
    await page.evaluate(() => (window as any).__locodoko.drueckeSzenenButton('btn-neuer-tisch'));
    await page.waitForTimeout(1000);
    await screenshot(page, '12-neuer-tisch-modal');
    await page.evaluate(() => (window as any).__locodoko.drueckeSzenenButton('btn-abbrechen'));

    // ── 3. Quick Game starten ─────────────────────────────────────────────────
    console.log('Starting Quick Game...');
    await page.evaluate(() => (window as any).__locodoko.appStore.erstelleQuickGame());
    await warteAufSzene(page, 'TischSzene');
    await aktiviereTurbo(page);
    await page.locator('canvas').focus();

    // ── 4. Seitenlade & Einstellungen ────────────────────────────────────────
    console.log('Opening Seitenlade...');
    await page.keyboard.press('i');
    await page.waitForTimeout(1000);
    await screenshot(page, '07-seitenlade-offen');
    await page.keyboard.press('i');

    console.log('Opening Einstellungen...');
    await page.keyboard.press('s');
    await page.waitForTimeout(1000);
    await screenshot(page, '08-einstellungen-modal');
    await page.keyboard.press('Escape');

    // ── 5. Vorbehalt-Animation (Slow-Motion 0.2×) ───────────────────────────
    console.log('Waiting for phase VORBEHALT_ANSAGE...');
    await warteAufPhase(page, 'VORBEHALT_ANSAGE', 30_000);
    await setzeAnimationsGeschwindigkeit(page, 0.2); // Slow Motion active

    console.log('Waiting for own Vorbehalt choice...');
    await warteAufEigenenVorbehalt(page);
    await screenshot(page, '02-vorbehalt-phase');
    
    // Vorbehalt wechseln (animiert)
    console.log('Changing Vorbehalt choice (animated)...');
    await page.keyboard.press('ArrowRight');
    await screenshotKeyframes(page, '02-vorbehalt-wechsel', 200);

    // Turbo vor meldeVorbehalt: SPIEL_GESTARTET-Animation (12.5s bei 0.2×) würde sonst
    // den 10s-Timeout von warteAufNaechstesEreignis sprengen.
    await aktiviereTurbo(page);
    await meldeVorbehalt(page, 'GESUND');
    await warteAufNaechstesEreignis(page, 30_000); // Warten bis SPIEL_GESTARTET + Austeilen durch

    // Ggf. ARMUT-Phase überbrücken (zufälliger Kartenausgang, KI kann ARMUT haben)
    {
      const phase = await page.evaluate(() =>
        (window as any).__locodoko?.appStore?.snapshot()?.partieStand?.laufendesSpiel?.phase
      );
      if (phase === 'ARMUT_TAUSCH') {
        await beantworteArmut(page, false, []);
        await warteAufNaechstesEreignis(page, 30_000);
      }
    }

    // ── 6. Stich-Animation (Slow-Motion 0.2×) ───────────────────────────────
    console.log('Waiting for own move (STICHPHASE)...');
    await warteAufEigenenZug(page, 30_000);
    await setzeAnimationsGeschwindigkeit(page, 0.2); // Slow Motion für visuellen Stich-Screenshot
    await screenshot(page, '03-stichphase-eigener-zug');

    console.log('Playing first card (animated)...');
    await spieleErsteHandkarte(page);
    // Nur Startzustand und Mittelpunkt aufnehmen — kein isIdle()-Wait, da der volle Stich
    // (3 KI-Züge + Einziehen + Flash-Texts) bei 0.2× ~31s dauert und den 20s-Timeout sprengen würde.
    await screenshot(page, '03-stich-ausspielen-0');
    await page.waitForTimeout(Math.round(400 * 5 * 0.5)); // Mitte der Karte-ausspielen-Animation
    await screenshot(page, '03-stich-ausspielen-50');

    // ── 7. Rest der Partie (Turbo) ──────────────────────────────────────────
    console.log('Playing rest of game (Turbo)...');
    await aktiviereTurbo(page);
    
    let rundeAbgeschlossen = false;

    while (!rundeAbgeschlossen) {
      // Wartet bis entweder eigene Aktion noetig ist oder Runde abgeschlossen (Modal gezeigt) oder neue Phase (Vorbehalt naechstes Spiel)
      await page.waitForFunction(() => {
        const loco = (window as any).__locodoko;
        if (loco?._rundenEndeModalGezeigt > 0) return true;
        const spiel = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel;
        if (!spiel) return false;
        if (spiel.phase === 'VORBEHALT_ANSAGE') return true;
        if ((spiel.spielbareKarten?.length ?? 0) > 0) return true;
        if ((spiel.moeglicheVorbehalte?.length ?? 0) > 0) return true;
        if (spiel.phase === 'ARMUT_TAUSCH') return true;
        return false;
      }, { timeout: 60_000 });

      const modalCount = await leseRundenEndeModalCount(page);
      if (modalCount > 0) {
        await setzeAnimationsGeschwindigkeit(page, 1.0); // Normal speed for modal
        await page.waitForTimeout(500); // Wait for fade in
        await screenshot(page, '05-rundenauswertung-overlay');
        console.log('Screenshot: 05-rundenauswertung-overlay');
        rundeAbgeschlossen = true;
        break;
      }

      const zustand = await leseSpielZustand(page);

      if (zustand.phase === 'VORBEHALT_ANSAGE') {
        rundeAbgeschlossen = true;
        break;
      }

      if (zustand.moeglicheVorbehalte.length > 0) {
        await meldeVorbehalt(page, zustand.moeglicheVorbehalte[0]);
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
    }

    // ── 8. Abschluss ────────────────────────────────────────────────────────
    expect(rundeAbgeschlossen, 'Eine vollstaendige Runde muss abgeschlossen sein').toBe(true);

    const modalGezeigt = await leseRundenEndeModalCount(page);
    expect(modalGezeigt, 'Rundenauswertungs-Overlay muss nach Spielende angezeigt worden sein').toBeGreaterThan(0);

    console.log(`\n=== Vision Loop abgeschlossen — Rundenauswertung bestaetigt (${modalGezeigt}x gezeigt) ===`);
  });
});

