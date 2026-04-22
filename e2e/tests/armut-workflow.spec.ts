/**
 * E2E-Test: Armut-Workflow
 *
 * Testet den kompletten Armut-Spielfluss End-to-End:
 * - Armut erkennen (eigene Hand ≤3 Truempfe ODER KI-Armut)
 * - Trumpfkarten anbieten (ANBIETEN-Modus) / Tausch annehmen (ANTWORTEN-Modus)
 * - Spiel laeuft nach dem Tausch normal weiter bis Rundenauswertung
 *
 * Warum dieser Test wichtig ist: Armut ist die komplexeste Sonderregel mit
 * bidirektionalem Kartentausch und Phasenwechseln (VORBEHALT → ARMUT_TAUSCH → STICHPHASE).
 * Ohne E2E-Test koennte der Tausch-Workflow brechen ohne es zu merken.
 *
 * Voraussetzung: Backend laeuft auf localhost:8081
 *   cd e2e && npx playwright test armut-workflow.spec.ts
 */

import { test, expect, type Page } from '@playwright/test';

// ── Bridge-Typen ────────────────────────────────────────────────────────

interface KarteDto {
  id: string;
  farbe: string;
  wert: string;
  exemplarIndex: number;
}

interface SpielerImSpielDto {
  istSelbst: boolean;
  verbleibendeKarten: number | null;
  sichtbareHandkarten: KarteDto[] | null;
}

interface LaufendesSpielDto {
  phase: string;
  spieltyp: string;
  spielbareKarten: KarteDto[];
  moeglicheVorbehalte: string[];
  moeglicheAnsagen: string[];
  aktuellerSpieler: string | null;
  spieler: SpielerImSpielDto[];
}

interface LocodokoBridge {
  appStore: {
    snapshot: () => {
      partieStand?: {
        laufendesSpiel?: LaufendesSpielDto | null;
      };
    };
    beantworteArmut: (angenommen: boolean, kartenIds: string[]) => void;
  };
}

// ── Hilfsfunktionen ─────────────────────────────────────────────────────

function loco(page: Page): string {
  return `(window as unknown as Record<string, unknown>)['__locodoko']`;
}

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
 * Prueft ob ARMUT in den moeglichen Vorbehalten des Spielers enthalten ist
 * und gibt den 1-basierten Index zurueck (fuer Ziffertaste). Null wenn kein Armut.
 */
async function armutVorbehaltIndex(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const loco = (window as unknown as Record<string, { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: { moeglicheVorbehalte?: string[] } } } } }>)['__locodoko'];
    const vorbehalte = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel?.moeglicheVorbehalte ?? [];
    const idx = vorbehalte.indexOf('ARMUT');
    return idx >= 0 ? idx + 1 : null;
  });
}

/**
 * Bietet Trumpfkarten per Bridge an (ANBIETEN-Modus).
 * Filtert die eigene Hand nach Trumpfkarten (Normalspiel-Regeln)
 * und ruft appStore.beantworteArmut(true, trumpfkartenIds) auf.
 */
async function bieteTrumpfkartenAn(page: Page): Promise<void> {
  await page.evaluate(() => {
    const loco = (window as unknown as Record<string, { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: { spieler: { istSelbst: boolean; sichtbareHandkarten: { id: string; farbe: string; wert: string }[] | null }[] } } }; beantworteArmut: (a: boolean, k: string[]) => void } }>)['__locodoko'];
    const spiel = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel;
    if (!spiel) return;
    const eigener = spiel.spieler.find(s => s.istSelbst);
    if (!eigener?.sichtbareHandkarten) return;
    const trumpfIds = eigener.sichtbareHandkarten
      .filter(k =>
        k.wert === 'DAME'
        || k.wert === 'BUBE'
        || k.farbe === 'KARO'
        || (k.farbe === 'HERZ' && k.wert === 'ZEHN')
      )
      .map(k => k.id);
    loco.appStore.beantworteArmut(true, trumpfIds);
  });
}

/**
 * Nimmt Armut per Bridge an (ANTWORTEN-Modus).
 * Berechnet die Anzahl der zurueckzugebenden Karten aus der Differenz
 * der Handkartenanzahl und gibt die ersten N Karten zurueck.
 */
async function nimmArmutAn(page: Page): Promise<void> {
  await page.evaluate(() => {
    const loco = (window as unknown as Record<string, { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: { spieler: { istSelbst: boolean; verbleibendeKarten: number | null; sichtbareHandkarten: { id: string }[] | null }[] } } }; beantworteArmut: (a: boolean, k: string[]) => void } }>)['__locodoko'];
    const spiel = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel;
    if (!spiel) return;
    const eigener = spiel.spieler.find(s => s.istSelbst);
    if (!eigener?.sichtbareHandkarten) return;
    // Armut-Spieler hat weniger Karten (hat Trumpfkarten abgelegt)
    const armutSpieler = spiel.spieler
      .filter(s => !s.istSelbst && s.verbleibendeKarten !== null)
      .reduce<typeof spiel.spieler[0] | null>(
        (min, s) => (!min || (s.verbleibendeKarten ?? 99) < (min.verbleibendeKarten ?? 99)) ? s : min,
        null
      );
    const kartenAnzahl = eigener.sichtbareHandkarten.length - (armutSpieler?.verbleibendeKarten ?? eigener.sichtbareHandkarten.length);
    if (kartenAnzahl <= 0) {
      // Sonderfall: keine Karten zurueckzugeben
      loco.appStore.beantworteArmut(true, []);
      return;
    }
    // Erste N Karten zurueckgeben (beliebige Auswahl)
    const rueckgabeIds = eigener.sichtbareHandkarten.slice(0, kartenAnzahl).map(k => k.id);
    loco.appStore.beantworteArmut(true, rueckgabeIds);
  });
}

