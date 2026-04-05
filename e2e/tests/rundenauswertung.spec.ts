/**
 * E2E-Test: Rundenauswertung
 *
 * Prüft ob nach Spielende das Rundenauswertungs-Overlay korrekt erscheint,
 * die wichtigsten Inhalte zeigt und per Button/Enter geschlossen werden kann.
 *
 * Voraussetzung: Backend läuft auf localhost:8080
 *   cd e2e && npx playwright test rundenauswertung.spec.ts
 */

import { test, expect, type Page } from '@playwright/test';

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

test.describe('Rundenauswertung', () => {
  test('Rundenauswertungs-Overlay erscheint nach Spielende und kann geschlossen werden', async ({ page }) => {
    test.setTimeout(120_000);

    // ── 1. Lobby → Quick Game ─────────────────────────────────────────────────
    await page.goto('/');
    await expect(page.locator('button', { hasText: /Quick Game/i })).toBeVisible({ timeout: 20_000 });
    await page.locator('button', { hasText: /Quick Game/i }).click();

    // ── 2. Vorbehalt-Phase durchlaufen ───────────────────────────────────────
    await warteAufPhase(page, 'VORBEHALT_ANSAGE', 20_000);
    await warteAufEigenenVorbehalt(page, 20_000);
    await meldeVorbehalt(page, 'GESUND');

    // ── 3. Alle 12 Stiche spielen (Karten über API ausspielen) ───────────────
    for (let stich = 0; stich < 12; stich++) {
      try {
        await warteAufEigenenZug(page, 25_000);
        await spieleErsteHandkarte(page);
        // kurz warten damit Stich-Animation und KI-Züge durchlaufen
        await page.waitForTimeout(1500);
      } catch {
        // Kein eigener Zug mehr — KI hat letzten Stich übernommen
        break;
      }
    }

    // ── 4. Rundenauswertungs-Overlay prüfen ──────────────────────────────────
    const overlay = page.locator('[data-testid="rundenauswertung-overlay"]');
    await expect(overlay).toBeVisible({ timeout: 30_000 });

    // Kopfzeile: enthält Spieltyp und Spielnummer
    const titel = overlay.locator('h2');
    await expect(titel).toBeVisible();
    const titelText = await titel.textContent();
    expect(titelText).toMatch(/Spiel \d+ von \d+/);

    // Ergebnis-Zeile: enthält gewinnende Partei
    const ergebnisZeile = overlay.locator('strong').first();
    await expect(ergebnisZeile).toBeVisible();
    const ergebnisText = await ergebnisZeile.textContent();
    expect(ergebnisText).toMatch(/(RE|KONTRA) gewinnt/);

    // Weiter-Button ist vorhanden
    const weiterButton = page.locator('[data-testid="btn-rundenauswertung-weiter"]');
    await expect(weiterButton).toBeVisible();

    // ── 5. Overlay per Enter schließen ───────────────────────────────────────
    await page.keyboard.press('Enter');
    await expect(overlay).toBeHidden({ timeout: 5_000 });

    // ── 6. Nächste Runde / Vorbehalt-Phase läuft oder Partie endet ───────────
    // Overlay geschlossen → Spiel läuft weiter
    const naechstePhase = await page.evaluate(() => {
      interface LocodokoBridge { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: { phase?: string } } } } }
      const loco = (window as unknown as Record<string, LocodokoBridge>)['__locodoko'];
      return loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel?.phase ?? null;
    });
    // Spiel ist im Gange (neue Runde oder Gesamtauswertung)
    expect(naechstePhase).not.toBeNull();
  });
});
