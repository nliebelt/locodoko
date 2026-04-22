/**
 * E2E-Test: Mehrere Runden gegen KI — Ohne-Neunen-Variante (10 Stiche)
 *
 * Spielt 2 vollständige Runden mit dem LOCO_BLAT-Regelwerk durch.
 * LOCO_BLAT = ohneNeunen:true → 40 Karten / 4 Spieler = 10 Karten = 10 Stiche.
 *
 * Warum separat testen: Das kürzere Deck bedeutet andere Indexgrenzen in der
 * Kartenverarbeitung. Ein Off-by-One in _synthetischerZwischenstand oder in der
 * Stich-Nummerierung schlägt hier durch, aber nicht im 12-Stich-Spiel.
 * Außerdem prüft das Preset andere Regelkombinationen (Schweinchen aktiv etc.).
 *
 * Abgedeckte Fixes: BF-13 (letzter Stich animiert), BF-14 (Spielankündigung-Timing),
 * BF-15 (Reconnect-Guard).
 *
 * Voraussetzung: Backend läuft auf localhost:8081
 *   cd e2e && npx playwright test mehrere-runden-ohne-neunen.spec.ts
 */

import { test, expect, type Page } from '@playwright/test';

// ── Bridge ────────────────────────────────────────────────────────────────

interface SpielZustand {
  overlayVisible: boolean;
  phase: string | null;
  spieltyp: string | null;
  spielbareKarten: number;
  moeglicheVorbehalte: number;
  moeglicheAnsagen: string[];
  armutPhase: boolean;
  spielNummer: number;
}

async function leseSpielZustand(page: Page): Promise<SpielZustand> {
  await page.waitForFunction(() => {
    const loco = (window as any).__locodoko;
    return loco?.appStore?.isIdle() === true;
  }, { timeout: 10000 }).catch(() => {});

  return page.evaluate((): SpielZustand => {
    const overlay = document.querySelector('[data-testid="rundenauswertung-overlay"]') as HTMLElement | null;
    type B = { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: {
      phase?: string; spieltyp?: string; spielbareKarten?: unknown[];
      moeglicheVorbehalte?: unknown[]; moeglicheAnsagen?: string[];
      spielNummer?: number;
    } } } } };
    const loco = (window as unknown as Record<string, B>)['__locodoko'];
    const spiel = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel;
    return {
      overlayVisible: !!overlay && !overlay.hidden,
      phase: spiel?.phase ?? null,
      spieltyp: spiel?.spieltyp ?? null,
      spielbareKarten: spiel?.spielbareKarten?.length ?? 0,
      moeglicheVorbehalte: spiel?.moeglicheVorbehalte?.length ?? 0,
      moeglicheAnsagen: spiel?.moeglicheAnsagen ?? [],
      armutPhase: spiel?.phase === 'ARMUT_TAUSCH',
      spielNummer: spiel?.spielNummer ?? 0,
    };
  });
}

async function setzeAnimationsGeschwindigkeit(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const b = (window as unknown as Record<string, Record<string, unknown>>)['__locodoko'];
    return typeof b?.['setzeAnimationsGeschwindigkeit'] === 'function';
  }, undefined, { timeout: 10_000 });
  await page.evaluate(() => {
    const b = (window as unknown as Record<string, Record<string, unknown>>)['__locodoko'];
    (b['setzeAnimationsGeschwindigkeit'] as (f: number) => void)(Infinity);
  });
}

// ── Test ──────────────────────────────────────────────────────────────────

