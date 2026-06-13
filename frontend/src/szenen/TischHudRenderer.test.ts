// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// appStore Mock
// ---------------------------------------------------------------------------
const mockToggleDebugModus = vi.hoisted(() => vi.fn());
const mockVerlasseAktuellenTisch = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockStarteAktuellenTisch = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockSnapshot = vi.hoisted(() => vi.fn(() => ({ aktuellerTisch: null })));
const mockAktualisiereHintergrund = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockAktualisiereKi = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('../anwendung', () => ({
  appStore: {
    toggleDebugModus: mockToggleDebugModus,
    verlasseAktuellenTisch: mockVerlasseAktuellenTisch,
    starteAktuellenTisch: mockStarteAktuellenTisch,
    snapshot: mockSnapshot,
    aktualisiereAktuellenTischhintergrund: mockAktualisiereHintergrund,
    aktualisiereAktuelleKiSchwierigkeit: mockAktualisiereKi,
  },
}));

import {
  ladeGeschwindigkeit,
  speichereGeschwindigkeit,
  erstellePhaserButton,
  renderHud,
  renderTopBar,
  renderEinstellungsModal,
} from './TischHudRenderer';

// ---------------------------------------------------------------------------
// Phaser-Objekt-Factory: alle zurückgegebenen Objekte sind chainbar
// ---------------------------------------------------------------------------
function chainable(overrides: Record<string, any> = {}) {
  const obj: Record<string, any> = {
    setStrokeStyle: vi.fn().mockReturnThis(),
    setInteractive: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    setOrigin: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    setName: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
    ...overrides,
  };
  return obj;
}

function baueSzene(breite = 1280, hoehe = 720) {
  const addedObjects: any[] = [];
  const ebene = { add: vi.fn((o: any) => { addedObjects.push(o); return o; }) };
  const szene: any = {
    scale: { gameSize: { width: breite, height: hoehe } },
    add: {
      rectangle: vi.fn().mockImplementation(() => chainable()),
      text: vi.fn().mockImplementation((_x, _y, txt) => chainable({ text: txt })),
    },
    scene: { start: vi.fn() },
  };
  return { szene, ebene: ebene as any, addedObjects, textAnrufe: () => szene.add.text.mock.calls };
}

// ---------------------------------------------------------------------------
// ladeGeschwindigkeit / speichereGeschwindigkeit
// ---------------------------------------------------------------------------
describe('ladeGeschwindigkeit', () => {
  beforeEach(() => localStorage.clear());

  it('(1) gibt 1 zurück wenn kein Wert gespeichert', () => {
    expect(ladeGeschwindigkeit()).toBe(1);
  });

  it('(2) gibt 2 zurück wenn "2" gespeichert', () => {
    localStorage.setItem('locodoko.animationsgeschwindigkeit', '2');
    expect(ladeGeschwindigkeit()).toBe(2);
  });

  it('(3) gibt Infinity zurück wenn "sofort" gespeichert', () => {
    localStorage.setItem('locodoko.animationsgeschwindigkeit', 'sofort');
    expect(ladeGeschwindigkeit()).toBe(Infinity);
  });
});

describe('speichereGeschwindigkeit', () => {
  beforeEach(() => localStorage.clear());

  it('(4) speichert 2 als "2"', () => {
    speichereGeschwindigkeit(2);
    expect(localStorage.getItem('locodoko.animationsgeschwindigkeit')).toBe('2');
  });

  it('(5) speichert Infinity als "sofort"', () => {
    speichereGeschwindigkeit(Infinity);
    expect(localStorage.getItem('locodoko.animationsgeschwindigkeit')).toBe('sofort');
  });
});

