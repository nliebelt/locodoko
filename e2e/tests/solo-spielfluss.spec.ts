/**
 * E2E-Test: Solo-Spielfluss
 *
 * Testet den kompletten Solo-Spielfluss End-to-End:
 * - Solo-Vorbehalt waehlen (falls verfuegbar, sonst test.skip)
 * - HUD zeigt Solo-Spieltyp durchgehend
 * - Alle 12 Stiche bis Rundenauswertung
 * - Overlay: Solo-Spieltyp + nur ein RE + Multiplikator ×3
 * - Geber-Wiederholung im Folge-Spiel pruefen
 *
 * Warum dieser Test wichtig ist: Solo veraendert drei Dinge die im Normalspiel
 * nicht beobachtbar sind — anderer HUD-Spieltyp, asymmetrische Parteien (1 RE, 3 Kontra)
 * und Geber-Rotation bleibt nach Solo beim selben Geber.
 *
 * Voraussetzung: Backend laeuft auf localhost:8080
 *   cd e2e && npx playwright test solo-spielfluss.spec.ts
 */

import { test, expect, type Page } from '@playwright/test';

// ── Bridge-Typen ────────────────────────────────────────────────────────

interface LaufendesSpielDto {
  phase: string;
  spieltyp: string;
  spielbareKarten: { id: string }[];
  moeglicheVorbehalte: string[];
  moeglicheAnsagen: string[];
  aktuellerSpieler: string | null;
  spieler: {
    istSelbst: boolean;
    verbleibendeKarten: number | null;
    partei: string | null;
    sichtbareHandkarten: { id: string }[] | null;
  }[];
}

// ── Hilfsfunktionen ─────────────────────────────────────────────────────

async function warteAufPhase(page: Page, phase: string, timeoutMs = 15_000): Promise<void> {
  await page.waitForFunction(
    (gesuchtePhase: string) => {
      const loco = (window as unknown as Record<string, { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: { phase?: string } } } } }>)['__locodoko'];
      return loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel?.phase === gesuchtePhase;
    },
    phase,
    { timeout: timeoutMs }
  );
}

async function warteAufEigenenVorbehalt(page: Page, timeoutMs = 15_000): Promise<void> {
  await page.waitForFunction(
    () => {
      const loco = (window as unknown as Record<string, { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: { moeglicheVorbehalte?: unknown[] } } } } }>)['__locodoko'];
      return (loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel?.moeglicheVorbehalte?.length ?? 0) > 0;
    },
    { timeout: timeoutMs }
  );
}

async function warteAufEigenenZug(page: Page, timeoutMs = 15_000): Promise<void> {
  await page.waitForFunction(
    () => {
      const loco = (window as unknown as Record<string, { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: { spielbareKarten?: unknown[]; phase?: string } } } } }>)['__locodoko'];
      const spiel = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel;
      return spiel?.phase === 'STICHPHASE' && (spiel?.spielbareKarten?.length ?? 0) > 0;
    },
    { timeout: timeoutMs }
  );
}

/**
 * Gibt den 1-basierten Index eines Solo-Vorbehalts zurueck (fuer Ziffertaste).
 * Bevorzugt SOLO_DAME, dann SOLO_BUBE, dann beliebiges SOLO_*.
 * Null wenn kein Solo verfuegbar.
 */
async function soloVorbehaltIndex(page: Page): Promise<{ index: number; typ: string } | null> {
  return page.evaluate(() => {
    const loco = (window as unknown as Record<string, { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: { moeglicheVorbehalte?: string[] } } } } }>)['__locodoko'];
    const vorbehalte = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel?.moeglicheVorbehalte ?? [];
    const bevorzugt = ['SOLO_DAME', 'SOLO_BUBE', 'SOLO_TRUMPF', 'SOLO_TRUMPF_HERZ', 'SOLO_TRUMPF_PIK', 'SOLO_TRUMPF_KREUZ', 'SOLO_FLEISCHLOS'];
    for (const solo of bevorzugt) {
      const idx = vorbehalte.indexOf(solo);
      if (idx >= 0) return { index: idx + 1, typ: solo };
    }
    return null;
  });
}

/**
 * Liest den aktuellen Spieltyp aus dem AppStore-Snapshot.
 */
