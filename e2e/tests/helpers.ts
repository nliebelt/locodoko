import { type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Typdefinition für window.__locodoko (Bridge zwischen Playwright und der Phaser-App).
 * Direkter Zugriff von Node aus ist in Playwright nicht möglich — alle Zugriffe
 * erfolgen via page.evaluate() / page.waitForFunction().
 */
export interface LocodokoBridge {
  isIdle: (ignoreStore?: boolean) => boolean;
  setzeAnimationsGeschwindigkeit: (geschwindigkeit: number) => void;
  getAktuelleSzene: () => string | null;
  getHudState?: () => {
    stichzaehler: string;
    spieltyp: string;
    startBtnSichtbar: boolean;
    rundenEndeSichtbar: boolean;
  };
  _rundenEndeModalGezeigt?: number;
  appStore: {
    // ... rest of appStore
  };
}

export interface SpielZustand {
  phase: string | null;
  spieltyp: string | null;
  spielbareKarten: string[];
  moeglicheVorbehalte: string[];
  moeglicheAnsagen: string[];
  armutPhase: boolean;
  overlayVisible: boolean;
  aktuelleSzene: string | null;
}

/** Wartet bis window.__locodoko.appStore verfügbar ist. */
export async function getBridge(page: Page): Promise<void> {
  await page.waitForFunction(
    () => !!(window as any).__locodoko?.appStore,
    { timeout: 20_000 },
  );
}

export async function warteAufNaechstesEreignis(page: Page, timeoutMs = 10_000): Promise<void> {
  await page.waitForFunction(() => {
    const loco = (window as any).__locodoko;
    if (typeof loco?.isIdle === 'function') return loco.isIdle() === true;
    return loco?.appStore?.isIdle() === true;
  }, { timeout: timeoutMs });
}

export async function warteAufSzene(page: Page, szeneName: string, timeoutMs = 20_000): Promise<void> {
  await page.waitForFunction(
    (name) => (window as any).__locodoko?.getAktuelleSzene?.() === name,
    szeneName,
    { timeout: timeoutMs }
  );
}

export async function leseSpielZustand(page: Page): Promise<SpielZustand> {
  try {
    await page.waitForFunction(
      () => {
        const loco = (window as any).__locodoko;
        if (typeof loco?.isIdle === 'function') return loco.isIdle() === true;
        return loco?.appStore?.isIdle() === true;
      },
      { timeout: 15_000 },
    );
  } catch (e) {
    const debugInfo = await page.evaluate(() => {
      const loco = (window as any).__locodoko;
      return {
        idleDebug: loco?._idleDebug,
        storeIdleDebug: loco?._storeIdleDebug
      };
    });
    console.error('TIMEOUT WAITING FOR isIdle. DEBUG INFO:', JSON.stringify(debugInfo, null, 2));
    throw e;
  }
  return page.evaluate((): SpielZustand => {
    const loco = (window as any).__locodoko;
    const spiel = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel;
    return {
      phase: spiel?.phase ?? null,
      spieltyp: spiel?.spieltyp ?? null,
      spielbareKarten: spiel?.spielbareKarten?.map((k: any) => k.id) ?? [],
      moeglicheVorbehalte: spiel?.moeglicheVorbehalte ?? [],
      moeglicheAnsagen: spiel?.moeglicheAnsagen ?? [],
      armutPhase: spiel?.phase === 'ARMUT_TAUSCH',
      overlayVisible: (loco as any)?.isOverlaySichtbar?.() === true,
      aktuelleSzene: (loco as any)?.getAktuelleSzene?.() || null,
    };
  });
}

export async function leseHudZustand(page: Page): Promise<{ stichzaehler: string; spieltyp: string; startBtnSichtbar: boolean; rundenEndeSichtbar: boolean }> {
  return page.evaluate(() => {
    const loco = (window as any).__locodoko;
    if (typeof loco?.getHudState === 'function') return loco.getHudState();
    return { stichzaehler: '', spieltyp: '', startBtnSichtbar: false, rundenEndeSichtbar: false };
  });
}

export async function alsGastStarten(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await (window as any).__locodoko.appStore.alsGastStarten();
  });
}

export async function erstelleQuickGame(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await (window as any).__locodoko.appStore.erstelleQuickGame();
  });
}

export async function erstelleKonfiguriertenTisch(
  page: Page,
  name: string,
  konfiguration: Record<string, unknown>,
  privat: boolean,
  ): Promise<void> {
  await page.evaluate(
    async ({ n, k, p }: { n: string; k: Record<string, unknown>; p: boolean }) => {
      const loco = (window as any).__locodoko;
      await loco.appStore.erstelleKonfiguriertenTisch(n, k, p);
    },
    { n: name, k: konfiguration, p: privat },
  );
  }
