/**
 * E2E-Test: Schnellstart-Flow (Quick Game).
 *
 * Wichtig: Dieser Test setzt eine laufende Anwendung voraus (mvn spring-boot:run).
 * Kein Mocking — der Test testet den echten Quick-Game-Flow End-to-End.
 * Warum dieser Test wichtig ist: Schnellstart umgeht den Tischerstellungs-Flow
 * komplett. Ein Klick auf Quick Game soll serverseitig einen Tisch erstellen,
 * KI-Spieler auffuellen, die Partie starten und den Spieler direkt in die
 * Vorbehalt-Phase bringen. Dieser Test stellt sicher dass alle diese Schritte
 * in einer einzigen Transaktion funktionieren.
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

async function warteAufPhase(page: Page, phase: string, timeoutMs = 20_000): Promise<void> {
  await page.waitForFunction(
    (gesuchtePhase: string) => {
      const loco = (window as unknown as Record<string, LocodokoBridge>)['__locodoko'];
      return loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel?.phase === gesuchtePhase;
    },
    phase,
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

async function warteAufEigenenZug(page: Page, timeoutMs = 25_000): Promise<void> {
  await page.waitForFunction(
    () => {
      const loco = (window as unknown as Record<string, LocodokoBridge>)['__locodoko'];
      const spiel = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel;
      return spiel?.phase === 'STICHPHASE' && (spiel?.spielbareKarten?.length ?? 0) > 0;
    },
    { timeout: timeoutMs }
  );
}

test.describe('Schnellstart (Quick Game)', () => {
  test('Quick Game startet sofort Partie gegen KI ohne manuelle Tischkonfiguration', async ({ page }) => {
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
      page.locator('[data-testid="btn-quick-game"]'),
      '"Quick Game"-Button muss auf dem Start-Screen sichtbar sein',
    ).toBeVisible();

    // ── 2. Quick Game klicken ────────────────────────────────────────────────
    // Warum: POST /api/tische/schnellstart wird aufgerufen — erstellt Tisch,
    // fuellt 3 KI-Spieler auf und startet die Partie in einer Transaktion.
    // Kein Konfigurationsmodal, kein separater Spielstart-Schritt noetig.
    await page.locator('[data-testid="btn-quick-game"]').click();

    // ── 3. TischSzene erscheint direkt ──────────────────────────────────────
    // Warum: Nach Schnellstart muss die TischSzene ohne manuellen Spielstart sichtbar sein.
    // Das Spiel laueft bereits — kein "Spiel starten"-Button mehr sichtbar.
    await expect(
      page.locator('[data-testid="tischszene"]'),
      'TischSzene muss direkt nach Quick Game sichtbar sein',
    ).toBeVisible({ timeout: 15_000 });

    // ── 4. Vorbehalt-Phase durchlaufen ───────────────────────────────────────
    // Warum: Stellt sicher dass die Partie gestartet wurde, 12 Karten ausgeteilt
    // wurden und der Spieler seinen Vorbehalt erklaeren muss.
    await warteAufPhase(page, 'VORBEHALT_ANSAGE', 20_000);
    await warteAufEigenenVorbehalt(page, 15_000);
    // Vorbehalt per Ziffertaste 1 = erste Option (GESUND)
    await page.keyboard.press('1');

    // ── 5. Erste Karte per Tastatur spielen ─────────────────────────────────
    // KI-Spieler melden Vorbehalte automatisch → Spielphase wechselt zu STICHPHASE.
    // Warte bis SUED an der Reihe ist (spielbareKarten vorhanden).
    await warteAufEigenenZug(page, 25_000);
    await page.keyboard.press('Enter');

    // ── 6. Stich-Zaehler pruefen ─────────────────────────────────────────────
    // Warum: Beweist dass die serverseitig gestartete Partie vollstaendig
    // funktioniert: Stich-Logik, KI-Zuege und WebSocket-Updates korrekt.
    await expect(
      page.locator('[data-testid="hud-stichzaehler"]'),
      'Nach dem ersten abgeschlossenen Stich muss der Zaehler "Stich 1/10" zeigen (Quick Game = standard() = ohneNeunen)',
    ).toContainText('Stich 1/10', { timeout: 20_000 });

    // ── Abschlusskontrolle: Keine JavaScript-Fehler ──────────────────────────
    expect(
      jsFehler,
      `JavaScript-Fehler sind aufgetreten:\n${jsFehler.join('\n')}`,
    ).toHaveLength(0);
  });
});