/**
 * Wartet auf ein Spielereignis: Overlay, Vorbehalt, Armut-Phase oder eigener Zug.
 * Gibt den Typ des Ereignisses zurueck.
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
      if (spiel.phase === 'ARMUT_TAUSCH') return 'armut';
      if (spiel.phase === 'STICHPHASE' && (spiel.spielbareKarten?.length ?? 0) > 0) return 'zug';
      return null;
    },
    { timeout: timeoutMs, polling: 200 }
  ).then(h => h.jsonValue() as Promise<string>).catch(() => 'timeout');
}

/**
 * Prueft ob die aktuelle Phase ARMUT_TAUSCH ist und der Spieler SUED am Zug ist.
 */
async function istArmutPhaseEigeneTurn(page: Page): Promise<'ANBIETEN' | 'ANTWORTEN' | null> {
  return page.evaluate(() => {
    const loco = (window as unknown as Record<string, { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: { phase: string; aktuellerSpieler: string | null; spieler: { istSelbst: boolean; verbleibendeKarten: number | null; sichtbareHandkarten: unknown[] | null }[] } } } } }>)['__locodoko'];
    const spiel = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel;
    if (!spiel || spiel.phase !== 'ARMUT_TAUSCH') return null;
    // Pruefen ob SUED am Zug ist (aktuellerSpieler mapped auf eigene Position)
    const eigener = spiel.spieler.find(s => s.istSelbst);
    if (!eigener) return null;
    // Wenn Armut-Spieler noch kein Angebot gemacht hat und wir der Armut-Spieler sind
    const eigeneKarten = eigener.sichtbareHandkarten?.length ?? 0;
    const andereKarten = spiel.spieler
      .filter(s => !s.istSelbst && s.verbleibendeKarten !== null)
      .map(s => s.verbleibendeKarten ?? 0);
    const hatWenigerKarten = andereKarten.some(k => eigeneKarten > k);
    if (!hatWenigerKarten && eigeneKarten < Math.max(...andereKarten, 0)) {
      // Eigener Spieler hat weniger Karten → ist Armut-Spieler → ANBIETEN
      return 'ANBIETEN' as const;
    }
    if (hatWenigerKarten) {
      return 'ANTWORTEN' as const;
    }
    return null;
  });
}

// ── Test ──────────────────────────────────────────────────────────────────