export async function starteAktuellenTisch(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await (window as any).__locodoko.appStore.starteAktuellenTisch();
  });
}

/**
 * Spielt die erste spielbare Karte per Tastatur (ArrowRight → Enter).
 * Der karteId-Parameter wird ignoriert — alle Aufrufer spielen ohnehin spielbareKarten[0].
 */
export async function spieleKarte(page: Page, _karteId?: string): Promise<void> {
  await spielKarteViaKeyboard(page, 0);
}

/**
 * Spielt eine Karte per Tastaturnavigation.
 * kartenIndex 0 = erste spielbare Karte (1× ArrowRight + Enter).
 */
export async function spielKarteViaKeyboard(page: Page, kartenIndex: number = 0): Promise<void> {
  await page.locator('canvas').focus();
  for (let i = 0; i <= kartenIndex; i++) {
    await page.keyboard.press('ArrowRight');
  }
  await page.keyboard.press('Enter');
}

/**
 * Sendet eine Karte direkt an den Server ohne UI-Validierung (nur für Tests wie ungueltige-karte).
 * Nutzt Bracket-Notation, damit die Test-Infrastruktur keine reguläre Tastatur-Methode imitiert.
 */
export async function spieleKarteViaTestApi(page: Page, karteId: string): Promise<void> {
  await page.evaluate(async (k) => {
    const store = (window as any).__locodoko?.appStore;
    await store?.['spieleKarte']?.(k);
  }, karteId);
}

export async function beantworteArmut(page: Page, annehmen: boolean, karten: string[]): Promise<void> {
  await page.evaluate(
    async ({ a, k }: { a: boolean; k: string[] }) => {
      await (window as any).__locodoko.appStore.beantworteArmut(a, k);
    },
    { a: annehmen, k: karten },
  );
}

export async function spieleErsteHandkarte(page: Page): Promise<void> {
  const zustand = await leseSpielZustand(page);
  if (zustand.spielbareKarten.length === 0) {
    throw new Error('spieleErsteHandkarte: Keine spielbare Karte verfügbar');
  }
  await spielKarteViaKeyboard(page, 0);
}

/**
 * Meldet einen Vorbehalt per Tastatur (Zifferntaste: 1 = erste Option, 2 = zweite, ...).
 * Sucht die Position des Vorbehalts in moeglicheVorbehalte und drückt die entsprechende Ziffer.
 */
export async function meldeVorbehalt(page: Page, vorbehalt: string): Promise<void> {
  const ziffer = await page.evaluate((v) => {
    const loco = (window as any).__locodoko;
    const vorbehalte = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel?.moeglicheVorbehalte ?? [];
    const idx = (vorbehalte as string[]).indexOf(v);
    return idx >= 0 ? idx + 1 : 1;
  }, vorbehalt);
  await page.locator('canvas').focus();
  await page.keyboard.press(String(ziffer));
}

/**
 * Meldet einen Vorbehalt per Tastatur mit direkter Zifferntaste (1-basiert).
 */
export async function meldeVorbehaltViaKeyboard(page: Page, ziffer: number): Promise<void> {
  await page.locator('canvas').focus();
  await page.keyboard.press(String(ziffer));
}

export async function warteAufPhase(page: Page, phase: string, timeoutMs = 30_000): Promise<void> {
  await page.waitForFunction(
    (p) => {
      const loco = (window as any).__locodoko;
      const spiel = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel;
      return spiel?.phase === p;
    },
    phase,
    { timeout: timeoutMs },
  );
}

export async function warteAufEigenenVorbehalt(page: Page, timeoutMs = 30_000): Promise<void> {
  await page.waitForFunction(
    () => {
      const loco = (window as any).__locodoko;
      const spiel = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel;
      return (spiel?.moeglicheVorbehalte?.length ?? 0) > 0;
    },
    { timeout: timeoutMs },
  );
}

export async function warteAufEigenenZug(page: Page, timeoutMs = 30_000): Promise<void> {
  await page.waitForFunction(
    () => {
      const loco = (window as any).__locodoko;
      const spiel = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel;
      return (spiel?.spielbareKarten?.length ?? 0) > 0;
    },
    { timeout: timeoutMs },
  );
}

