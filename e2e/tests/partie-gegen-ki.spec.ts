/**
 * E2E-Test: Partie gegen KI bis zum ersten abgeschlossenen Stich.
 *
 * Wichtig: Dieser Test setzt eine laufende Anwendung voraus (mvn spring-boot:run).
 * Kein Mocking — der Test testet den echten Spielfluss End-to-End.
 * Warum dieser Test wichtig ist: Er sichert den kritischen Pfad ab, der alle
 * Schichten durchquert (Session → Lobby → Tisch → Partie → KI → WebSocket → UI).
 */

import { test, expect, type Page } from '@playwright/test';

// Hilfsfunktion: Klickt die erste spielbare Karte auf dem Phaser-Canvas.
// Position berechnet sich aus dem Tisch-Layout (SUED-Spieler, erste Handkarte).
// kartenX = 32% der Canvas-Breite, kartenY = 89% der Canvas-Hoehe.
async function klickeErsteHandkarte(page: Page): Promise<void> {
  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error('Phaser-Canvas nicht gefunden — ist die Anwendung gestartet?');
  }
  // Erste Handkarte des SUED-Spielers: 32% horizontal, 89% vertikal der Spielflaeche
  const karteX = Math.round(box.x + box.width * 0.32);
  const karteY = Math.round(box.y + box.height * 0.89);
  await page.mouse.click(karteX, karteY);
}