test.describe('Armut-Workflow', () => {
  test('Armut-Tausch wird durchgefuehrt und Spiel laeuft weiter', async ({ page }) => {
    test.setTimeout(300_000);

    // JavaScript-Fehler sammeln
    const jsFehler: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') jsFehler.push(`[console.error] ${msg.text()}`);
    });
    page.on('pageerror', (err) => jsFehler.push(`[pageerror] ${err.message}`));

    // ── 1. Quick Game starten ─────────────────────────────────────────────
    await page.goto('/');
    
    // Warten bis die Bridge bereit ist
    await page.waitForFunction(() => (window as any).__locodoko?.appStore, { timeout: 20_000 });
    
    // Als Gast starten und Quick Game triggern
    await page.evaluate(async () => {
      const loco = (window as any).__locodoko;
      await loco.appStore.alsGastStarten();
      await loco.appStore.erstelleQuickGame();
    });

    await expect(
      page.locator('[data-testid="tischszene"]'),
      'TischSzene muss geladen sein',
    ).toBeVisible({ timeout: 15_000 });

    // ── 2. Spiele durchlaufen bis Armut auftritt ──────────────────────────
    // Strategie: Bis zu 30 Spiele starten. In jedem Spiel pruefen ob
    // Armut in den Vorbehalten erscheint oder die ARMUT_TAUSCH-Phase eintritt.
    // Bei Armut: den Tausch durchfuehren und das Spiel bis zum Ende spielen.
    // Armut-Wahrscheinlichkeit je Hand: ~5-10% — bei 4 Spielern ~20-35% je Spiel.
    let armutGefunden = false;
    let armutModus: 'ANBIETEN' | 'ANTWORTEN' | null = null;
    const overlay = page.locator('[data-testid="rundenauswertung-overlay"]');

    for (let spiel = 0; spiel < 30 && !armutGefunden; spiel++) {
      // ── Vorbehalt-Phase ───────────────────────────────────────────────
      await warteAufPhase(page, 'VORBEHALT_ANSAGE', 25_000);
      await warteAufEigenenVorbehalt(page, 20_000);

      const armutIdx = await armutVorbehaltIndex(page);
      if (armutIdx !== null) {
        // Eigene Hand hat Armut → ARMUT waehlen
        await page.keyboard.press(String(armutIdx));
        armutGefunden = true;
        armutModus = 'ANBIETEN';

        // Warte auf ARMUT_TAUSCH-Phase
        await warteAufPhase(page, 'ARMUT_TAUSCH', 20_000);
        // Warte bis wir an der Reihe sind (als Armut-Spieler zum Anbieten)
        await page.waitForFunction(
          () => {
            const loco = (window as unknown as Record<string, { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: { phase: string; aktuellerSpieler: string | null } } } } }>)['__locodoko'];
            const spiel = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel;
            return spiel?.phase === 'ARMUT_TAUSCH' && spiel?.aktuellerSpieler !== null;
          },
          { timeout: 15_000 }
        );
        // Trumpfkarten per Bridge anbieten (Phaser-Canvas-Buttons nicht klickbar in headless)
        await bieteTrumpfkartenAn(page);
        await page.waitForTimeout(1_000);
      } else {
        // GESUND waehlen
        await page.keyboard.press('1');
      }

      // ── Armut-Tausch / Stich-Schleife ─────────────────────────────────
      // In einer Schleife auf Ereignisse warten und reagieren.
      // Wenn ARMUT_TAUSCH mit uns als Antwortspieler: annehmen.
      for (let versuch = 0; versuch < 120; versuch++) {
        if (await overlay.isVisible()) break;

        const ereignis = await warteAufNaechstesEreignis(page, 30_000);

        if (ereignis === 'overlay') break;
        if (ereignis === 'timeout') continue;
        if (await overlay.isVisible()) break;

        if (ereignis === 'vorbehalt') {
          // Neues Spiel (nach Rundenende oder Einwurf) — immer GESUND
          await page.keyboard.press('1');
          continue;
        }

        if (ereignis === 'armut') {
          if (armutGefunden && armutModus === 'ANBIETEN') {
            // Wir haben bereits angeboten — KI antwortet automatisch. Warten.
            await page.waitForTimeout(2_000);
            continue;
          }
          // KI hat Armut und wir sind gefragt → annehmen per Bridge
          const modus = await istArmutPhaseEigeneTurn(page);
          if (modus === 'ANTWORTEN') {
            armutGefunden = true;
            armutModus = 'ANTWORTEN';
            await nimmArmutAn(page);
            await page.waitForTimeout(1_000);
          } else if (modus === 'ANBIETEN') {
            // Seltsam in diesem Pfad, aber sicherheitshalber behandeln
            await bieteTrumpfkartenAn(page);
            await page.waitForTimeout(1_000);
          } else {
            // Nicht unser Zug — KI handelt, warten
            await page.waitForTimeout(1_000);
          }
          continue;
        }

        if (ereignis === 'zug') {
          // 30-Augen-Pflichtansage behandeln
          const ansagen = await page.evaluate((): string[] => {
            const loco = (window as unknown as Record<string, { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: { moeglicheAnsagen?: string[] } } } } }>)['__locodoko'];
            return loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel?.moeglicheAnsagen ?? [];
          }).catch(() => [] as string[]);
          if (ansagen.includes('KONTRA')) await page.keyboard.press('k');
          else if (ansagen.includes('RE')) await page.keyboard.press('r');

          await page.keyboard.press('Enter');
          await page.waitForTimeout(500);
        }
      }

      if (armutGefunden) {
        // ── 3. Assertions nach Armut-Spiel ──────────────────────────────
        // Rundenauswertung muss erscheinen → Spiel wurde erfolgreich beendet
        await expect(overlay).toBeVisible({ timeout: 60_000 });

        // Overlay schliessen
        const weiterButton = page.locator('[data-testid="btn-rundenauswertung-weiter"]');
        await expect(weiterButton).toBeVisible({ timeout: 10_000 });
        await page.keyboard.press('Enter');
        await expect(overlay).toBeHidden({ timeout: 5_000 });
        break;
      }

      // Spiel ohne Armut — Rundenauswertung schliessen und naechstes Spiel starten
      if (await overlay.isVisible()) {
        await page.keyboard.press('Enter');
        await expect(overlay).toBeHidden({ timeout: 5_000 });
      }
    }

    // ── 4. Ergebnis ───────────────────────────────────────────────────────
    if (!armutGefunden) {
      test.skip(true, 'Keine Armut-Situation in 30 Spielen aufgetreten — Test uebersprungen');
      return;
    }

    // Spiel laeuft weiter (neues Spiel oder Partie-Ende)
    const naechstePhase = await page.evaluate(() => {
      const loco = (window as unknown as Record<string, { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: { phase?: string } } } } }>)['__locodoko'];
      return loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel?.phase ?? null;
    });
    expect(naechstePhase).not.toBeNull();

    // ── Abschlusskontrolle: Keine JavaScript-Fehler ──────────────────────
    expect(
      jsFehler,
      `JavaScript-Fehler:\n${jsFehler.join('\n')}`,
    ).toHaveLength(0);
  });
});
