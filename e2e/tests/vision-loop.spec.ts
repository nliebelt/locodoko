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
    await page.goto('/');
    await expect(page.locator('button', { hasText: 'Tisch erstellen' })).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(500);
    await screenshot(page, '01-lobby');

    // ── 2. Quick Game starten ─────────────────────────────────────────────────
    const quickGameBtn = page.locator('button', { hasText: /Quick Game/i });
    if (await quickGameBtn.isVisible()) {
      await quickGameBtn.click();
    } else {
      // Fallback: manuell Tisch erstellen und starten
      await page.fill('input[placeholder*="Tischname"]', 'Vision-Loop-Tisch');
      await page.click('button:has-text("Tisch erstellen")');
      await page.waitForTimeout(1000);
      await page.click('button:has-text("Starten")');
    }

    // ── 3. Vorbehalt-Phase ────────────────────────────────────────────────────
    await warteAufPhase(page, 'VORBEHALT_ANSAGE', 20_000);
    await page.waitForTimeout(800); // Austeilen-Animation abwarten
    await screenshot(page, '02-vorbehalt-phase');

    // Eigenen Vorbehalt ansagen (GESUND = kein Vorbehalt)
    await meldeVorbehalt(page, 'GESUND');
    await page.waitForTimeout(500);

    // ── 4. Stichphase — eigener Zug ───────────────────────────────────────────
    await warteAufEigenenZug(page, 20_000);
    await page.waitForTimeout(400);
    await screenshot(page, '03-stichphase-eigener-zug');

    // ── 5. Karte ausspielen ───────────────────────────────────────────────────
    await spieleErsteHandkarte(page);
    await page.waitForTimeout(2500); // Stich-Animation (1s warten + 600ms einziehen + Puffer)
    await screenshot(page, '04-nach-stich');

    // ── 6. Naechster eigener Zug (falls vorhanden) ────────────────────────────
    try {
      await warteAufEigenenZug(page, 8_000);
      await page.waitForTimeout(400);
      await screenshot(page, '05-naechster-zug');

      // Noch eine Karte spielen
      await spieleErsteHandkarte(page);
      await page.waitForTimeout(2500);
      await screenshot(page, '06-nach-zweitem-stich');
    } catch {
      // Kein eigener Zug mehr in diesem Zeitraum — kein Problem
    }

    // ── 7. Seitenlade oeffnen ─────────────────────────────────────────────────
    await page.click('[data-seitenlade-toggle]').catch(() => {});
    await page.waitForTimeout(300);
    await screenshot(page, '07-seitenlade-offen');

    // Seitenlade schliessen
    await page.click('[data-seitenlade-toggle]').catch(() => {});
    await page.waitForTimeout(200);

    // ── 8. Einstellungs-Modal ─────────────────────────────────────────────────
    await page.click('[data-einstellungen-toggle]').catch(() => {});
    await page.waitForTimeout(300);
    await screenshot(page, '08-einstellungen-modal');
    await page.click('[data-einstellungen-toggle]').catch(() => {});

    // Ausgabe der Screenshot-Pfade fuer Ralph
    const screenshots = fs.readdirSync(SCREENSHOTS_DIR).filter((f) => f.endsWith('.png'));
    console.log(`\n=== Vision Loop abgeschlossen ===`);
    console.log(`Screenshots in: ${SCREENSHOTS_DIR}`);
    screenshots.forEach((f) => console.log(`  ${SCREENSHOTS_DIR}/${f}`));
  });
});
