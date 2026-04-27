import { type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Typdefinition für window.__locodoko (Bridge zwischen Playwright und der Phaser-App).
 * Direkter Zugriff von Node aus ist in Playwright nicht möglich — alle Zugriffe
 * erfolgen via page.evaluate() / page.waitForFunction().
 */
export interface LocodokoBridge {
  isIdle: () => boolean;
  setzeAnimationsGeschwindigkeit: (geschwindigkeit: number) => void;
  _rundenEndeModalGezeigt?: number;
  appStore: {
    isIdle: () => boolean;
    snapshot: () => {
      partieStand?: {
        laufendesSpiel?: {
          phase?: string;
          spieltyp?: string | null;
          spielbareKarten?: Array<{ id: string }>;
          moeglicheVorbehalte?: string[];
          moeglicheAnsagen?: string[];
        };
      };
    };
    alsGastStarten: () => Promise<void>;
    erstelleQuickGame: () => Promise<void>;
    erstelleKonfiguriertenTisch: (
      name: string,
      konfiguration: Record<string, unknown>,
      privat: boolean,
    ) => Promise<void>;
    starteAktuellenTisch: () => Promise<void>;
    meldeVorbehalt: (vorbehalt: string) => Promise<void>;
    beantworteArmut: (annehmen: boolean, karten: string[]) => Promise<void>;
    spieleKarte: (karteId: string) => Promise<void>;
    sageAnsageAn: (ansage: string) => Promise<void>;
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

export async function warteAufPhase(page: Page, phase: string, timeoutMs = 20_000): Promise<void> {
  await page.waitForFunction(
    (gesuchtePhase: string) => {
      const loco = (window as any).__locodoko;
      const idle = typeof loco?.isIdle === 'function' ? loco.isIdle() : loco?.appStore?.isIdle();
      if (!idle) return false;
      return loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel?.phase === gesuchtePhase;
    },
    phase,
    { timeout: timeoutMs },
  );
}

export async function warteAufEigenenVorbehalt(page: Page, timeoutMs = 15_000): Promise<void> {
  await page.waitForFunction(
    () => {
      const loco = (window as any).__locodoko;
      const idle = typeof loco?.isIdle === 'function' ? loco.isIdle() : loco?.appStore?.isIdle();
      if (!idle) return false;
      const vorbehalte = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel?.moeglicheVorbehalte;
      return (vorbehalte?.length ?? 0) > 0;
    },
    { timeout: timeoutMs },
  );
}

export async function warteAufEigenenZug(page: Page, timeoutMs = 25_000): Promise<void> {
  await page.waitForFunction(
    () => {
      const loco = (window as any).__locodoko;
      const idle = typeof loco?.isIdle === 'function' ? loco.isIdle() : loco?.appStore?.isIdle();
      if (!idle) return false;
      const spiel = loco?.appStore?.snapshot()?.partieStand?.laufendesSpiel;
      return spiel?.phase === 'STICHPHASE' && (spiel?.spielbareKarten?.length ?? 0) > 0;
    },
    { timeout: timeoutMs },
  );
}

export async function leseSpielZustand(page: Page): Promise<SpielZustand> {
  await page.waitForFunction(
    () => {
      const loco = (window as any).__locodoko;
      if (typeof loco?.isIdle === 'function') return loco.isIdle() === true;
      return loco?.appStore?.isIdle() === true;
    },
    { timeout: 15_000 },
  );
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
    };
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

export async function spieleKarte(page: Page, karteId: string): Promise<void> {
  await page.evaluate((k) => (window as any).__locodoko.appStore.spieleKarte(k), karteId);
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
  await page.evaluate(
    (k) => (window as any).__locodoko.appStore.spieleKarte(k),
    zustand.spielbareKarten[0],
  );
}

export async function meldeVorbehalt(page: Page, vorbehalt: string): Promise<void> {
  await page.evaluate((v) => (window as any).__locodoko.appStore.meldeVorbehalt(v), vorbehalt);
}

export async function aktiviereTurbo(page: Page): Promise<void> {
  await page.waitForFunction(
    () => !!(window as any).__locodoko?.setzeAnimationsGeschwindigkeit,
    { timeout: 15_000 },
  );
  await page.evaluate(() => (window as any).__locodoko.setzeAnimationsGeschwindigkeit(Infinity));
}

export async function leseRundenEndeModalCount(page: Page): Promise<number> {
  return page.evaluate(() => (window as any).__locodoko?._rundenEndeModalGezeigt ?? 0);
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
