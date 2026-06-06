// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { TischAnsichtModell } from '../modelle/TischAnsichtModell';
import type { AppZustand } from '../store/AppStore';
import type { TischSpieleventKontext } from './TischSpieleventRenderer';

// ── Phaser-Mock ───────────────────────────────────────────────────────────────

class FakeGameObject {
  x = 0; y = 0; width = 80; name = '';
  setOrigin() { return this; }
  setInteractive() { return this; }
  setStrokeStyle() { return this; }
  setName(n: string) { this.name = n; return this; }
  on(_ev: string, cb: () => void) { (this as any)._handler = cb; return this; }
  trigger() { (this as any)._handler?.(); }
}

class FakeContainer {
  list: FakeGameObject[] = [];
  add(obj: any) {
    if (Array.isArray(obj)) this.list.push(...obj);
    else this.list.push(obj);
    return this;
  }
  addedTexts(): string[] {
    return this.list.filter((o: any) => typeof o._text === 'string').map((o: any) => o._text);
  }
  addedNames(): string[] {
    return this.list.map((o) => o.name).filter(Boolean);
  }
}

function baueFakeSzene() {
  const szene: any = {
    add: {
      text: vi.fn((x: number, y: number, text: string) => {
        const obj = new FakeGameObject();
        obj.x = x; obj.y = y;
        (obj as any)._text = text;
        return obj;
      }),
      rectangle: vi.fn(() => new FakeGameObject()),
    },
    scale: { gameSize: { width: 1280 } },
  };
  return szene;
}

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockAppStore = {
  sageAnsageAn: vi.fn(),
  beantworteArmut: vi.fn(),
};
vi.mock('../anwendung', () => ({ appStore: mockAppStore }));

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function basisModell(overrides: Partial<TischAnsichtModell> = {}): TischAnsichtModell {
  return {
    aktuellerSpieler: 'SUED',
    moeglicheVorbehalte: [],
    moeglicheAnsagen: [],
    deklarierteVorbehalte: [],
    spieler: [],
    armutAktion: null,
    spielbareKarten: [],
    aktuelleStichmitte: [],
    ansageHistorie: [],
    gesamtpunktestand: [],
    letzteAbgeschlosseneStiche: [],
    letztesSpielergebnis: null,
    partieBeendet: false,
    spielankuendigungstext: null,
    schweinchenGemeldetVon: null,
    spieltyp: null,
    phase: null,
    titel: '',
    untertitel: '',
    debugModus: false,
    tischhintergrund: 'FILZ_GRUEN',
    ...overrides,
  } as TischAnsichtModell;
}

function basisZustand(): AppZustand {
  return { wirdGeladen: false } as unknown as AppZustand;
}

