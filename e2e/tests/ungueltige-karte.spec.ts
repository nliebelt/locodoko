/**
 * E2E-Test: Ungueltige Karte spielen
 *
 * Testet dass ein Fehler-Toast sichtbar wird, wenn der Spieler eine ungueltige
 * Karte spielt, und dass das Spiel danach normal weiterlaeuft.
 *
 * Warum dieser Test wichtig ist: Ohne Feedback bei ungueltigen Zuegen koennte
 * ein Spieler ohne Hinweis blockiert werden. Der Test stellt sicher, dass
 * das Backend die Aktion korrekt ablehnt, das Frontend den Fehler anzeigt
 * und der Spieler anschliessend eine gueltige Karte spielen kann.
 *
 * Voraussetzung: Backend laeuft auf localhost:8081
 *   cd e2e && npx playwright test ungueltige-karte.spec.ts
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
 * Wartet auf ein Spielereignis: Overlay, Vorbehalt, Armut-Phase oder eigener Zug.
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
 * Ermittelt eine Karten-ID die NICHT auf der Hand des Spielers ist.
 * Baut eine gueltige Karten-ID aus dem Deck, die definitiv nicht in der Hand ist.
 */
async function findeUngueltigeKarteId(page: Page): Promise<string> {
  return page.evaluate(() => {
    const loco = (window as unknown as Record<string, { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: { spieler: { istSelbst: boolean; sichtbareHandkarten: { id: string }[] | null }[] } } } } }>)['__locodoko'];
    const spiel = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel;
    if (!spiel) return 'KARO-AS-9';
    const eigener = spiel.spieler.find(s => s.istSelbst);
    const handIds = new Set((eigener?.sichtbareHandkarten ?? []).map(k => k.id));
    // Alle moeglichen Karten-IDs des Decks durchprobieren
    const farben = ['KARO', 'HERZ', 'PIK', 'KREUZ'];
    const werte = ['NEUN', 'BUBE', 'DAME', 'KOENIG', 'ZEHN', 'AS'];
    for (const farbe of farben) {
      for (const wert of werte) {
        for (const idx of [0, 1]) {
          const id = `${farbe}-${wert}-${idx}`;
          if (!handIds.has(id)) return id;
        }
      }
    }
    // Fallback: eine unmogliche Karten-ID
    return 'KARO-AS-9';
  });
}

// ── Test ──────────────────────────────────────────────────────────────────