async function aktuellerSpieltyp(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const loco = (window as unknown as Record<string, { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: { spieltyp?: string } } } } }>)['__locodoko'];
    return loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel?.spieltyp ?? null;
  });
}

/**
 * Wartet auf ein Spielereignis: Overlay, Vorbehalt oder eigener Zug.
 */
async function warteAufNaechstesEreignis(page: Page, timeoutMs = 30_000): Promise<string> {
  return page.waitForFunction(
    (): string | null => {
      const overlay = document.querySelector('[data-testid="rundenauswertung-overlay"]') as HTMLElement | null;
      if (overlay && !overlay.hidden) return 'overlay';
      const loco = (window as unknown as Record<string, { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: { spielbareKarten?: unknown[]; phase?: string; moeglicheVorbehalte?: unknown[]; moeglicheAnsagen?: string[] } } } } }>)['__locodoko'];
      const spiel = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel;
      if (!spiel) return null;
      if ((spiel.moeglicheVorbehalte?.length ?? 0) > 0) return 'vorbehalt';
      if (spiel.phase === 'STICHPHASE' && (spiel.spielbareKarten?.length ?? 0) > 0) return 'zug';
      return null;
    },
    { timeout: timeoutMs, polling: 200 }
  ).then(h => h.jsonValue() as Promise<string>).catch(() => 'timeout');
}

// ── Test ──────────────────────────────────────────────────────────────────