// ---------------------------------------------------------------------------
// erstellePhaserButton
// ---------------------------------------------------------------------------
describe('erstellePhaserButton', () => {
  it('(6) fügt Hintergrund und Text zur Ebene hinzu', () => {
    const { szene, ebene } = baueSzene();
    erstellePhaserButton(szene, ebene, 100, 50, 80, 30, 'KLICK', vi.fn());
    expect(szene.add.rectangle).toHaveBeenCalled();
    expect(szene.add.text).toHaveBeenCalled();
    expect(ebene.add).toHaveBeenCalledTimes(2);
  });

  it('(7) kein setInteractive wenn disabled=true', () => {
    const { szene, ebene } = baueSzene();
    const bg = chainable();
    szene.add.rectangle.mockReturnValue(bg);
    erstellePhaserButton(szene, ebene, 100, 50, 80, 30, 'X', vi.fn(), true);
    expect(bg.setInteractive).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// renderHud
// ---------------------------------------------------------------------------
describe('renderHud', () => {
  function baueSpieler() {
    return [
      { anzeigeName: 'Alice', stiche: 4, partei: 'RE',  istSelbst: true },
      { anzeigeName: 'Bob',   stiche: 3, partei: null,  istSelbst: false },
    ];
  }

  it('(8) rendert Spieler-Namen ins HUD', () => {
    const { szene, ebene, textAnrufe } = baueSzene();
    const modell = {
      spieler: baueSpieler(),
      gesamtpunktestand: [],
      ansageHistorie: [],
      letzteAbgeschlosseneStiche: [],
    } as any;
    renderHud(szene, ebene, modell, 1280, 720);
    const texte = textAnrufe().map((c: any[]) => c[2]);
    expect(texte).toContain('Alice');
    expect(texte).toContain('Bob');
  });

  it('(9) rendert Punktestand wenn gesamtpunktestand gefüllt', () => {
    const { szene, ebene, textAnrufe } = baueSzene();
    const modell = {
      spieler: baueSpieler(),
      gesamtpunktestand: [{ name: 'RE', punkte: 3 }, { name: 'KONTRA', punkte: -3 }],
      ansageHistorie: [],
      letzteAbgeschlosseneStiche: [],
    } as any;
    renderHud(szene, ebene, modell, 1280, 720);
    const texte = textAnrufe().map((c: any[]) => String(c[2]));
    expect(texte.some((t: string) => t.includes('RE:') && t.includes('+3'))).toBe(true);
  });

  it('(10) rendert Letzte-Stiche-Abschnitt wenn vorhanden', () => {
    const { szene, ebene, textAnrufe } = baueSzene();
    const modell = {
      spieler: baueSpieler(),
      gesamtpunktestand: [],
      ansageHistorie: [],
      letzteAbgeschlosseneStiche: [{ gewinnerName: 'Alice', augen: 27 }],
    } as any;
    renderHud(szene, ebene, modell, 1280, 720);
    const texte = textAnrufe().map((c: any[]) => String(c[2]));
    expect(texte.some((t: string) => t.includes('Alice') && t.includes('27'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// renderTopBar
// ---------------------------------------------------------------------------
describe('renderTopBar', () => {
  function baueBasisModell(spieltyp = '') {
    return { spieler: [{ stiche: 5 }], spieltyp, tischhintergrund: 'OVAL_2' } as any;
  }

  function baueBasisZustand(ohneNeunen = false, status = 'IM_SPIEL') {
    return {
      aktuellerTisch: {
        name: 'Test-Tisch', status,
        konfiguration: { ohneNeunen },
        erstelltVonSpielerId: 'spieler1', einladungsCode: null,
      },
      partieStand: null,
      spieler: { spielerId: 'spieler2' },
      wirdGeladen: false,
    } as any;
  }

  it('(11) zeigt Stichzähler mit maxStiche=12 wenn ohne Neunen=false', () => {
    const { szene, ebene, textAnrufe } = baueSzene();
    const kontext = {
      einstellungenOffen: false, seitenladeOffen: false, spielprotokollOffen: false,
      wirdGeladen: false, onToggleEinstellungen: vi.fn(), onToggleSeitenlade: vi.fn(),
      onToggleSpielprotokoll: vi.fn(), onToggleHilfe: vi.fn(),
    };
    renderTopBar(szene, ebene, baueBasisModell('NORMAL'), baueBasisZustand(false), 1280, kontext);
    const texte = textAnrufe().map((c: any[]) => String(c[2]));
    expect(texte.some((t: string) => t.includes('Stich 5/12'))).toBe(true);
  });

  it('(12) zeigt maxStiche=10 wenn ohneNeunen=true', () => {
    const { szene, ebene, textAnrufe } = baueSzene();
    const kontext = {
      einstellungenOffen: false, seitenladeOffen: false, spielprotokollOffen: false,
      wirdGeladen: false, onToggleEinstellungen: vi.fn(), onToggleSeitenlade: vi.fn(),
      onToggleSpielprotokoll: vi.fn(), onToggleHilfe: vi.fn(),
    };
    renderTopBar(szene, ebene, baueBasisModell('NORMAL'), baueBasisZustand(true), 1280, kontext);
    const texte = textAnrufe().map((c: any[]) => String(c[2]));
    expect(texte.some((t: string) => t.includes('Stich 5/10'))).toBe(true);
  });

  it('(13) rendert Start-Button wenn WARTEND und Eigentümer', () => {
    const { szene, ebene } = baueSzene();
    const zustand = baueBasisZustand(false, 'WARTEND');
    zustand.spieler.spielerId = 'spieler1'; // = erstelltVonSpielerId
    const kontext = {
      einstellungenOffen: false, seitenladeOffen: false, spielprotokollOffen: false,
      wirdGeladen: false, onToggleEinstellungen: vi.fn(), onToggleSeitenlade: vi.fn(),
      onToggleSpielprotokoll: vi.fn(), onToggleHilfe: vi.fn(),
    };
    renderTopBar(szene, ebene, baueBasisModell(), zustand, 1280, kontext);
    // Start-Button ruft erstellePhaserButton auf → add.rectangle zweimal mehr
    // (einmal für TopBar + einmal oder mehr für START-Button)
    expect(szene.add.rectangle.mock.calls.length).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// renderEinstellungsModal
// ---------------------------------------------------------------------------
describe('renderEinstellungsModal', () => {
  function basisKontext(geschw: 1 | 2 | typeof Infinity = 1) {
    return {
      animationsGeschwindigkeit: geschw,
      onEinstellungenSchliessen: vi.fn(),
      onAnimationsGeschwindigkeitAendern: vi.fn(),
    };
  }

  function basisZustand() {
    return {
      aktuellerTisch: {
        name: 'T', status: 'WARTEND', erstelltVonSpielerId: 'ich',
        konfiguration: { kiSchwierigkeit: 'STANDARD' }, einladungsCode: null,
      },
      spieler: { spielerId: 'ich' },
      wirdGeladen: false,
      partieStand: null,
    } as any;
  }

  it('(14) rendert Modal-Elemente (Hintergrund, Panel, Einstellungen-Titel)', () => {
    const { szene, ebene, textAnrufe } = baueSzene();
    const modell = { tischhintergrund: 'OVAL_2', spieler: [], gesamtpunktestand: [], ansageHistorie: [], letzteAbgeschlosseneStiche: [] } as any;
    renderEinstellungsModal(szene, ebene, modell, basisZustand(), 1280, 720, basisKontext());
    const texte = textAnrufe().map((c: any[]) => String(c[2]));
    expect(texte.some((t: string) => t.includes('Einstellungen'))).toBe(true);
  });

  it('(15) rendert Animationsgeschwindigkeit-Label mit aktueller Geschwindigkeit', () => {
    const { szene, ebene, textAnrufe } = baueSzene();
    const modell = { tischhintergrund: 'OVAL_2', spieler: [], gesamtpunktestand: [], ansageHistorie: [], letzteAbgeschlosseneStiche: [] } as any;
    renderEinstellungsModal(szene, ebene, modell, basisZustand(), 1280, 720, basisKontext(2));
    const texte = textAnrufe().map((c: any[]) => String(c[2]));
    expect(texte.some((t: string) => t.includes('Animationen'))).toBe(true);
    // button-label "Geschw.: 2x" wird über erstellePhaserButton als text hinzugefügt
    expect(texte.some((t: string) => t.includes('2x') || t.includes('Geschw.'))).toBe(true);
  });

  it('(16) rendert "Geschw.: sofort" bei Infinity', () => {
    const { szene, ebene, textAnrufe } = baueSzene();
    const modell = { tischhintergrund: 'OVAL_2', spieler: [], gesamtpunktestand: [], ansageHistorie: [], letzteAbgeschlosseneStiche: [] } as any;
    renderEinstellungsModal(szene, ebene, modell, basisZustand(), 1280, 720, basisKontext(Infinity));
    const texte = textAnrufe().map((c: any[]) => String(c[2]));
    expect(texte.some((t: string) => t.includes('sofort'))).toBe(true);
  });
});