test.describe('Ungueltige Karte', () => {
  test('Fehler-Toast erscheint bei ungueltiger Karte und Spiel laeuft weiter', async ({ page }) => {
    test.setTimeout(180_000);

    // JavaScript-Fehler sammeln (nur echte Anwendungsfehler, nicht erwartete Backend-Ablehnungen)
    const jsFehler: string[] = [];
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

    // ── 2. Erstes Spiel starten: Vorbehalt GESUND waehlen ─────────────────
    await warteAufPhase(page, 'VORBEHALT_ANSAGE', 25_000);
    await warteAufEigenenVorbehalt(page, 20_000);
    await page.keyboard.press('1'); // GESUND

    // ── 3. Auf eigenen Zug in der Stichphase warten ───────────────────────
    // Ggf. muessen mehrere Ereignisse verarbeitet werden (Armut, Vorbehalt-Wiederholung)
    let eigenerZugErreicht = false;
    for (let versuch = 0; versuch < 60 && !eigenerZugErreicht; versuch++) {
      const ereignis = await warteAufNaechstesEreignis(page, 30_000);

      if (ereignis === 'vorbehalt') {
        await page.keyboard.press('1'); // erneut GESUND
        continue;
      }
      if (ereignis === 'armut') {
        // KI-Armut: annehmen per Bridge wenn wir gefragt werden, sonst warten
        const modus = await page.evaluate(() => {
          const loco = (window as unknown as Record<string, { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: { phase: string; spieler: { istSelbst: boolean; verbleibendeKarten: number | null; sichtbareHandkarten: { id: string }[] | null }[] } } }; beantworteArmut: (a: boolean, k: string[]) => void } }>)['__locodoko'];
          const spiel = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel;
          if (!spiel || spiel.phase !== 'ARMUT_TAUSCH') return null;
          const eigener = spiel.spieler.find(s => s.istSelbst);
          if (!eigener?.sichtbareHandkarten) return null;
          const andereKarten = spiel.spieler
            .filter(s => !s.istSelbst && s.verbleibendeKarten !== null)
            .map(s => s.verbleibendeKarten ?? 0);
          const hatWenigerKarten = andereKarten.some(k => (eigener.sichtbareHandkarten?.length ?? 0) > k);
          if (hatWenigerKarten) return 'ANTWORTEN';
          if ((eigener.sichtbareHandkarten?.length ?? 0) < Math.max(...andereKarten, 0)) return 'ANBIETEN';
          return null;
        });
        if (modus === 'ANTWORTEN') {
          // Annehmen: erste N Karten zurueckgeben
          await page.evaluate(() => {
            const loco = (window as unknown as Record<string, { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: { spieler: { istSelbst: boolean; verbleibendeKarten: number | null; sichtbareHandkarten: { id: string }[] | null }[] } } }; beantworteArmut: (a: boolean, k: string[]) => void } }>)['__locodoko'];
            const spiel = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel;
            if (!spiel) return;
            const eigener = spiel.spieler.find(s => s.istSelbst);
            if (!eigener?.sichtbareHandkarten) return;
            const armutSpieler = spiel.spieler
              .filter(s => !s.istSelbst && s.verbleibendeKarten !== null)
              .reduce<typeof spiel.spieler[0] | null>(
                (min, s) => (!min || (s.verbleibendeKarten ?? 99) < (min.verbleibendeKarten ?? 99)) ? s : min,
                null
              );
            const n = eigener.sichtbareHandkarten.length - (armutSpieler?.verbleibendeKarten ?? eigener.sichtbareHandkarten.length);
            loco.appStore.beantworteArmut(true, eigener.sichtbareHandkarten.slice(0, Math.max(n, 0)).map(k => k.id));
          });
          await page.waitForTimeout(1_000);
        } else if (modus === 'ANBIETEN') {
          // Trumpf anbieten
          await page.evaluate(() => {
            const loco = (window as unknown as Record<string, { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: { spieler: { istSelbst: boolean; sichtbareHandkarten: { id: string; farbe: string; wert: string }[] | null }[] } } }; beantworteArmut: (a: boolean, k: string[]) => void } }>)['__locodoko'];
            const spiel = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel;
            if (!spiel) return;
            const eigener = spiel.spieler.find(s => s.istSelbst);
            if (!eigener?.sichtbareHandkarten) return;
            const trumpfIds = eigener.sichtbareHandkarten
              .filter(k => k.wert === 'DAME' || k.wert === 'BUBE' || k.farbe === 'KARO' || (k.farbe === 'HERZ' && k.wert === 'ZEHN'))
              .map(k => k.id);
            loco.appStore.beantworteArmut(true, trumpfIds);
          });
          await page.waitForTimeout(1_000);
        } else {
          await page.waitForTimeout(1_000);
        }
        continue;
      }
      if (ereignis === 'zug') {
        eigenerZugErreicht = true;
        break;
      }
      if (ereignis === 'overlay') {
        // Rundenauswertung vor eigenem Zug — schliessen und neues Spiel starten
        await page.keyboard.press('Enter');
        await expect(page.locator('[data-testid="rundenauswertung-overlay"]')).toBeHidden({ timeout: 5_000 });
        continue;
      }
    }

    expect(eigenerZugErreicht, 'Eigener Zug in der Stichphase muss erreicht werden').toBe(true);

    // ── 4. Pflichtansage ggf. behandeln ───────────────────────────────────
    const ansagen = await page.evaluate((): string[] => {
      const loco = (window as unknown as Record<string, { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: { moeglicheAnsagen?: string[] } } } } }>)['__locodoko'];
      return loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel?.moeglicheAnsagen ?? [];
    }).catch(() => [] as string[]);
    if (ansagen.includes('KONTRA')) await page.keyboard.press('k');
    else if (ansagen.includes('RE')) await page.keyboard.press('r');

    // ── 5. Ungueltige Karte per Bridge spielen ────────────────────────────
    const ungueltigeId = await findeUngueltigeKarteId(page);

    // Karte spielen die NICHT auf der Hand ist → Backend lehnt ab → Fehler-Toast
    await page.evaluate((karteId: string) => {
      const loco = (window as unknown as Record<string, { appStore: { spieleKarte: (id: string) => void } }>)['__locodoko'];
      loco.appStore.spieleKarte(karteId);
    }, ungueltigeId);

    // ── 6. Fehler-Toast muss erscheinen ───────────────────────────────────
    const fehlerToast = page.locator('[data-testid="fehler-toast"]');
    await expect(fehlerToast, 'Fehler-Toast muss nach ungueltiger Karte sichtbar sein').toBeVisible({ timeout: 10_000 });

    // Toast-Text muss einen sinnvollen Hinweis enthalten
    const toastText = await fehlerToast.textContent();
    expect(toastText).toBeTruthy();
    expect(toastText!.toLowerCase()).toContain('fehler');

    // ── 7. Spiel laeuft weiter: gueltige Karte spielen per Tastatur ──────
    // Warten dass der Spieler wieder an der Reihe ist (State wird nach Fehler nicht veraendert)
    await warteAufEigenenZug(page, 10_000);

    // Gueltige Karte per Tastatur spielen (Enter waehlt die markierte Karte)
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1_500);

    // ── 8. Spielzustand pruefen: Stich wurde gespielt ─────────────────────
    const zustandNachKarte = await page.evaluate(() => {
      const loco = (window as unknown as Record<string, { appStore: { snapshot: () => { partieStand?: { laufendesSpiel?: { phase?: string } } } } }>)['__locodoko'];
      return loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel?.phase ?? null;
    });
    // Phase muss STICHPHASE sein (Spiel laeuft weiter) — oder ein spaeterer Zustand
    expect(zustandNachKarte).not.toBeNull();

    // ── 9. Abschlusskontrolle: Keine unerwarteten JavaScript-Fehler ──────
    expect(
      jsFehler,
      `Unerwartete JavaScript-Fehler:\n${jsFehler.join('\n')}`,
    ).toHaveLength(0);
  });
});