function basisKontext(overrides: Partial<TischSpieleventKontext> = {}): TischSpieleventKontext {
  return {
    wartendeKartenId: null,
    animationLaeuft: false,
    ausgewaehlteArmutKarten: new Set(),
    armutAnnahmeAktiv: false,
    tastaturVorbehaltIndex: 0,
    onTastaturVorbehaltIndexAendern: vi.fn(),
    onRenderTisch: vi.fn(),
    onArmutKarteToggle: vi.fn(),
    onBestaetigeArmut: vi.fn(),
    onArmutAnnahmeAktivSetzen: vi.fn(),
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

const { renderVorbehaltLabel, renderAnsageButtons, renderArmutBereich } = await import('./TischSpieleventRenderer');

describe('renderVorbehaltLabel', () => {
  let szene: any;
  let ebene: FakeContainer;

  beforeEach(() => {
    szene = baueFakeSzene();
    ebene = new FakeContainer();
  });

  it('rendert nichts wenn aktuellerSpieler nicht SUED ist', () => {
    const modell = basisModell({ aktuellerSpieler: 'NORD', moeglicheVorbehalte: ['GESUND', 'SOLO_DAME'] as any });
    renderVorbehaltLabel(szene, ebene as any, modell, 1280, 720, basisKontext());
    expect(ebene.list).toHaveLength(0);
  });

  it('rendert nichts wenn moeglicheVorbehalte leer ist', () => {
    const modell = basisModell({ aktuellerSpieler: 'SUED', moeglicheVorbehalte: [] });
    renderVorbehaltLabel(szene, ebene as any, modell, 1280, 720, basisKontext());
    expect(ebene.list).toHaveLength(0);
  });

  it('rendert Vorbehalt-Text wenn SUED an der Reihe', () => {
    const modell = basisModell({ aktuellerSpieler: 'SUED', moeglicheVorbehalte: ['GESUND'] as any });
    renderVorbehaltLabel(szene, ebene as any, modell, 1280, 720, basisKontext());
    expect(ebene.list.length).toBeGreaterThan(0);
    expect(szene.add.text).toHaveBeenCalled();
  });

  it('zeigt den aktuell ausgewaehlten Vorbehalt per tastaturVorbehaltIndex', () => {
    const modell = basisModell({
      aktuellerSpieler: 'SUED',
      moeglicheVorbehalte: ['GESUND', 'SOLO_DAME'] as any,
    });
    const kontext = basisKontext({ tastaturVorbehaltIndex: 1 });
    renderVorbehaltLabel(szene, ebene as any, modell, 1280, 720, kontext);
    const calls: string[] = szene.add.text.mock.calls.map((c: any[]) => c[2]);
    expect(calls.some((t) => t.includes('Damensolo') || t.includes('SOLO_DAME'))).toBe(true);
  });

  it('rendert Pfeile (◄ und ►) fuer Navigation', () => {
    const modell = basisModell({
      aktuellerSpieler: 'SUED',
      moeglicheVorbehalte: ['GESUND', 'SOLO_DAME'] as any,
    });
    renderVorbehaltLabel(szene, ebene as any, modell, 1280, 720, basisKontext());
    const calls: string[] = szene.add.text.mock.calls.map((c: any[]) => c[2]);
    expect(calls.some((t) => t.includes('◄'))).toBe(true);
    expect(calls.some((t) => t.includes('►'))).toBe(true);
  });

  it('tastaturVorbehaltIndex wird auf max begrenzt wenn zu gross', () => {
    const modell = basisModell({
      aktuellerSpieler: 'SUED',
      moeglicheVorbehalte: ['GESUND'] as any,
    });
    const kontext = basisKontext({ tastaturVorbehaltIndex: 99 });
    expect(() => renderVorbehaltLabel(szene, ebene as any, modell, 1280, 720, kontext)).not.toThrow();
  });
});

describe('renderAnsageButtons', () => {
  let szene: any;
  let ebene: FakeContainer;

  beforeEach(() => {
    szene = baueFakeSzene();
    ebene = new FakeContainer();
    vi.clearAllMocks();
  });

  it('rendert nichts wenn aktuellerSpieler nicht SUED ist', () => {
    const modell = basisModell({ aktuellerSpieler: 'WEST', moeglicheAnsagen: ['RE'] as any });
    renderAnsageButtons(szene, ebene as any, modell, basisZustand(), 1280, 720, basisKontext());
    expect(ebene.list).toHaveLength(0);
  });

  it('rendert nichts wenn moeglicheAnsagen leer ist', () => {
    const modell = basisModell({ aktuellerSpieler: 'SUED', moeglicheAnsagen: [] });
    renderAnsageButtons(szene, ebene as any, modell, basisZustand(), 1280, 720, basisKontext());
    expect(ebene.list).toHaveLength(0);
  });

  it('rendert Buttons fuer jede moegliche Ansage', () => {
    const modell = basisModell({
      aktuellerSpieler: 'SUED',
      moeglicheAnsagen: ['RE', 'KONTRA'] as any,
    });
    renderAnsageButtons(szene, ebene as any, modell, basisZustand(), 1280, 720, basisKontext());
    expect(ebene.list.length).toBeGreaterThan(0);
    // Jede Ansage erzeugt mind. einen Rectangle (Button-Hintergrund) und einen Text
    const namenImEbene = ebene.addedNames();
    expect(namenImEbene).toContain('btn-ansage-re');
    expect(namenImEbene).toContain('btn-ansage-kontra');
  });

  it('rendert Button fuer einzelne RE-Ansage', () => {
    const modell = basisModell({
      aktuellerSpieler: 'SUED',
      moeglicheAnsagen: ['RE'] as any,
    });
    renderAnsageButtons(szene, ebene as any, modell, basisZustand(), 1280, 720, basisKontext());
    expect(ebene.addedNames()).toContain('btn-ansage-re');
  });

  it('deaktiviert Buttons wenn Animation laeuft', () => {
    const modell = basisModell({
      aktuellerSpieler: 'SUED',
      moeglicheAnsagen: ['RE'] as any,
      spielbareKarten: [],
    });
    const kontext = basisKontext({ animationLaeuft: true });
    // Darf nicht werfen; Buttons werden deaktiviert gerendert
    expect(() =>
      renderAnsageButtons(szene, ebene as any, modell, basisZustand(), 1280, 720, kontext)
    ).not.toThrow();
    expect(ebene.list.length).toBeGreaterThan(0);
  });
});

describe('renderArmutBereich', () => {
  let szene: any;
  let ebene: FakeContainer;

  beforeEach(() => {
    szene = baueFakeSzene();
    ebene = new FakeContainer();
    vi.clearAllMocks();
  });

  it('rendert nichts wenn armutAktion null ist', () => {
    const modell = basisModell({ aktuellerSpieler: 'SUED', armutAktion: null });
    renderArmutBereich(szene, ebene as any, modell, basisZustand(), 1280, 720, basisKontext());
    expect(ebene.list).toHaveLength(0);
  });

  it('rendert nichts wenn aktuellerSpieler nicht SUED ist', () => {
    const modell = basisModell({
      aktuellerSpieler: 'NORD',
      armutAktion: { modus: 'ANBIETEN', kartenAnzahl: 3, armutSpielerPosition: 'SUED', armutSpielerName: 'Ich' },
    });
    renderArmutBereich(szene, ebene as any, modell, basisZustand(), 1280, 720, basisKontext());
    expect(ebene.list).toHaveLength(0);
  });

  it('ANBIETEN-Modus rendert Anbieten-Button', () => {
    const modell = basisModell({
      aktuellerSpieler: 'SUED',
      armutAktion: { modus: 'ANBIETEN', kartenAnzahl: 3, armutSpielerPosition: 'SUED', armutSpielerName: 'Ich' },
    });
    renderArmutBereich(szene, ebene as any, modell, basisZustand(), 1280, 720, basisKontext());
    expect(ebene.addedNames()).toContain('btn-armut-anbieten');
  });

  it('ANTWORTEN-Modus rendert Annehmen- und Ablehnen-Buttons', () => {
    const modell = basisModell({
      aktuellerSpieler: 'SUED',
      armutAktion: { modus: 'ANTWORTEN', kartenAnzahl: 2, armutSpielerPosition: 'SUED', armutSpielerName: 'Ich' },
    });
    renderArmutBereich(szene, ebene as any, modell, basisZustand(), 1280, 720, basisKontext());
    const namen = ebene.addedNames();
    expect(namen).toContain('btn-armut-annehmen');
    expect(namen).toContain('btn-armut-ablehnen');
  });

  it('ANTWORTEN-Modus mit armutAnnahmeAktiv rendert Annahme-Bestaetigen-Button', () => {
    const modell = basisModell({
      aktuellerSpieler: 'SUED',
      armutAktion: { modus: 'ANTWORTEN', kartenAnzahl: 2, armutSpielerPosition: 'SUED', armutSpielerName: 'Ich' },
    });
    const kontext = basisKontext({
      armutAnnahmeAktiv: true,
      ausgewaehlteArmutKarten: new Set(['k1', 'k2']),
    });
    renderArmutBereich(szene, ebene as any, modell, basisZustand(), 1280, 720, kontext);
    const namen = ebene.addedNames();
    expect(namen).toContain('btn-armut-annahme-bestaetigen');
    expect(namen).toContain('btn-armut-abbrechen');
  });

  it('ANBIETEN-Modus zeigt Anzahl-Hinweistext', () => {
    const modell = basisModell({
      aktuellerSpieler: 'SUED',
      armutAktion: { modus: 'ANBIETEN', kartenAnzahl: 3, armutSpielerPosition: 'SUED', armutSpielerName: 'Ich' },
    });
    renderArmutBereich(szene, ebene as any, modell, basisZustand(), 1280, 720, basisKontext());
    const calls: string[] = szene.add.text.mock.calls.map((c: any[]) => c[2]);
    expect(calls.some((t) => t.includes('3'))).toBe(true);
  });
});
