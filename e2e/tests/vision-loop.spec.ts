/**
 * Vision-Loop: Screenshot-Capture fuer UI-Review durch Ralph.
 *
 * Navigiert automatisch durch alle wichtigen Spielzustaende und speichert
 * Screenshots in e2e/screenshots/. Ralph kann diese mit dem Read-Tool
 * einlesen und UI-Probleme ohne manuelle Screenshots identifizieren.
 *
 * Ausfuehren (Backend muss laufen):
 *   cd e2e && npx playwright test vision-loop.spec.ts --headed
 *
 * Screenshots landen in: e2e/screenshots/
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

async function warteAufPhase(page: Page, phase: string, timeoutMs = 15_000): Promise<void> {
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

async function warteAufEigenenZug(page: Page, timeoutMs = 15_000): Promise<void> {
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

async function warteAufEigenenVorbehalt(page: Page, timeoutMs = 15_000): Promise<void> {
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
    // ── 1. Lobby ─────────────────────────────────────────────────────────────
    console.log('Navigating to /...');
    await page.goto('/');
    console.log('Waiting for Quick Game button...');
    await expect(page.locator('button', { hasText: /Quick Game/i })).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(500);
    await screenshot(page, '01-lobby');

    // ── 2. Quick Game starten ─────────────────────────────────────────────────
    console.log('Starting Quick Game...');
    const quickGameBtn = page.locator('button', { hasText: /Quick Game/i });
    if (await quickGameBtn.isVisible()) {
      await quickGameBtn.click();
    } else {
      // Fallback: manuell Tisch erstellen und starten
      console.log('Fallback: Creating new table...');
      await page.click('button:has-text("Neuen Tisch erstellen")');
      await page.waitForSelector('#tisch-name', { timeout: 5_000 });
      await page.fill('#tisch-name', 'Vision-Loop-Tisch');
      await page.click('#modal-submit');
      await page.waitForSelector('[data-start-button]', { timeout: 10_000 });
      await page.click('[data-start-button]');
    }

    await expect(page.locator('[data-testid="tischszene"]')).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1000); // Warten bis Szene initialisiert

    // ── 3. Overlays screenshotten (bevor das Spiel voranschreitet) ───────────
    console.log('Opening Seitenlade...');
    await page.keyboard.press('i');
    await page.waitForTimeout(500);
    await screenshot(page, '07-seitenlade-offen');
    await page.keyboard.press('i');
    await page.waitForTimeout(200);

    console.log('Opening Einstellungs-Modal...');
    await page.keyboard.press('s');
    await page.waitForTimeout(500);
    await screenshot(page, '08-einstellungen-modal');
    await page.keyboard.press('Escape'); // Sicherer Schliessen
    await page.waitForTimeout(400);

    // ── 4. Vorbehalt-Phase ────────────────────────────────────────────────────
    console.log('Waiting for phase VORBEHALT_ANSAGE...');
    await warteAufPhase(page, 'VORBEHALT_ANSAGE', 20_000);
    await page.waitForTimeout(800); // Austeilen-Animation abwarten
    await screenshot(page, '02-vorbehalt-phase');

    // Eigenen Vorbehalt ansagen (GESUND = kein Vorbehalt) — erst wenn Spieler an der Reihe
    console.log('Waiting for own Vorbehalt choice...');
    await warteAufEigenenVorbehalt(page, 20_000);
    console.log('Reporting GESUND...');
    await meldeVorbehalt(page, 'GESUND');
    await page.waitForTimeout(500);

    // ── 4. Stichphase — eigener Zug ───────────────────────────────────────────
    console.log('Waiting for own move (STICHPHASE)...');
    await warteAufEigenenZug(page, 20_000);
    console.log('Taking screenshot 03-stichphase-eigener-zug...');
    await page.waitForTimeout(400);
    await screenshot(page, '03-stichphase-eigener-zug');

    // ── 5. Karte ausspielen ───────────────────────────────────────────────────
    console.log('Playing first card...');
    await spieleErsteHandkarte(page);
    await page.waitForTimeout(2500); // Stich-Animation (1s warten + 600ms einziehen + Puffer)
    await screenshot(page, '04-nach-stich');

    // ── 6. Naechster eigener Zug (falls vorhanden) ────────────────────────────
    try {
      console.log('Waiting for next own move (optional)...');
      await warteAufEigenenZug(page, 8_000);
      await page.waitForTimeout(400);
      await screenshot(page, '05-naechster-zug');

      // Noch eine Karte spielen
      console.log('Playing second card...');
      await spieleErsteHandkarte(page);
      await page.waitForTimeout(2500);
      await screenshot(page, '06-nach-zweitem-stich');
    } catch {
      // Kein eigener Zug mehr in diesem Zeitraum — kein Problem
      console.log('No second move in time.');
    }

    // ── 9. Armut-Phase (falls sie auftritt) ──────────────────────────────────
    // Da Armut selten ist, versuchen wir sie hier nur zu erfassen wenn sie aktiv ist
    // In einem echten Vision-Loop wuerde man sie evtl. provozieren.

    // Ausgabe der Screenshot-Pfade fuer Ralph
    const screenshots = fs.readdirSync(SCREENSHOTS_DIR).filter((f) => f.endsWith('.png'));
    console.log(`\n=== Vision Loop abgeschlossen ===`);
    console.log(`Screenshots in: ${SCREENSHOTS_DIR}`);
    screenshots.forEach((f) => console.log(`  ${SCREENSHOTS_DIR}/${f}`));
  });

  test('Rundenauswertung-Overlay screenshotten', async ({ page }) => {
    test.setTimeout(300_000);

    // ── 1. Quick Game starten ─────────────────────────────────────────────────
    await page.goto('/');
    await expect(page.locator('button', { hasText: /Quick Game/i })).toBeVisible({ timeout: 20_000 });
    await page.locator('button', { hasText: /Quick Game/i }).click();
    await expect(page.locator('[data-testid="tischszene"]')).toBeVisible({ timeout: 15_000 });

    // ── 2. Sofort auf Turbo schalten ──────────────────────────────────────────
    // reduziereRendering wird NICHT verwendet — bei 60fps funktioniert die
    // Tastatursteuerung zuverlaessiger, und das Spiel endet in unter 90s.
    await page.waitForFunction(() => {
      const b = (window as unknown as Record<string, Record<string, unknown>>)['__locodoko'];
      return typeof b?.['setzeAnimationsGeschwindigkeit'] === 'function';
    }, undefined, { timeout: 10_000 });
    await page.evaluate(() => {
      const bridge = (window as unknown as Record<string, Record<string, unknown>>)['__locodoko'];
      (bridge['setzeAnimationsGeschwindigkeit'] as (f: number) => void)(Infinity);
    });

    // ── 3. Spiel durchspielen bis Overlay erscheint ───────────────────────────
    let overlayGefunden = false;
    for (let i = 0; i < 600; i++) {
      const zustand = await page.evaluate(() => {
        const el = document.querySelector('[data-testid="rundenauswertung-overlay"]') as HTMLElement | null;
        const overlayVisible = !!el && !el.hidden;
        interface B { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: {
          spielbareKarten?: unknown[]; phase?: string; moeglicheVorbehalte?: unknown[];
        } } } } }
        const loco = (window as unknown as Record<string, B>)['__locodoko'];
        const spiel = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel;
        return {
          overlayVisible,
          phase: spiel?.phase ?? null,
          spielbareKarten: spiel?.spielbareKarten?.length ?? 0,
          moeglicheVorbehalte: spiel?.moeglicheVorbehalte?.length ?? 0,
        };
      }).catch(() => null);

      if (!zustand) { await page.waitForTimeout(500); continue; }
      if (zustand.overlayVisible) { overlayGefunden = true; break; }

      if (zustand.moeglicheVorbehalte > 0) {
        await page.keyboard.press('1');
        await page.waitForTimeout(200);
        continue;
      }
      if (zustand.phase === 'ARMUT_TAUSCH') {
        await screenshot(page, '10-armut-phase');
        await page.keyboard.press('n');
        await page.waitForTimeout(300);
        continue;
      }
      if (zustand.phase === 'STICHPHASE' && zustand.spielbareKarten > 0) {
        await page.keyboard.press('Enter');
        await page.waitForTimeout(200);
        continue;
      }
      await page.waitForTimeout(500);
    }

    // ── 4. Screenshot ─────────────────────────────────────────────────────────
    expect(overlayGefunden, 'Rundenauswertung-Overlay muss sichtbar sein').toBeTruthy();
    await page.waitForTimeout(500);
    await screenshot(page, '09-rundenauswertung-overlay');
    console.log(`\n=== Rundenauswertung-Screenshot ===`);
    console.log(`  ${SCREENSHOTS_DIR}/09-rundenauswertung-overlay.png`);
  });
});
