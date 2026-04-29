/**
 * Vision-Loop: Screenshot-Capture fuer UI-Review durch Ralph.
 *
 * Navigiert automatisch durch alle wichtigen Spielzustaende und speichert
 * Screenshots in e2e/screenshots/. 
 */

import { test, expect, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const SCREENSHOTS_DIR = path.join(__dirname, '..', 'screenshots');

async function screenshot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  const dateiPfad = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: dateiPfad, fullPage: false });
}

async function warteAufPhase(page: Page, phase: string, timeoutMs = 20_000): Promise<void> {
  await page.waitForFunction(
    (gesuchtePhase: string) => {
      interface LocodokoBridge { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: { phase?: string } } } } }
      const loco = (window as unknown as Record<string, LocodokoBridge>)['__locodoko'];
      return loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel?.phase === gesuchtePhase;
    },
    phase,
    { timeout: timeoutMs }
  );
}

async function warteAufEigenenZug(page: Page, timeoutMs = 20_000): Promise<void> {
  await page.waitForFunction(
    () => {
      interface LocodokoBridge { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: { spielbareKarten?: unknown[]; phase?: string } } } } }
      const loco = (window as unknown as Record<string, LocodokoBridge>)['__locodoko'];
      const snap = loco?.appStore?.snapshot();
      const spiel = snap?.partieStand?.laufendesSpiel;
      return spiel?.phase === 'STICHPHASE' && (spiel?.spielbareKarten?.length ?? 0) > 0;
    },
    { timeout: timeoutMs }
  );
}

async function spieleErsteHandkarte(page: Page): Promise<void> {
  await page.evaluate(() => {
    interface LocodokoBridge { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: { spielbareKarten?: { id: string }[] } } }; spieleKarte: (id: string) => void } }
    const loco = (window as unknown as Record<string, LocodokoBridge>)['__locodoko'];
    const spielbareKarten = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel?.spielbareKarten;
    if (spielbareKarten?.length) {
      loco.appStore.spieleKarte(spielbareKarten[0].id);
    }
  });
}

async function warteAufEigenenVorbehalt(page: Page, timeoutMs = 20_000): Promise<void> {
  await page.waitForFunction(
    () => {
      interface LocodokoBridge { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: { moeglicheVorbehalte?: unknown[] } } } } }
      const loco = (window as unknown as Record<string, LocodokoBridge>)['__locodoko'];
      const vorbehalte = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel?.moeglicheVorbehalte;
      return (vorbehalte?.length ?? 0) > 0;
    },
    { timeout: timeoutMs }
  );
}

async function meldeVorbehalt(page: Page, vorbehalt: string): Promise<void> {
  await page.evaluate((v: string) => {
    interface LocodokoBridge { appStore: { meldeVorbehalt: (v: string) => void } }
    const loco = (window as unknown as Record<string, LocodokoBridge>)['__locodoko'];
    loco?.appStore?.meldeVorbehalt(v);
  }, vorbehalt);
}

test.describe('Vision Loop — UI Screenshots', () => {
  test('Alle wichtigen Spielzustaende screenshotten', async ({ page }) => {
    page.on('console', msg => console.log('BROWSER:', msg.text()));
    console.log('Navigating to /...');
    await page.goto('/');
    
    await page.evaluate(async () => {
        const loco = (window as any).__locodoko;
        if (loco) {
            await loco.appStore.alsGastStarten();
        }
    });

    await expect(page.locator('[data-testid="startscreen"]')).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(2000);
    console.log('Taking debug-start screenshot...');
    await screenshot(page, 'debug-start');
    await screenshot(page, '01-lobby');

    // ── 1. Offene Tische ────────────────────────────────────────────────────
    console.log('Opening Offene Tische...');
    const btnOffeneTische = page.locator('[data-testid="btn-offene-tische"]');
    await expect(btnOffeneTische).toBeVisible();
    await btnOffeneTische.click({ force: true });
    await page.waitForTimeout(1000);
    await screenshot(page, '11-offene-tische');
    await page.click('[data-testid="btn-offene-tische"]'); // Wieder zu

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
    
    // Fokus auf Spielbereich
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
    await warteAufPhase(page, 'VORBEHALT_ANSAGE');
    await page.waitForTimeout(1500); // Animationen abwarten
    await screenshot(page, '02-vorbehalt-phase');

    console.log('Waiting for own Vorbehalt choice...');
    await warteAufEigenenVorbehalt(page);
    console.log('Reporting GESUND...');
    await meldeVorbehalt(page, 'GESUND');

    // ── 6. Stichphase — eigener Zug ───────────────────────────────────────────
    console.log('Waiting for own move (STICHPHASE)...');
    await warteAufEigenenZug(page, 30_000);
    console.log('Taking screenshot 03-stichphase-eigener-zug...');
    await page.waitForTimeout(1000);
    await screenshot(page, '03-stichphase-eigener-zug');

    // ── 7. Karte ausspielen ───────────────────────────────────────────────────
    console.log('Playing first card...');
    await spieleErsteHandkarte(page);
    await page.waitForTimeout(3000); // Stich-Animation abwarten
    await screenshot(page, '04-nach-stich');

    console.log(`\n=== Vision Loop abgeschlossen ===`);
  });
});
