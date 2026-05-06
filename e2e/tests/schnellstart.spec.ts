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

import { test, expect } from '@playwright/test';
import {
  alsGastStarten,
  erstelleQuickGame,
  warteAufPhase,
  warteAufEigenenVorbehalt,
  warteAufEigenenZug,
  aktiviereConsoleCapture,
  warteAufSzene,
  leseHudZustand,
  getBridge,
} from './helpers';

test.describe('Schnellstart (Quick Game)', () => {
  test('Quick Game startet sofort Partie gegen KI ohne manuelle Tischkonfiguration', async ({ page }, testInfo) => {
    aktiviereConsoleCapture(page, testInfo.title);

    // ── 1. Start-Screen laden ────────────────────────────────────────────────
    // Warum: Stellt sicher dass die Anwendung erreichbar ist, die Bridge
    // (window.__locodoko) bereitsteht und die SpielverwaltungsSzene aktiv ist.
    await page.goto('/');
    await getBridge(page);
    await warteAufSzene(page, 'SpielverwaltungsSzene', 20_000);

    // ── 2. Quick Game triggern ───────────────────────────────────────────────
    // Warum: Da die Buttons in Phaser gerendert werden, nutzen wir die JS-Bridge.
    await alsGastStarten(page);
    await erstelleQuickGame(page);

    // ── 3. TischSzene erscheint direkt ──────────────────────────────────────
    // Warum: Nach Schnellstart muss die TischSzene ohne manuellen Spielstart aktiv sein.
    // Das Spiel laueft bereits — kein "Spiel starten"-Button mehr sichtbar.
    await warteAufSzene(page, 'TischSzene', 15_000);

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
    await page.waitForFunction(
      () => {
        const hud = (window as any).__locodoko?.getHudState?.();
        return hud?.stichzaehler?.includes('Stich 1/');
      },
      { timeout: 20_000 },
    );
    const hud = await leseHudZustand(page);
    expect(hud.stichzaehler, 'Nach dem ersten Stich muss der Zaehler "Stich 1/..." zeigen').toMatch(/Stich 1\//);
  });
});
