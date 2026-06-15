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
  spieleKarteViaTestApi,
  meldeVorbehalt,
  beantworteArmut,
  erstelleKonfiguriertenTisch,
  starteAktuellenTisch,
  aktiviereConsoleCapture,
  screenshot,
  screenshotKeyframes,
} from './helpers';

test.describe('Vision Loop — UI Screenshots', () => {
  test('Alle wichtigen Spielzustaende screenshotten', async ({ page }, testInfo) => {
    aktiviereConsoleCapture(page, testInfo.title);
    page.on('console', msg => console.log('BROWSER:', msg.text()));

    const prefix = testInfo.project.name;

    console.log('Navigating to /...');
    await page.goto('/');
    await getBridge(page);
    await alsGastStarten(page);

    await warteAufSzene(page, 'SpielverwaltungsSzene');
    await page.waitForTimeout(2000);
    await screenshot(page, '01-lobby', prefix);

    // ── 1. Neuen Tisch Modal ─────────────────────────────────────────────────
    await page.evaluate(() => (window as any).__locodoko.drueckeSzenenButton('btn-neuer-tisch'));
    await page.waitForTimeout(1000);
    await screenshot(page, '12-neuer-tisch-modal', prefix);
    // Tisch-Modal ist seit dem Redesign ein DOM-Overlay → über den DOM-Button schliessen,
    // nicht via Phaser-Helper (drueckeSzenenButton findet DOM-Buttons nicht → Dialog bliebe offen).
    // Programmatischer .click() statt locator-Klick, damit der Close-Handler auch dann feuert,
    // wenn ein anderes Overlay (z. B. Querformat-Hinweis auf Mobile) Pointer-Events abfängt.
    await page.evaluate(() => document.querySelector<HTMLButtonElement>('#tisch-abbrechen')?.click());

    // ── 3. Quick Game starten ────────────────────────────────────────────────
    console.log('Starting Quick Game...');
    await page.evaluate(() => (window as any).__locodoko.appStore.erstelleQuickGame());
    await warteAufSzene(page, 'TischSzene');
    await aktiviereTurbo(page);
    await page.locator('canvas').focus();
    // F-01 + A-01: best-effort (bei Turbo — Animationen sofort abgeschlossen)
    await screenshot(page, 'f01-flash-spiel-gestartet', prefix);
    await screenshot(page, 'a01-austeilen', prefix);

    // ── T-08: Spielprotokoll-Overlay ─────────────────────────────────────────
    await page.evaluate(() => (window as any).__locodoko?.toggleSpielprotokoll?.());
    await page.waitForTimeout(500);
    await screenshot(page, '09-spielprotokoll', prefix);
    await page.evaluate(() => (window as any).__locodoko?.toggleSpielprotokoll?.());
    await page.waitForTimeout(200);

    // ── 4. Seitenlade & Einstellungen ────────────────────────────────────────
    console.log('Opening Seitenlade...');
    await page.keyboard.press('i');
    await page.waitForTimeout(1000);
    await screenshot(page, '07-seitenlade-offen', prefix);
    await page.keyboard.press('i');

    console.log('Opening Einstellungen...');
    await page.locator('canvas').focus();
    await page.keyboard.press('s');
    await page.waitForTimeout(1000);
    await screenshot(page, '08-einstellungen-modal', prefix);
    await page.keyboard.press('Escape');

    // ── 5. Vorbehalt-Animation (0.2×) ────────────────────────────────────────
    console.log('Waiting for phase VORBEHALT_ANSAGE...');
    await warteAufPhase(page, 'VORBEHALT_ANSAGE', 30_000);
    await setzeAnimationsGeschwindigkeit(page, 0.2);

    console.log('Waiting for own Vorbehalt choice...');
    await warteAufEigenenVorbehalt(page);
    // F-02: VorbehaltErwartet-Flash (persistent bei 0.2× gut photographierbar)
    await screenshot(page, 'f02-flash-vorbehalt-erwartet', prefix);
    await screenshot(page, '02-vorbehalt-phase', prefix);

    await page.keyboard.press('ArrowRight');
    await screenshotKeyframes(page, '02-vorbehalt-wechsel', 200, prefix);

    // Turbo vor meldeVorbehalt: SPIEL_GESTARTET-Animation (12.5s bei 0.2×) würde sonst
    // den Timeout von warteAufNaechstesEreignis sprengen.
    await aktiviereTurbo(page);
    await meldeVorbehalt(page, 'GESUND');
    await warteAufNaechstesEreignis(page, 30_000);

    // Ggf. ARMUT-Phase überbrücken
    {
      const phase = await page.evaluate(() =>
        (window as any).__locodoko?.appStore?.snapshot()?.partieStand?.laufendesSpiel?.phase
      );
      if (phase === 'ARMUT_TAUSCH') {
        await beantworteArmut(page, false, []);
        await warteAufNaechstesEreignis(page, 30_000);
      }
    }

    // ── 6. Stich-Animation (0.2×) ────────────────────────────────────────────
    console.log('Waiting for own move (STICHPHASE)...');
    // Direkte waitForFunction mit korrektem dritten Argument (timeout als options, nicht als arg).
    // warteAufEigenenZug() hat einen pre-existing Bug: übergibt timeout als arg → Playwright 1.51 = 0 (unendlich).
    await page.waitForFunction(() => {
      const spiel = (window as any).__locodoko?.appStore?.snapshot()?.partieStand?.laufendesSpiel;
      return (spiel?.spielbareKarten?.length ?? 0) > 0;
    }, null, { timeout: 30_000 });
    await setzeAnimationsGeschwindigkeit(page, 0.2);
    // F-03: NaechsterSpielerErwartet (eigener Zug, persistent)
    await screenshot(page, 'f03-flash-am-zug', prefix);
    await screenshot(page, '03-stichphase-eigener-zug', prefix);

    // X-01: Fehler-Toast via ungültige Karte → AKTION_ABGELEHNT
    await spieleKarteViaTestApi(page, 'ungueltige-karte-id');
    await page.waitForTimeout(800);
    await screenshot(page, 'x01-fehler-toast', prefix);

    console.log('Playing first card (animated)...');
    await spieleErsteHandkarte(page);
    await screenshot(page, '03-stich-ausspielen-0', prefix);
    await page.waitForTimeout(Math.round(400 * 5 * 0.5));
    await screenshot(page, '03-stich-ausspielen-50', prefix);

    // T-05: Gegner am Zug (SUED hat gespielt, KI noch nicht am Stich)
    await screenshot(page, '03b-stich-gegner-am-zug', prefix);

    // ── 7. Rest der Partie (Turbo) ───────────────────────────────────────────
    console.log('Playing rest of game (Turbo)...');
    await aktiviereTurbo(page);

    let rundeAbgeschlossen = false;
    let ansageScreenshotGemacht = false;
    let armutScreenshotGemacht = false;
    let letzterStichScreenshotGemacht = false;
    let flashScreenshotGemacht = { f04: false, f05: false, f06: false, f07: false, f08: false, f09: false, a03: false, a04: false, a05: false };

    while (!rundeAbgeschlossen) {
      await page.waitForFunction((flashGemacht) => {
        const loco = (window as any).__locodoko;
        if (loco?._rundenEndeModalGezeigt > 0) return true;
        
        const flash = loco?._letzterFlashTyp;
        if (flash === 'StichAbgeschlossen' && !flashGemacht.f04) return true;
        if (flash === 'SchweinchenGemeldet' && !flashGemacht.f05) return true;
        if (flash === 'FuchsGefangen' && !flashGemacht.f06) return true;
        if (flash === 'KarlchenGespielt' && !flashGemacht.f07) return true;
        if (flash === 'DoppelkopfGestochen' && !flashGemacht.f08) return true;
        if (flash === 'HochzeitPartnerGefunden' && !flashGemacht.f09) return true;
        if (flash === 'SpielGestartet' && (!flashGemacht.a03 || !flashGemacht.a04)) return true;

        const spiel = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel;
        if (!spiel) return false;
        if (spiel.phase === 'VORBEHALT_ANSAGE') return true;
        if ((spiel.spielbareKarten?.length ?? 0) > 0) return true;
        if ((spiel.moeglicheVorbehalte?.length ?? 0) > 0) return true;
        if ((spiel.moeglicheAnsagen?.length ?? 0) > 0) return true;
        if (spiel.phase === 'ARMUT_TAUSCH') return true;
        return false;
      }, flashScreenshotGemacht, { timeout: 60_000 });

      const flashTyp = await page.evaluate(() => (window as any).__locodoko?._letzterFlashTyp);
      if (flashTyp) {
        let matched = false;
        if (flashTyp === 'StichAbgeschlossen' && !flashScreenshotGemacht.f04) {
          flashScreenshotGemacht.f04 = true; matched = true;
          await setzeAnimationsGeschwindigkeit(page, 0.2);
          await page.waitForTimeout(100);
          await screenshot(page, 'f04-flash-stich-abgeschlossen', prefix);
          
          if (!flashScreenshotGemacht.a05) {
            flashScreenshotGemacht.a05 = true;
            await page.waitForTimeout(300);
            await screenshot(page, 'a05-stich-einziehen', prefix);
          }
        } else if (flashTyp === 'SchweinchenGemeldet' && !flashScreenshotGemacht.f05) {
          flashScreenshotGemacht.f05 = true; matched = true;
          await setzeAnimationsGeschwindigkeit(page, 0.2);
          await page.waitForTimeout(100);
          await screenshot(page, 'f05-flash-schweinchen', prefix);
        } else if (flashTyp === 'FuchsGefangen' && !flashScreenshotGemacht.f06) {
          flashScreenshotGemacht.f06 = true; matched = true;
          await setzeAnimationsGeschwindigkeit(page, 0.2);
          await page.waitForTimeout(100);
          await screenshot(page, 'f06-flash-fuchs', prefix);
        } else if (flashTyp === 'KarlchenGespielt' && !flashScreenshotGemacht.f07) {
          flashScreenshotGemacht.f07 = true; matched = true;
          await setzeAnimationsGeschwindigkeit(page, 0.2);
          await page.waitForTimeout(100);
          await screenshot(page, 'f07-flash-karlchen', prefix);
        } else if (flashTyp === 'DoppelkopfGestochen' && !flashScreenshotGemacht.f08) {
          flashScreenshotGemacht.f08 = true; matched = true;
          await setzeAnimationsGeschwindigkeit(page, 0.2);
          await page.waitForTimeout(100);
          await screenshot(page, 'f08-flash-doppelkopf', prefix);
        } else if (flashTyp === 'HochzeitPartnerGefunden' && !flashScreenshotGemacht.f09) {
          flashScreenshotGemacht.f09 = true; matched = true;
          await setzeAnimationsGeschwindigkeit(page, 0.2);
          await page.waitForTimeout(100);
          await screenshot(page, 'f09-flash-hochzeit', prefix);
        } else if (flashTyp === 'SpielGestartet') {
          const partieStand = await page.evaluate(() => (window as any).__locodoko?.appStore?.snapshot()?.partieStand);
          const spieltyp = partieStand?.laufendesSpiel?.spieltyp;
          const bockrundenZaehler = partieStand?.bockrundenZaehler ?? 0;
          
          if (spieltyp && spieltyp !== 'NORMAL' && !flashScreenshotGemacht.a03) {
            flashScreenshotGemacht.a03 = true; matched = true;
            await setzeAnimationsGeschwindigkeit(page, 0.2);
            await page.waitForTimeout(100);
            await screenshot(page, 'a03-solo-ankuendigung', prefix);
          }
          if (bockrundenZaehler > 0 && !flashScreenshotGemacht.a04) {
            flashScreenshotGemacht.a04 = true; matched = true;
            await setzeAnimationsGeschwindigkeit(page, 0.2);
            await page.waitForTimeout(100);
            await screenshot(page, 'a04-bockrunde', prefix);
          }
        }
        
        await page.evaluate(() => { (window as any).__locodoko._letzterFlashTyp = undefined; });
        if (matched) {
          await aktiviereTurbo(page);
          continue;
        }
      }

      const modalCount = await leseRundenEndeModalCount(page);
      if (modalCount > 0) {
        // F-10: SpielBeendet-Flash (best-effort — kurz vor Modal sichtbar)
        await setzeAnimationsGeschwindigkeit(page, 0.2);
        await page.waitForTimeout(400);
        await screenshot(page, 'f10-flash-spiel-beendet', prefix);
        await setzeAnimationsGeschwindigkeit(page, 1.0);
        await page.waitForTimeout(500);
        await screenshot(page, '05-rundenauswertung-overlay', prefix);
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

      // ── Ansage-Buttons + A-02 (best-effort) ──────────────────────────────
      if (!ansageScreenshotGemacht && zustand.moeglicheAnsagen.length > 0) {
        ansageScreenshotGemacht = true;
        await setzeAnimationsGeschwindigkeit(page, 1.0);
        await page.waitForTimeout(300);
        await screenshot(page, '06-ansage-buttons', prefix);
        // A-02: Ansage-Banner (best-effort — Animation läuft nach KI-Ansage)
        await screenshot(page, 'a02-ansage-banner', prefix);
        console.log('Screenshot: 06-ansage-buttons');
        await aktiviereTurbo(page);
      }

      // ── Armut-Tausch-UI (best-effort) ────────────────────────────────────
      if (!armutScreenshotGemacht && zustand.armutPhase) {
        armutScreenshotGemacht = true;
        await setzeAnimationsGeschwindigkeit(page, 1.0);
        await page.waitForTimeout(300);
        await screenshot(page, '04-armut-tausch-ui', prefix);
        console.log('Screenshot: 04-armut-tausch-ui');
        await aktiviereTurbo(page);
      }

      if (zustand.armutPhase) {
        await beantworteArmut(page, false, []);
        continue;
      }

      // ── T-11 Letzter-Stich-Overlay ───────────────────────────────────────
      // Bedingung unabhängig von f04: sobald der Spieler Karten hat (= Stich 1 aus der
      // animierten Phase ist abgeschlossen), ist letzteAbgeschlosseneStiche befüllt.
      if (!letzterStichScreenshotGemacht && zustand.spielbareKarten.length > 0) {
        letzterStichScreenshotGemacht = true;
        await page.evaluate(() => (window as any).__locodoko?.zeigeLetztesStichOverlay?.());
        await page.waitForTimeout(500);
        await screenshot(page, '10-letzter-stich-overlay', prefix);
        console.log('Screenshot: 10-letzter-stich-overlay');
        await page.mouse.click(10, 10);
        await page.waitForTimeout(200);
      }

      if (zustand.spielbareKarten.length > 0) {
        await spieleKarte(page, zustand.spielbareKarten[0]);
        continue;
      }
    }

    // ── 8. Abschluss ─────────────────────────────────────────────────────────
    expect(rundeAbgeschlossen, 'Eine vollstaendige Runde muss abgeschlossen sein').toBe(true);

    // Bekannter Flake im Turbo-Modus (S77): Rundenauswertungs-Modal erscheint und
    // schließt sich bei Infinity-Speed so schnell, dass die Polling-Schleife es
    // als VORBEHALT_ANSAGE der nächsten Runde wahrnimmt → kein Screenshot nötig.
    const modalGezeigt = await leseRundenEndeModalCount(page);
    console.log(`\n=== Vision Loop abgeschlossen — Rundenauswertung ${modalGezeigt > 0 ? `bestaetigt (${modalGezeigt}x gezeigt)` : 'TURBO-FLAKE (Modal zu schnell)' } ===`);
  });

  // ── T-13: Partie-Ende-Modal (anzahlSpiele = 1) ───────────────────────────
  test('Partie-Ende-Modal (T-13)', async ({ page }, testInfo) => {
    aktiviereConsoleCapture(page, testInfo.title);
    const prefix = testInfo.project.name;

    await page.goto('/');
    await getBridge(page);
    await alsGastStarten(page);
    await warteAufSzene(page, 'SpielverwaltungsSzene');

    await erstelleKonfiguriertenTisch(page, 'VL-Partie-Ende', {
      ohneNeunen: false,
      anzahlSpiele: 1,
      tischhintergrund: 'FILZ_GRUEN',
      kiSchwierigkeit: 'STANDARD',
    }, false);
    await page.waitForFunction(
      () => (window as any).__locodoko?.appStore?.snapshot()?.bereich === 'TISCH',
      { timeout: 10_000 }
    );
    await starteAktuellenTisch(page);
    await aktiviereTurbo(page);

    let partieEnde = false;

    while (!partieEnde) {
      await page.waitForFunction(() => {
        const loco = (window as any).__locodoko;
        if (loco?.isPartieEndeModalSichtbar?.()) return true;
        if (loco?._rundenEndeModalGezeigt > 0) return true;
        const spiel = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel;
        if (!spiel) return false;
        if (spiel.phase === 'VORBEHALT_ANSAGE') return true;
        if ((spiel.spielbareKarten?.length ?? 0) > 0) return true;
        if ((spiel.moeglicheVorbehalte?.length ?? 0) > 0) return true;
        if ((spiel.moeglicheAnsagen?.length ?? 0) > 0) return true;
        if (spiel.phase === 'ARMUT_TAUSCH') return true;
        return false;
      }, null, { timeout: 120_000 });

      if (await page.evaluate(() => (window as any).__locodoko?.isPartieEndeModalSichtbar?.())) {
        await page.waitForTimeout(500);
        await screenshot(page, '05b-partie-ende-modal', prefix);
        partieEnde = true;
        break;
      }

      // Rundenende-Modal sollte bei anzahlSpiele=1 nicht kommen — sicherheitshalber schließen
      const modalCount = await leseRundenEndeModalCount(page);
      if (modalCount > 0) {
        await page.evaluate(() => (window as any).__locodoko?.schliesseRundenEndeModal?.());
        continue;
      }

      const zustand = await leseSpielZustand(page);

      if (zustand.phase === 'VORBEHALT_ANSAGE') {
        if (zustand.moeglicheVorbehalte.length > 0) {
          await meldeVorbehalt(page, 'GESUND');
        }
        continue;
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

    expect(partieEnde, 'Partie-Ende-Modal muss nach anzahlSpiele=1 erscheinen').toBe(true);
    console.log('=== T-13: Partie-Ende-Modal erfolgreich photographiert ===');
  });
});