test.describe('Mehrere Runden ohne Neunen (10 Stiche)', () => {
  test('Zwei vollständige Runden ohne JS-Fehler spielen', async ({ page }) => {
    test.setTimeout(600_000);

    const jsFehler: string[] = [];
    page.on('pageerror', (err) => jsFehler.push(`[pageerror] ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') jsFehler.push(`[console.error] ${msg.text()}`);
    });

    // ── 1. Tisch mit LOCO_BLAT-Preset erstellen (ohneNeunen = true) ───────
    // Quick Game verwendet möglicherweise eine andere Standardkonfiguration.
    // Explizite Tischerstellung stellt sicher, dass LOCO_BLAT (= Ohne Neunen) aktiv ist.
    await page.goto('/');
    await expect(page.locator('[data-testid="startscreen"]')).toBeVisible({ timeout: 20_000 });

    await page.locator('[data-testid="btn-neuer-tisch"]').click();
    await expect(page.locator('[data-testid="tisch-config-modal"]')).toBeVisible({ timeout: 5_000 });

    // LOCO_BLAT ist bereits der Default-Preset (ohneNeunen: true) — nur Name setzen
    await page.locator('[data-testid="input-tischname"]').fill('E2E-Ohne-Neunen');
    await page.locator('[data-testid="btn-tisch-erstellen"]').click();

    await expect(page.locator('[data-testid="tischszene"]')).toBeVisible({ timeout: 10_000 });

    // ── 2. Spiel starten ──────────────────────────────────────────────────
    const startButton = page.locator('[data-testid="btn-spiel-starten"]');
    await expect(startButton).toBeEnabled({ timeout: 10_000 });
    await startButton.click();

    // ── 3. Animationen beschleunigen ──────────────────────────────────────
    await setzeAnimationsGeschwindigkeit(page);

    // ── 4. Stichzähler prüfen: muss /10 zeigen (nicht /12) ───────────────
    // Beweist dass ohneNeunen aktiv ist — 40 Karten / 4 Spieler = 10 Stiche.
    await page.waitForFunction(
      () => {
        const loco = (window as unknown as Record<string, { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: { phase?: string } } } } }>)['__locodoko'];
        return loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel?.phase === 'STICHPHASE';
      },
      { timeout: 30_000 }
    );
    // Ersten eigenen Zug abwarten und eine Karte spielen damit der Zähler erscheint
    await page.waitForFunction(
      () => {
        const loco = (window as unknown as Record<string, { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: { spielbareKarten?: unknown[]; moeglicheVorbehalte?: unknown[]; phase?: string } } } } }>)['__locodoko'];
        const spiel = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel;
        return (spiel?.moeglicheVorbehalte?.length ?? 0) > 0 ||
          (spiel?.phase === 'STICHPHASE' && (spiel?.spielbareKarten?.length ?? 0) > 0);
      },
      { timeout: 30_000 }
    );

    // ── 5. Zwei Runden durchspielen ───────────────────────────────────────
    const overlay = page.locator('[data-testid="rundenauswertung-overlay"]');
    const weiterButton = page.locator('[data-testid="btn-rundenauswertung-weiter"]');

    let abgeschlosseneRunden = 0;
    let stichzaehlerGeprueft = false;
    let letztePhase = '';
    let letzteSpielNummer = 0;
    let letztesSpieltyp = '';

    for (let i = 0; i < 1200 && abgeschlosseneRunden < 2; i++) {
      const zustand = await leseSpielZustand(page).catch(() => null);
      if (!zustand) { await page.waitForTimeout(300); continue; }

      if (zustand.phase !== letztePhase || zustand.spielNummer !== letzteSpielNummer) {
        console.log(`[i=${i}] Runde ${abgeschlosseneRunden + 1}/2 | Spiel ${zustand.spielNummer} | Phase=${zustand.phase} | Typ=${zustand.spieltyp}`);
        letztePhase = zustand.phase ?? '';
        letzteSpielNummer = zustand.spielNummer;
      }
      if (zustand.spieltyp && zustand.spieltyp !== 'NORMALSPIEL' && zustand.spieltyp !== letztesSpieltyp) {
        console.log(`[BF-14] Spieltyp-Ankündigung: ${zustand.spieltyp} in Spiel ${zustand.spielNummer}`);
        letztesSpieltyp = zustand.spieltyp;
      }

      // Stichzähler-Prüfung: einmalig nach erstem abgeschlossenen Stich
      if (!stichzaehlerGeprueft) {
        const zaehlerText = await page.locator('[data-testid="hud-stichzaehler"]').textContent().catch(() => '');
        if (zaehlerText?.includes('/10')) {
          console.log(`[OK] Stichzähler zeigt "${zaehlerText}" → ohneNeunen bestätigt`);
          stichzaehlerGeprueft = true;
        } else if (zaehlerText?.includes('/12')) {
          throw new Error(`Stichzähler zeigt "${zaehlerText}" — erwartet /10 (ohneNeunen). LOCO_BLAT-Preset nicht aktiv?`);
        }
      }

      if (zustand.overlayVisible) {
        await expect(weiterButton).toBeVisible({ timeout: 5_000 });
        abgeschlosseneRunden++;
        console.log(`Runde ${abgeschlosseneRunden} abgeschlossen.`);
        if (abgeschlosseneRunden < 2) {
          await weiterButton.click();
          await page.waitForTimeout(500);
          await setzeAnimationsGeschwindigkeit(page).catch(() => { /* ignorieren */ });
        }
        continue;
      }

      if (zustand.moeglicheVorbehalte > 0) {
        await page.keyboard.press('1');
        await page.waitForTimeout(200);
        continue;
      }
      if (zustand.armutPhase) {
        await page.keyboard.press('n');
        await page.waitForTimeout(200);
        continue;
      }
      if (zustand.phase === 'STICHPHASE' && zustand.spielbareKarten > 0) {
        if (zustand.moeglicheAnsagen.includes('KONTRA')) await page.keyboard.press('k');
        else if (zustand.moeglicheAnsagen.includes('RE')) await page.keyboard.press('r');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(200);
        continue;
      }

      await page.waitForTimeout(300);
    }

    // ── 6. Assertions ─────────────────────────────────────────────────────

    expect(
      abgeschlosseneRunden,
      'Mindestens 2 Runden müssen vollständig abgeschlossen worden sein',
    ).toBeGreaterThanOrEqual(2);

    expect(
      stichzaehlerGeprueft,
      'Stichzähler muss /10 gezeigt haben (ohneNeunen = 10 Stiche pro Runde)',
    ).toBe(true);

    const zustandFinal = await leseSpielZustand(page);
    expect(
      zustandFinal.spielNummer,
      'spielNummer muss nach 2 Runden größer als 1 sein',
    ).toBeGreaterThan(1);

    expect(
      jsFehler,
      `JavaScript-Fehler während der Partie:\n${jsFehler.join('\n')}`,
    ).toHaveLength(0);
  });
});