export async function aktiviereTurbo(page: Page): Promise<void> {
  await page.waitForFunction(
    () => !!(window as any).__locodoko?.setzeAnimationsGeschwindigkeit,
    { timeout: 15_000 },
  );
  await page.evaluate(() => (window as any).__locodoko.setzeAnimationsGeschwindigkeit(Infinity));
}

/**
 * Setzt die Animationsgeschwindigkeit der App.
 * @param geschwindigkeit - Faktor (1.0 = Normal, 0.2 = 5x langsamer, Infinity = sofort)
 */
export async function setzeAnimationsGeschwindigkeit(page: Page, geschwindigkeit: number): Promise<void> {
  await page.waitForFunction(
    () => !!(window as any).__locodoko?.setzeAnimationsGeschwindigkeit,
    { timeout: 15_000 },
  );
  await page.evaluate((v) => (window as any).__locodoko.setzeAnimationsGeschwindigkeit(v), geschwindigkeit);
}


export async function leseRundenEndeModalCount(page: Page): Promise<number> {
  return page.evaluate(() => (window as any).__locodoko?._rundenEndeModalGezeigt ?? 0);
}

export async function schliesseRundenEndeModal(page: Page): Promise<void> {
  await page.evaluate(() => (window as any).__locodoko?.schliesseRundenEndeModal?.());
}

export async function leseRundenauswertung(page: Page): Promise<{ spieltypLabel: string; multiplikator: number | null }> {
  return page.evaluate(() => {
    const loco = (window as any).__locodoko;
    return {
      spieltypLabel: loco?._rundenauswertungSpieltypLabel ?? '',
      multiplikator: loco?._rundenauswertungMultiplikator ?? null,
    };
  });
}

/**
 * Nimmt einen Screenshot auf und speichert ihn in e2e/screenshots/.
 * Erstellt das Verzeichnis falls nicht vorhanden.
 */
export async function screenshot(page: Page, name: string, prefix: string = ''): Promise<void> {
  const screenshotDir = path.join(process.cwd(), 'screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }
  const prefixStr = prefix ? `${prefix}-` : '';
  const pfad = path.join(screenshotDir, `${prefixStr}${name}.png`);
  await page.screenshot({ path: pfad });
}

/**
 * Erstellt 3 Keyframe-Screenshots für eine Animation:
 * - t=0: Sofort nach Aufruf (Startzustand)
 * - t=50%: In der Mitte der erwarteten Dauer (berücksichtigt Slow-Motion-Faktor 0.2)
 * - t=100%: Nach Abschluss aller Animationen (isIdle)
 * 
 * @param page - Playwright Page
 * @param name - Basisname für die Dateien (z.B. 'stich-einzug')
 * @param animationsMs - Erwartete Dauer der Animation bei 1x Geschwindigkeit in ms
 */
export async function screenshotKeyframes(page: Page, name: string, animationsMs: number, prefix: string = ''): Promise<void> {
  // t=0
  await screenshot(page, `${name}-0`, prefix);

  // t=50%
  // Slow-Motion-Faktor 0.2 bedeutet 5x langsamere Geschwindigkeit.
  // Mitte = (animationsMs * 5) * 0.5
  const waitMs = Math.round(animationsMs * 5 * 0.5);
  await page.waitForTimeout(waitMs);
  await screenshot(page, `${name}-50`, prefix);

  // t=100%
  await warteAufNaechstesEreignis(page, 20_000); // Wartet auf isIdle
  await screenshot(page, `${name}-100`, prefix);
}

/**
 * Schreibt console.* und pageerror-Events in e2e/test-results/console-{testName}.log.

 * Format: [HH:MM:SS.mmm] [LEVEL] message
 * Einmalig am Testanfang aufrufen, vor page.goto().
 */
export function aktiviereConsoleCapture(page: Page, testName: string): void {
  const logDir = path.join(process.cwd(), 'test-results');
  fs.mkdirSync(logDir, { recursive: true });
  const sichererId = testName.replace(/[^a-zA-Z0-9\-_]/g, '_');
  const logPfad = path.join(logDir, `console-${sichererId}.log`);
  const stream = fs.createWriteStream(logPfad, { flags: 'w' });

  page.on('console', (msg) => {
    const zeit = new Date().toISOString().substring(11, 23);
    stream.write(`[${zeit}] [${msg.type().toUpperCase()}] ${msg.text()}\n`);
  });

  page.on('pageerror', (err) => {
    const zeit = new Date().toISOString().substring(11, 23);
    stream.write(`[${zeit}] [PAGEERROR] ${err.message}\n`);
  });
}