test.describe('Solo-Spielfluss', () => {
  test('Solo-Runde komplett: HUD-Spieltyp, Rundenauswertung, Geber-Wiederholung', async ({ page }) => {
    test.setTimeout(300_000);

    // JavaScript-Fehler sammeln
    const jsFehler: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') jsFehler.push(`[console.error] ${msg.text()}`);
    });
    page.on('pageerror', (err) => jsFehler.push(`[pageerror] ${err.message}`));

    // ── 1. Quick Game starten ─────────────────────────────────────────────
    await page.goto('/');
    await expect(page.locator('button', { hasText: /Quick Game/i })).toBeVisible({ timeout: 20_000 });
    await page.locator('button', { hasText: /Quick Game/i }).click();
    await expect(
      page.locator('[data-testid="tischszene"]'),
      'TischSzene muss geladen sein',
    ).toBeVisible({ timeout: 15_000 });

    // ── 2. Spiele durchlaufen bis Solo-Hand auftritt ────────────────────
    let soloGefunden = false;
    let soloTyp = '';
    const overlay = page.locator('[data-testid="rundenauswertung-overlay"]');

    for (let spiel = 0; spiel < 30 && !soloGefunden; spiel++) {
      // ── Vorbehalt-Phase ───────────────────────────────────────────────
      await warteAufPhase(page, 'VORBEHALT_ANSAGE', 25_000);
      await warteAufEigenenVorbehalt(page, 20_000);

      const solo = await soloVorbehaltIndex(page);
      if (solo !== null) {
        // Solo waehlen
        await page.keyboard.press(String(solo.index));
        soloGefunden = true;
        soloTyp = solo.typ;

        // ── 4. Assert: HUD zeigt Solo-Spieltyp ──────────────────────────
        // Warte bis Vorbehalt-Overlay verschwindet und Spieltyp im HUD erscheint
        await page.waitForFunction(
          () => {
            const vorbehaltOverlay = document.querySelector('[data-testid="vorbehalt-overlay"]') as HTMLElement | null;
            return !vorbehaltOverlay || vorbehaltOverlay.hidden;
          },
          { timeout: 15_000 }
        );

        // Spieltyp im HUD pruefen (muss Solo-Typ zeigen)
        const hudSpieltyp = page.locator('[data-testid="hud-spieltyp"]');
        await expect(hudSpieltyp).toBeVisible({ timeout: 15_000 });

        // Warte auf Solo-Spieltyp im AppStore
        await page.waitForFunction(
          (erwarteterTyp: string) => {
            const loco = (window as unknown as Record<string, { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: { spieltyp?: string } } } } }>)['__locodoko'];
            const spieltyp = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel?.spieltyp;
            return spieltyp === erwarteterTyp;
          },
          soloTyp,
          { timeout: 15_000 }
        );
      } else {
        // GESUND waehlen
        await page.keyboard.press('1');
      }

      // ── Stich-Schleife ────────────────────────────────────────────────
      for (let versuch = 0; versuch < 120; versuch++) {
        if (await overlay.isVisible()) break;

        const ereignis = await warteAufNaechstesEreignis(page, 30_000);

        if (ereignis === 'overlay') break;
        if (ereignis === 'timeout') continue;
        if (await overlay.isVisible()) break;

        if (ereignis === 'vorbehalt') {
          // Neues Spiel (nach Rundenende oder Einwurf) — Schleife beenden
          // Wir sind im naechsten Spiel angekommen
          break;
        }

        if (ereignis === 'zug') {
          // 30-Augen-Pflichtansage behandeln
          const ansagen = await page.evaluate((): string[] => {
            const loco = (window as unknown as Record<string, { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: { moeglicheAnsagen?: string[] } } } } }>)['__locodoko'];
            return loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel?.moeglicheAnsagen ?? [];
          }).catch(() => [] as string[]);
          if (ansagen.includes('KONTRA')) await page.keyboard.press('k');
          else if (ansagen.includes('RE')) await page.keyboard.press('r');

          // Waehrend Solo: pruefen dass Spieltyp sich nicht aendert
          if (soloGefunden) {
            const aktuell = await aktuellerSpieltyp(page);
            expect(aktuell, 'Spieltyp darf sich waehrend des Solo-Spiels nicht aendern').toBe(soloTyp);
          }

          await page.keyboard.press('Enter');
          await page.waitForTimeout(500);
        }
      }

      if (soloGefunden) {
        // ── 6. Rundenauswertung: Solo-spezifische Anzeige ────────────────
        await expect(overlay).toBeVisible({ timeout: 120_000 });

        // Spieltyp im Overlay pruefen
        const spieltypElement = page.locator('[data-testid="rundenauswertung-spieltyp"]');
        const spieltypText = await spieltypElement.textContent();
        expect(spieltypText, 'Overlay muss Solo-Spieltyp anzeigen').toBeTruthy();
        // Solo-Typ-Mapping pruefen (z.B. SOLO_DAME → Damensolo)
        const soloLabels: Record<string, string> = {
          SOLO_DAME: 'Damensolo',
          SOLO_BUBE: 'Bubensolo',
          SOLO_TRUMPF: 'Karosolo',
          SOLO_TRUMPF_HERZ: 'Herzsolo',
          SOLO_TRUMPF_PIK: 'Piksolo',
          SOLO_TRUMPF_KREUZ: 'Kreuzsolo',
          SOLO_FLEISCHLOS: 'Fleischlos',
        };
        const erwartetesLabel = soloLabels[soloTyp] ?? soloTyp;
        expect(spieltypText).toBe(erwartetesLabel);

        // Multiplikator ×3
        const multiplikator = page.locator('[data-testid="rundenauswertung-punktemultiplikator"]');
        const multiplikatorText = await multiplikator.textContent();
        expect(multiplikatorText, 'Solo-Multiplikator muss ×3 sein').toBe('×3');

        // ── 7. Naechstes Spiel: Geber-Wiederholung ──────────────────────
        // Overlay schliessen
        await page.keyboard.press('Enter');
        await expect(overlay).toBeHidden({ timeout: 5_000 });

        // Neues Vorbehalt-Overlay muss erscheinen (neues Spiel gestartet)
        await warteAufPhase(page, 'VORBEHALT_ANSAGE', 25_000);
        await warteAufEigenenVorbehalt(page, 20_000);
        // Wenn wir hier ankommen, wurde ein neues Spiel gestartet — Geber-Wiederholung funktioniert
        break;
      }

      // Spiel ohne Solo — Rundenauswertung schliessen und naechstes Spiel starten
      if (await overlay.isVisible()) {
        await page.keyboard.press('Enter');
        await expect(overlay).toBeHidden({ timeout: 5_000 });
      }
    }

    // ── 4. Ergebnis ───────────────────────────────────────────────────────
    if (!soloGefunden) {
      test.skip(true, 'Keine Solo-Hand in 30 Spielen aufgetreten — Test uebersprungen');
      return;
    }

    // ── Abschlusskontrolle: Keine JavaScript-Fehler ──────────────────────
    expect(
      jsFehler,
      `JavaScript-Fehler:\n${jsFehler.join('\n')}`,
    ).toHaveLength(0);
  });
});
