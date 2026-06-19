/**
 * E2E-Test: Echte Maus-Klicks auf dem Canvas (kein Bridge-Trigger).
 *
 * Warum dieser Test wichtig ist: Die bestehende Suite triggert Buttons ausschließlich
 * via window.__locodoko.drueckeSzenenButton (ruft btn.trigger() direkt auf) und spielt
 * Karten per Tastatur — das echte Pointer-Hit-Testing von Phaser wird nie verifiziert.
 * Diese Lücke wurde in Session 139 bei der Phaser-4-Migration entdeckt, als ein
 * vermuteter Input-Bug nur per echtem Klick reproduzierbar war.
 *
 * Abgedeckte Pfade:
 * (a) Schnellstart-Button per Mausklick → TischSzene
 * (b) Beitreten eines wartenden Tischs (zweiter Gast-Kontext) per Mausklick → TischSzene
 * (c) Handkarte per Mausklick spielen (Polling: Karten sind während Animationen gesperrt)
 */

import { test, expect, type Page } from '@playwright/test';
import {
  alsGastStarten,
  aktiviereTurbo,
  getBridge,
  warteAufEigenenVorbehalt,
  warteAufSzene,
  aktiviereConsoleCapture,
  leseHudZustand,
  erstelleKonfiguriertenTisch,
} from './helpers';

// ── Lokale Hilfsfunktionen (nur für diesen Spec — kein Code in src/) ─────────

/**
 * Liefert Canvas-Offset und Skalierungsfaktor auf der Seite.
 * Nötig, weil FIT-Modus die Canvas-Größe an den Viewport anpasst.
 */
async function ermittleCanvasTransform(page: Page): Promise<{ offsetX: number; offsetY: number; scaleX: number; scaleY: number }> {
  const box = await page.locator('canvas').boundingBox();
  if (!box) throw new Error('Canvas nicht auf der Seite gefunden');
  return {
    offsetX: box.x,
    offsetY: box.y,
    scaleX: box.width / 1280,
    scaleY: box.height / 720,
  };
}

/**
 * Echter Mausklick auf ein benanntes Phaser-Objekt.
 * Koordinaten via window.__locodoko.gibObjektBounds() (Weltkoordinaten → Seitenkoordinaten).
 */
async function klickeObjekt(page: Page, name: string): Promise<void> {
  const pos = await page.evaluate(
    (n: string) => (window as any).__locodoko?.gibObjektBounds?.(n),
    name,
  );
  if (!pos) throw new Error(`Phaser-Objekt '${name}' nicht in der aktiven Szene gefunden`);
  const { offsetX, offsetY, scaleX, scaleY } = await ermittleCanvasTransform(page);
  await page.mouse.click(
    offsetX + pos.x * scaleX,
    offsetY + pos.y * scaleY,
  );
}

/**
 * Echter Mausklick auf die erste spielbare Handkarte mit Polling.
 * Polling nötig: Karten sind während Animationen bewusst nicht interaktiv
 * (TischKartenRenderer: istInteraktiv = !animationAktiv && spielbar).
 */
