/**
 * E2E-Test: Einladungslink-Flow (Link-Beitritt via #join/{code}).
 *
 * Wichtig: Dieser Test setzt eine laufende Anwendung voraus (mvn spring-boot:run).
 * Kein Mocking — der Test testet den echten Einladungslink-Flow End-to-End.
 * Warum dieser Test wichtig ist: Der URL-Hash-Mechanismus (#join/{code}) wird in
 * BootSzene geparst und loest automatisch einen Beitritt aus. Ohne diesen Test
 * wuerde eine Regression in der BootSzene-Logik, im REST-Endpoint oder in der
 * Code-Generierung (TischEntity) unentdeckt bleiben.
 */

import { test, expect, type Page } from '@playwright/test';

async function leseEinladungsCode(page: Page): Promise<string> {
  const handle = await page.waitForFunction(
    () => {
      const loco = (window as unknown as Record<string, { appStore: { snapshot: () => { aktuellerTisch?: { einladungsCode?: string } } } }>)['__locodoko'];
      const code = loco?.appStore?.snapshot()?.aktuellerTisch?.einladungsCode;
      return code && code.length === 8 ? code : null;
    },
    { timeout: 10_000 }
  );
  return (await handle.jsonValue()) as string;
}

test.describe('Einladungslink (Link-Beitritt)', () => {
  test('Spieler betritt Tisch automatisch via #join/{code} URL', async ({ page, browser }) => {
    // JavaScript-Fehler in der Browser-Konsole sammeln und am Ende als Fehler werten.
    // Warum: Phaser-Spiele koennen Fehler stumm schlucken — explizite Pruefung notwendig.
    const jsFehlerSpieler1: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') jsFehlerSpieler1.push(`[console.error] ${msg.text()}`);
    });
    page.on('pageerror', (err) => jsFehlerSpieler1.push(`[pageerror] ${err.message}`));

    // ── 1. Spieler 1: Start-Screen laden ────────────────────────────────────
    // Warum: Stellt sicher dass die Anwendung erreichbar ist und der Start-Screen
    // korrekt gerendert wird (Session-Cookie, Phaser initialisiert, DOM aufgebaut).
    await page.goto('/');
    await expect(
      page.locator('[data-testid="startscreen"]'),
      'Start-Screen muss nach dem Laden sichtbar sein',
    ).toBeVisible({ timeout: 20_000 });

    // ── 2. Spieler 1: Tisch erstellen ───────────────────────────────────────
    // Warum: Erstellt einen offenen Tisch (Status WARTEND) mit einem server-generierten
    // Einladungscode. Das Spiel wird NICHT gestartet, damit Spieler 2 beitreten kann.
    await page.locator('[data-testid="btn-neuer-tisch"]').click();
    await expect(
      page.locator('[data-testid="tisch-config-modal"]'),
      'Konfigurationsmodal muss nach Klick auf "Neuen Tisch erstellen" sichtbar sein',
    ).toBeVisible({ timeout: 5_000 });
    await page.locator('[data-testid="input-tischname"]').fill('Einladungslink-Test');
    await page.locator('[data-testid="btn-tisch-erstellen"]').click();

    await expect(
      page.locator('[data-testid="tischszene"]'),
      'TischSzene muss nach Tisch-Erstellung fuer Spieler 1 sichtbar sein',
    ).toBeVisible({ timeout: 10_000 });

    // ── 3. Einladungscode aus AppStore auslesen ──────────────────────────────
    // Warum: Der Code wird serverseitig per UUID-basierter Zufallsgenerierung erzeugt
    // und im AppStore (aktuellerTisch.einladungsCode) gespeichert. Nur so laesst sich
    // der korrekte Einladungslink konstruieren.
    const einladungsCode = await leseEinladungsCode(page);
    expect(einladungsCode, 'Einladungscode muss 8 alphanumerische Zeichen enthalten').toMatch(/^[A-Za-z0-9]{8}$/);

    // ── 4. Spieler 2: Neuer Browser-Kontext mit Einladungslink ──────────────
    // Warum: Neuer Kontext = eigene HTTP-Session (eigener Cookie). Simuliert einen
    // anderen Spieler, der den Link erhaelt und oeffnet — ohne bestehende Session.
    const kontext2 = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const seite2 = await kontext2.newPage();

    const jsFehlerSpieler2: string[] = [];
    seite2.on('console', (msg) => {
      if (msg.type() === 'error') jsFehlerSpieler2.push(`[console.error] ${msg.text()}`);
    });
    seite2.on('pageerror', (err) => jsFehlerSpieler2.push(`[pageerror] ${err.message}`));

    try {
      // ── 5. Spieler 2: URL mit Hash #join/{code} aufrufen ──────────────────
      // Warum: BootSzene liest window.location.hash, erkennt das Muster #join/{8-Zeichen-Code},
      // ruft appStore.betreteTischViaCode() auf und startet direkt die TischSzene.
      // Kein manueller Beitritt-Schritt erforderlich — das ist der Kern dieses Features.
      await seite2.goto(`/#join/${einladungsCode}`);

      // ── 6. Spieler 2: TischSzene erscheint automatisch ────────────────────
      // Warum: Beweist dass der vollstaendige Beitritts-Flow funktioniert:
      // URL-Parsing (BootSzene) → REST-Aufruf (POST /api/tische/beitreten/{code})
      // → AppStore-Update → Szenen-Wechsel zu TischSzene.
      await expect(
        seite2.locator('[data-testid="tischszene"]'),
        'TischSzene muss fuer Spieler 2 nach Einladungslink automatisch sichtbar sein',
      ).toBeVisible({ timeout: 20_000 });

      // ── Abschlusskontrolle: Keine JavaScript-Fehler bei Spieler 2 ────────
      expect(
        jsFehlerSpieler2,
        `JavaScript-Fehler bei Spieler 2:\n${jsFehlerSpieler2.join('\n')}`,
      ).toHaveLength(0);
    } finally {
      await kontext2.close();
    }

    // ── Abschlusskontrolle: Keine JavaScript-Fehler bei Spieler 1 ──────────
    expect(
      jsFehlerSpieler1,
      `JavaScript-Fehler bei Spieler 1:\n${jsFehlerSpieler1.join('\n')}`,
    ).toHaveLength(0);
  });
});
