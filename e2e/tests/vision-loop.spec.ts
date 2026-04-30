/**
 * Vision-Loop: Screenshot-Capture fuer UI-Review durch Ralph.
 *
 * Navigiert automatisch durch alle wichtigen Spielzustaende und speichert
 * Screenshots in e2e/screenshots/.
 * Schritt 8 spielt eine vollstaendige Runde durch und prueft das Rundenauswertungs-Overlay.
 */

import { test, expect, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import {
  alsGastStarten,
  getBridge,
  aktiviereTurbo,
  leseSpielZustand,
  leseRundenEndeModalCount,
  warteAufPhase,
  warteAufEigenenVorbehalt,
  warteAufEigenenZug,
  spieleErsteHandkarte,
  spieleKarte,
  meldeVorbehalt,
  beantworteArmut,
  aktiviereConsoleCapture,
} from './helpers';

const SCREENSHOTS_DIR = path.join(__dirname, '..', 'screenshots');

async function screenshot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  const dateiPfad = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: dateiPfad, fullPage: false });
}

test.describe('Vision Loop — UI Screenshots', () => {
  test('Alle wichtigen Spielzustaende screenshotten', async ({ page }, testInfo) => {
    aktiviereConsoleCapture(page, testInfo.title);
    page.on('console', msg => console.log('BROWSER:', msg.text()));

    console.log('Navigating to /...');
    await page.goto('/');
    await getBridge(page);
    await alsGastStarten(page);

    await expect(page.locator('[data-testid="startscreen"]')).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(2000);
    await screenshot(page, 'debug-start');
    await screenshot(page, '01-lobby');

    // ── 1. Offene Tische ────────────────────────────────────────────────────
    console.log('Opening Offene Tische...');
    const btnOffeneTische = page.locator('[data-testid="btn-offene-tische"]');
    await expect(btnOffeneTische).toBeVisible();
    await btnOffeneTische.click({ force: true });
    await page.waitForTimeout(1000);
    await screenshot(page, '11-offene-tische');
    await page.click('[data-testid="btn-offene-tische"]');

    // ── 2. Neuen Tisch Modal ────────────────────────────────────────────────
    console.log('Opening Erstelle Tisch Modal...');
    await page.click('[data-testid="btn-neuer-tisch"]');
    await page.waitForTimeout(1000);
    await screenshot(page, '12-neuer-tisch-modal');
    await page.click('#btn-abbrechen');

    // ── 3. Quick Game starten ─────────────────────────────────────────────────
    console.log('Starting Quick Game...');
    await page.click('[data-testid="btn-quick-game"]');
    await expect(page.locator('[data-testid="tischszene"]')).toBeVisible({ timeout: 25_000 });
    await aktiviereTurbo(page);
    await page.mouse.click(640, 360);

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

    // ── 5. Vorbehalt-Phase ────────────────────────────────────────────────────
    console.log('Waiting for phase VORBEHALT_ANSAGE...');
    await warteAufPhase(page, 'VORBEHALT_ANSAGE', 30_000);
    await page.waitForTimeout(500);
    await screenshot(page, '02-vorbehalt-phase');

    console.log('Waiting for own Vorbehalt choice...');
    await warteAufEigenenVorbehalt(page);
    await meldeVorbehalt(page, 'GESUND');

    // ── 6. Stichphase — eigener Zug ───────────────────────────────────────────
    console.log('Waiting for own move (STICHPHASE)...');
    await warteAufEigenenZug(page, 30_000);
    await screenshot(page, '03-stichphase-eigener-zug');

    // ── 7. Erste Karte ausspielen ─────────────────────────────────────────────
    console.log('Playing first card...');
    await spieleErsteHandkarte(page);
    await page.waitForTimeout(300);
    await screenshot(page, '04-nach-erster-karte');

    // ── 8. Volles Spiel bis Rundenauswertungs-Overlay ─────────────────────────
    console.log('Playing full game until Rundenauswertungs-Overlay...');
    let warInStichphase = true; // Wir haben bereits eine Karte in der STICHPHASE gespielt
    let rundeAbgeschlossen = false;
    let letztePhase = 'STICHPHASE';
    let rundenauswertungScreenshotGemacht = false;

    for (let i = 0; i < 1500 && !rundeAbgeschlossen; i++) {
      const zustand = await leseSpielZustand(page);

      if (zustand.phase !== letztePhase) {
        console.log(`[i=${i}] Phase=${zustand.phase}`);
        letztePhase = zustand.phase ?? '';
      }

      // Rundenauswertungs-Overlay screenshotten sobald es zum ersten Mal erscheint
      if (!rundenauswertungScreenshotGemacht) {
        const modalCount = await leseRundenEndeModalCount(page);
        if (modalCount > 0) {
          rundenauswertungScreenshotGemacht = true;
          await screenshot(page, '05-rundenauswertung-overlay');
          console.log('Screenshot: 05-rundenauswertung-overlay');
        }
      }

      if (warInStichphase && zustand.phase === 'VORBEHALT_ANSAGE') {
        rundeAbgeschlossen = true;
        break;
      }
      if (zustand.phase === 'STICHPHASE') warInStichphase = true;

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

      await page.waitForTimeout(100);
    }

    // ── 9. Rundenauswertungs-Overlay pruefen ─────────────────────────────────
    expect(rundeAbgeschlossen, 'Eine vollstaendige Runde muss abgeschlossen sein').toBe(true);

    const modalGezeigt = await leseRundenEndeModalCount(page);
    expect(modalGezeigt, 'Rundenauswertungs-Overlay muss nach Spielende angezeigt worden sein').toBeGreaterThan(0);

    // Fallback-Screenshot falls das Overlay noch sichtbar ist
    if (!rundenauswertungScreenshotGemacht) {
      const overlay = page.locator('[data-testid="rundenauswertung-overlay"]');
      if (await overlay.isVisible()) {
        await screenshot(page, '05-rundenauswertung-overlay');
      }
    }

    console.log(`\n=== Vision Loop abgeschlossen — Rundenauswertung bestaetigt (${modalGezeigt}x gezeigt) ===`);
  });
});