async function klickeErsteSpielkarte(page: Page, timeoutMs = 15_000): Promise<void> {
  const frist = Date.now() + timeoutMs;
  while (Date.now() < frist) {
    const ergebnis = await page.evaluate(() => {
      const loco = (window as any).__locodoko;
      if (!loco?.isIdle?.()) return null;
      const spiel = loco.appStore?.snapshot()?.partieStand?.laufendesSpiel;
      const karteId: string | undefined = spiel?.spielbareKarten?.[0]?.id;
      if (!karteId) return null;
      return loco.gibKartenPosition?.(karteId) ?? null;
    });
    if (ergebnis) {
      const { offsetX, offsetY, scaleX, scaleY } = await ermittleCanvasTransform(page);
      await page.mouse.click(
        offsetX + ergebnis.x * scaleX,
        offsetY + ergebnis.y * scaleY,
      );
      return;
    }
    await page.waitForTimeout(200);
  }
  throw new Error('klickeErsteSpielkarte: Timeout — keine interaktive Spielkarte gefunden');
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Echte Maus-Klicks', () => {

  test('(a) Schnellstart-Button per Mausklick startet Partie', async ({ page }, testInfo) => {
    aktiviereConsoleCapture(page, testInfo.title);

    // Login via Bridge — die Login-UI ist ein DOM-Overlay, kein Phaser-Canvas
    await page.goto('/');
    await getBridge(page);
    await warteAufSzene(page, 'LoginSzene');
    await alsGastStarten(page);
    await warteAufSzene(page, 'SpielverwaltungsSzene');

    // Echter Mausklick auf den Schnellstart-Button im Phaser-Canvas.
    // Verifiziert, dass Phaser-Input das Pointer-Event korrekt verarbeitet.
    await klickeObjekt(page, 'btn-quick-game');

    await warteAufSzene(page, 'TischSzene', 15_000);
  });

  test('(b) Beitreten-Button per Mausklick (zweiter Gast-Kontext)', async ({ browser, page }, testInfo) => {
    aktiviereConsoleCapture(page, testInfo.title);

    // ── Spieler 1: Tisch erstellen ──────────────────────────────────────────
    // Warum: Nicht-QuickGame-Tisch erscheint in der Tischliste und kann beigetreten werden.
    await page.goto('/');
    await getBridge(page);
    await warteAufSzene(page, 'LoginSzene');
    await alsGastStarten(page);
    await erstelleKonfiguriertenTisch(page, 'Klick-Test-Tisch', { anzahlSpiele: 2 }, false);
    await warteAufSzene(page, 'TischSzene', 15_000);

    const tischId = await page.evaluate(
      () => (window as any).__locodoko?.appStore?.snapshot()?.aktuellerTisch?.id ?? null,
    );
    expect(tischId, 'Tisch-ID muss nach Erstellung vorhanden sein').toBeTruthy();

    // ── Spieler 2: Beitreten-Button per echtem Mausklick ─────────────────
    const kontext2 = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const seite2 = await kontext2.newPage();
    aktiviereConsoleCapture(seite2, `${testInfo.title}-gast2`);

    try {
      await seite2.goto('/');
      await getBridge(seite2);
      await warteAufSzene(seite2, 'LoginSzene');
      await alsGastStarten(seite2);
      await warteAufSzene(seite2, 'SpielverwaltungsSzene');

      // Explizite Listenaktualisierung, damit der neue Tisch sicher erscheint
      await seite2.evaluate(async () => {
        await (window as any).__locodoko?.appStore?.aktualisiereTischliste?.();
      });

      await seite2.waitForFunction(
        (id: string) =>
          (window as any).__locodoko?.appStore?.snapshot()?.tische?.some((t: any) => t.id === id),
        tischId,
        { timeout: 15_000 },
      );

      // Echter Klick auf Beitreten-Button des spezifischen Tischs (testId: btn-beitreten-{tischId})
      await klickeObjekt(seite2, `btn-beitreten-${tischId}`);

      // Verify: Spieler 2 betritt den Tisch erfolgreich
      await warteAufSzene(seite2, 'TischSzene', 15_000);
    } finally {
      await kontext2.close();
    }
  });

  test('(c) Handkarte per Mausklick spielen (Polling wegen Animationen)', async ({ page }, testInfo) => {
    aktiviereConsoleCapture(page, testInfo.title);

    // QuickGame via Bridge starten (Klick selbst ist Gegenstand von Test (a))
    await page.goto('/');
    await getBridge(page);
    await warteAufSzene(page, 'LoginSzene');
    await alsGastStarten(page);
    await warteAufSzene(page, 'SpielverwaltungsSzene');
    await page.evaluate(async () => {
      await (window as any).__locodoko.appStore.erstelleQuickGame();
    });
    await warteAufSzene(page, 'TischSzene', 15_000);
    await aktiviereTurbo(page);

    // Vorbehalt per Tastatur (erste Option = GESUND)
    await warteAufEigenenVorbehalt(page, 20_000);
    await page.locator('canvas').focus();
    await page.keyboard.press('1');

    // Echter Mausklick auf die erste spielbare Karte.
    // Polling nötig: Karten sind bis zum Ende aller Animationen deaktiviert.
    await klickeErsteSpielkarte(page);

    // Verify: Stichzähler zeigt nach dem Kartenklick den ersten abgeschlossenen Stich
    await page.waitForFunction(
      () => (window as any).__locodoko?.getHudState?.()?.stichzaehler?.includes('Stich 1/'),
      { timeout: 20_000 },
    );
    const hud = await leseHudZustand(page);
    expect(hud.stichzaehler, 'Stichzähler muss "Stich 1/..." zeigen').toMatch(/Stich 1\//);
  });

});