test.describe('Partie gegen KI', () => {
  test('Erste Partie bis zum ersten abgeschlossenen Stich', async ({ page }) => {
    // JavaScript-Fehler in der Browser-Konsole sammeln und am Ende als Fehler werten.
    // Warum: Phaser-Spiele koennen Fehler stumm schlucken — explizite Pruefung notwendig.
    const jsFehler: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        jsFehler.push(`[console.error] ${msg.text()}`);
      }
    });
    page.on('pageerror', (err) => {
      jsFehler.push(`[pageerror] ${err.message}`);
    });

    // -----------------------------------------------------------------------
    // Schritt 1: Anwendung laden — Lobby-Ansicht muss erscheinen
    // -----------------------------------------------------------------------
    await page.goto('/');
    await expect(
      page.locator('button', { hasText: 'Tisch erstellen' }),
      'Tisch-erstellen-Button soll nach dem Laden sichtbar sein',
    ).toBeVisible({ timeout: 10_000 });

    // -----------------------------------------------------------------------
    // Schritt 2: Tisch erstellen
    // -----------------------------------------------------------------------
    await page.fill('input[placeholder*="Tischname"]', 'E2E-Test-Tisch');
    await page.click('button:has-text("Tisch erstellen")');

    // Tischansicht geladen: linkes Panel mit "Spiel starten" ist sichtbar
    await expect(
      page.locator('button', { hasText: 'Spiel starten' }),
      'Nach Tisch erstellen soll TischSzene mit "Spiel starten" sichtbar sein',
    ).toBeVisible({ timeout: 10_000 });

    // Eigene Spielerposition sichtbar (Badge "Du" erscheint in Spielerliste)
    await expect(
      page.locator('.ui-badge--highlight', { hasText: 'Du' }),
      'Eigene Spielerposition (Badge "Du") muss am Tisch sichtbar sein',
    ).toBeVisible();

    // Kein Blur-Zustand — Aktionsbereich ist vorhanden und interaktierbar
    await expect(
      page.locator('[data-aktions-inhalt]'),
      'Aktionsbereich soll sichtbar sein — kein reiner Overlay ohne Inhalt',
    ).toBeVisible();

    // -----------------------------------------------------------------------
    // Schritt 3: Spiel starten — KI-Spieler werden aufgefuellt
    // -----------------------------------------------------------------------
    await page.click('button:has-text("Spiel starten")');

    // Drei KI-Spieler erscheinen in der Spielerliste
    await expect(
      page.locator('.ui-badge', { hasText: 'KI' }),
      'Nach dem Spielstart muessen 3 KI-Spieler am Tisch erscheinen',
    ).toHaveCount(3, { timeout: 10_000 });

    // -----------------------------------------------------------------------
    // Schritt 4: Partie laeuft — Phase VORBEHALT_ANSAGE
    // -----------------------------------------------------------------------
    // Phaser-Canvas rendert Karten (nicht DOM), Vorbehalt-Buttons sind HTML-DOM
    await expect(
      page.locator('[data-phase]'),
      'Spielphase soll nach dem Start auf VORBEHALT_ANSAGE wechseln',
    ).toHaveText('VORBEHALT_ANSAGE', { timeout: 15_000 });

    // Vorbehalt-Buttons erscheinen — beweist, dass 12 Karten ausgeteilt wurden
    await expect(
      page.locator('[data-aktions-inhalt] button', { hasText: 'Gesund' }),
      '"Gesund"-Button erscheint, wenn eigene Hand ausgeteilt und Vorbehalt noetig ist',
    ).toBeVisible({ timeout: 10_000 });

    // -----------------------------------------------------------------------
    // Schritt 5: Vorbehalt "Gesund" waehlen
    // -----------------------------------------------------------------------
    await page.click('[data-aktions-inhalt] button:has-text("Gesund")');

    // Vorbehalt-Dialog verschwindet (eigener Vorbehalt gemeldet)
    await expect(
      page.locator('[data-aktions-inhalt] button', { hasText: 'Gesund' }),
      '"Gesund"-Button soll nach dem Anklicken verschwinden',
    ).not.toBeVisible({ timeout: 10_000 });

    // KI-Spieler melden ihre Vorbehalte automatisch durch KiOrchestrierungService
    // Spielphase wechselt zu STICHPHASE
    await expect(
      page.locator('[data-phase]'),
      'Spielphase soll nach allen Vorbehalten auf STICHPHASE wechseln',
    ).toHaveText('STICHPHASE', { timeout: 15_000 });

    // -----------------------------------------------------------------------
    // Schritt 6: Erste Karte spielen — warten bis SUED an der Reihe ist
    // -----------------------------------------------------------------------
    // KiOrchestrierungService spielt KI-Zuege, bis der menschliche Spieler dran ist.
    // Der Aktionshinweis "Spiele eine der hervorgehobenen Karten" zeigt SUED's Zug an.
    await expect(
      page.locator('[data-aktions-hinweis]'),
      'Aktionshinweis soll anzeigen, dass SUED eine Karte spielen soll',
    ).toContainText('Spiele eine der hervorgehobenen Karten', { timeout: 20_000 });

    // Erste Handkarte des SUED-Spielers auf dem Phaser-Canvas anklicken
    await klickeErsteHandkarte(page);

    // Nachweis: Aktionshinweis wechselt (Karte wurde akzeptiert, KI ist dran oder Stich laeuft)
    await expect(
      page.locator('[data-aktions-hinweis]'),
      'Nach dem Spielen der Karte soll der Aktionshinweis wechseln (Stich laeuft)',
    ).not.toContainText('Spiele eine der hervorgehobenen Karten', { timeout: 10_000 });

    // -----------------------------------------------------------------------
    // Schritt 7: KI spielt den Stich zu Ende — Stich-Zaehler erhoehen
    // -----------------------------------------------------------------------
    // Nachweis: Mindestens ein Spieler hat nach dem ersten Stich "1 Stiche" im DOM
    await expect(
      page.locator('.ui-list-item__meta'),
      'Nach dem ersten Stich soll mindestens ein Spieler "1 Stiche" anzeigen',
    ).toContainText('1 Stiche', { timeout: 20_000 });

    // -----------------------------------------------------------------------
    // Abschlusskontrolle: Keine JavaScript-Fehler waehrend des gesamten Tests
    // -----------------------------------------------------------------------
    expect(
      jsFehler,
      `JavaScript-Fehler sind aufgetreten:\n${jsFehler.join('\n')}`,
    ).toHaveLength(0);
  });
});
