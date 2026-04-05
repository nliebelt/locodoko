/**
 * E2E-Test: Partie gegen KI bis zum ersten abgeschlossenen Stich.
 *
 * Wichtig: Dieser Test setzt eine laufende Anwendung voraus (mvn spring-boot:run).
 * Kein Mocking — der Test testet den echten Spielfluss End-to-End.
 * Warum dieser Test wichtig ist: Er sichert den kritischen Pfad ab, der alle
 * Schichten durchquert (Session → Lobby → Tisch → Partie → KI → WebSocket → UI).
 */

import { test, expect, type Page } from '@playwright/test';

// Hilfsfunktion: Spielt die erste spielbare Handkarte des menschlichen Spielers per Tastatur aus.
// ArrowRight waehlt die erste Karte (Index 0), Enter spielt sie aus.
// Der TischSzene-Tastatur-Handler ist auf document registriert, kein Canvas-Fokus noetig.
async function spieleErsteHandkarte(page: Page): Promise<void> {
  await page.keyboard.press('ArrowRight'); // erste spielbare Karte markieren
  await page.keyboard.press('Enter');      // Karte ausspielen
}

test.describe('Partie gegen KI', () => {
  test('Erste Partie bis zum ersten abgeschlossenen Stich', async ({ page }) => {
    // JavaScript-Fehler in der Browser-Konsole sammeln und am Ende als Fehler werten.
    // Warum: Phaser-Spiele koennen Fehler stumm schlucken — explizite Pruefung notwendig.
    const jsFehler: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        jsFehler.push(`[console.${msg.type()}] ${msg.text()}`);
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
    ).toBeVisible({ timeout: 20_000 });

    // Warten, bis das Eingabefeld fuer den Tisch Namen sichtbar und interaktierbar ist
    await page.waitForSelector('input[placeholder*="Tischname"]', { state: 'visible', timeout: 30_000 });
    await page.fill('input[placeholder*="Tischname"]', 'E2E-Test-Tisch');

    // Warten, bis der Tisch erstellen Button sichtbar und interaktierbar ist, bevor geklickt wird
    await page.click('button:has-text("Tisch erstellen")');
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
    // Der Aktionshinweis lautet im STICHPHASE-Zug von SUED:
    // "Du bist dran. Spiel eine serverseitig erlaubte Karte oder taetige eine Ansage."
    await expect(
      page.locator('[data-aktions-hinweis]'),
      'Aktionshinweis soll anzeigen, dass SUED eine Karte spielen soll',
    ).toContainText('Du bist dran.', { timeout: 20_000 });

    // Erste spielbare Karte per Tastatur (ArrowRight + Enter) ausspielen
    await spieleErsteHandkarte(page);

    // -----------------------------------------------------------------------
    // Schritt 7: KI spielt den Stich zu Ende — Stich-Zaehler erhoehen
    // -----------------------------------------------------------------------
    // Nachweis: Mindestens ein Spieler hat nach dem ersten Stich "1 Stiche" im DOM.
    // .filter() statt direkte Text-Pruefung: verhindert Strict-Mode-Violation
    // bei mehreren .ui-list-item__meta-Elementen (Spielerliste + Punktestand).
    await expect(
      page.locator('.ui-list-item__meta').filter({ hasText: '1 Stiche' }).first(),
      'Nach dem ersten Stich soll mindestens ein Spieler "1 Stiche" anzeigen',
    ).toBeVisible({ timeout: 20_000 });

    // -----------------------------------------------------------------------
    // Abschlusskontrolle: Keine JavaScript-Fehler waehrend des gesamten Tests
    // -----------------------------------------------------------------------
    expect(
      jsFehler,
      `JavaScript-Fehler sind aufgetreten:
${jsFehler.join('\n')}`,
    ).toHaveLength(0);
  });
});
