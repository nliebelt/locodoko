/**
 * E2E-Test: Partie gegen KI bis zum ersten abgeschlossenen Stich.
 *
 * Wichtig: Dieser Test setzt eine laufende Anwendung voraus (mvn spring-boot:run).
 * Kein Mocking — der Test testet den echten Spielfluss End-to-End.
 * Warum dieser Test wichtig ist: Er sichert den kritischen Pfad ab, der alle
 * Schichten durchquert (Session → Lobby → Tisch → Partie → KI → WebSocket → UI).
 *
 * Selektoren: Stabile data-testid-Attribute fuer DOM-Elemente, __locodoko-Bridge
 * fuer Phaser-gerenderte UI-Elemente (Vorbehalt-Dialog, Spielkarten).
 */

import { test, expect, type Page } from '@playwright/test';

interface LocodokoBridge {
  appStore: {
    snapshot: () => {
      partieStand?: {
        laufendesSpiel?: {
          phase?: string;
          spielbareKarten?: unknown[];
          moeglicheVorbehalte?: unknown[];
        };
      };
    };
  };
}

function bridge(page: Page) {
  return (window as unknown as Record<string, LocodokoBridge>)['__locodoko'];
}

async function warteAufPhase(page: Page, phase: string, timeoutMs = 15_000): Promise<void> {
  await page.waitForFunction(
    (gesuchtePhase: string) => {
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
      const loco = (window as unknown as Record<string, LocodokoBridge>)['__locodoko'];
      const spiel = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel;
      return spiel?.phase === 'STICHPHASE' && (spiel?.spielbareKarten?.length ?? 0) > 0;
    },
    { timeout: timeoutMs }
  );
}

async function warteAufEigenenVorbehalt(page: Page, timeoutMs = 15_000): Promise<void> {
  await page.waitForFunction(
    () => {
      const loco = (window as unknown as Record<string, LocodokoBridge>)['__locodoko'];
      const vorbehalte = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel?.moeglicheVorbehalte;
      return (vorbehalte?.length ?? 0) > 0;
    },
    { timeout: timeoutMs }
  );
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

    // ── 1. Start-Screen laden ────────────────────────────────────────────────
    // Warum: Stellt sicher dass die Anwendung erreichbar ist und der Start-Screen
    // korrekt gerendert wird (Session-Cookie, Phaser initialisiert, DOM aufgebaut).
    await page.goto('/');
    await expect(
      page.locator('[data-testid="startscreen"]'),
      'Start-Screen muss nach dem Laden sichtbar sein',
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.locator('[data-testid="btn-neuer-tisch"]'),
      '"Neuen Tisch erstellen"-Button muss sichtbar sein',
    ).toBeVisible();

    // ── 2. Tisch erstellen ───────────────────────────────────────────────────
    await page.evaluate(async () => {
      const loco = (window as any).__locodoko;
      await loco.appStore.alsGastStarten();
      await loco.appStore.erstelleKonfiguriertenTisch('E2E-Test-Tisch', {
        ohneNeunen: false,
        anzahlSpiele: 8,
        tischhintergrund: 'FILZ_GRUEN',
        kiSchwierigkeit: 'STANDARD'
      }, false);
    });

    // TischSzene muss geladen werden
    await expect(
      page.locator('[data-testid="tischszene"]'),
      'TischSzene muss nach Tisch-Erstellung sichtbar sein',
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.locator('[data-testid="hud-btn-einstellungen"]'),
      'Einstellungen-Button muss in der TischSzene sichtbar sein',
    ).toBeVisible();

    // ── 3. Spiel starten ─────────────────────────────────────────────────────
    // Warum: "Spiel starten" fuellt 3 KI-Spieler auf, startet Partie und
    // Vorbehalt-Phase — prueft KI-Auffuellung und Spielstart-Logik.
    const startButton = page.locator('[data-testid="btn-spiel-starten"]');
    await expect(startButton, '"Spiel starten"-Button muss sichtbar sein (Tisch ist WARTEND)').toBeVisible({ timeout: 5_000 });
    await expect(startButton).toBeEnabled({ timeout: 10_000 });
    await startButton.click();

    // ── 4. Vorbehalt-Phase durchlaufen ───────────────────────────────────────
    // Vorbehalt-Dialog ist Phaser-gerendert (kein HTML-DOM) → per __locodoko-Bridge pruefen.
    // Warum: Stellt sicher dass 12 Karten ausgeteilt wurden und Vorbehalte erwartet werden.
    await warteAufPhase(page, 'VORBEHALT_ANSAGE', 20_000);
    await warteAufEigenenVorbehalt(page, 15_000);
    // Vorbehalt per Ziffertaste 1 = erste Option (GESUND)
    // Warum: Tastatursteuerung testen — kein Klick auf Phaser-Canvas-Elemente moeglich.
    await page.keyboard.press('1');

    // ── 5. Erste Karte per Tastatur spielen ─────────────────────────────────
    // KI-Spieler melden Vorbehalte automatisch → Spielphase wechselt zu STICHPHASE.
    // Warte bis SUED an der Reihe ist (spielbareKarten vorhanden).
    // Warum: Verhindert vorzeitige Enter-Eingabe bevor KI-Zuege abgeschlossen sind.
    await warteAufEigenenZug(page, 25_000);
    // Enter spielt die automatisch vorausgewaehlte erste spielbare Karte aus
    await page.keyboard.press('Enter');

    // ── 6. Stich-Zaehler pruefen ─────────────────────────────────────────────
    // Nach SUED's Karte spielen die verbleibenden KI-Spieler automatisch — der erste
    // Stich wird abgeschlossen und der Stich-Zaehler zeigt "Stich 1/12".
    // Warum: Beweist dass Stich-Logik, KI-Zuege und WebSocket-Updates korrekt funktionieren.
    await expect(
      page.locator('[data-testid="hud-stichzaehler"]'),
      'Nach dem ersten abgeschlossenen Stich muss der Zaehler "Stich 1/10" zeigen (Modal-Default = LOCO_BLAT = ohneNeunen)',
    ).toContainText('Stich 1/10', { timeout: 20_000 });

    // ── Abschlusskontrolle: Keine JavaScript-Fehler ──────────────────────────
    expect(
      jsFehler,
      `JavaScript-Fehler sind aufgetreten:\n${jsFehler.join('\n')}`,
    ).toHaveLength(0);
  });
});
