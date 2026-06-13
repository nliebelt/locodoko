// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// mockSetzeKiKartenVerzögerung muss vor dem Import von TischBrücke registriert sein
const mockSetzeKiKartenVerzögerung = vi.hoisted(() => vi.fn());
vi.mock('../anwendung', () => ({
  appStore: { setzeKiKartenVerzögerung: mockSetzeKiKartenVerzögerung },
}));

import { richteE2EBrückeEin } from './TischBrücke';

// ---------------------------------------------------------------------------
// Fake-Szene: minimale Struktur über alle Bridge-Methoden
// ---------------------------------------------------------------------------
function baueFakeSzene() {
  return {
    animationsGeschwindigkeit: 1 as number,
    animationen: { setzeGeschwindigkeitsfaktor: vi.fn() },
    flashTextManager: {
      setzeGeschwindigkeitsfaktor: vi.fn(),
      zeigeSpielevent: vi.fn().mockResolvedValue(undefined),
    },
    rundenEndeController: {
      phaserRundenEndeModal: null as any,
      phaserPartieEndeModal: null as any,
      schliesseRundenEndeModal: vi.fn(),
      schliessePartieEndeModal: vi.fn(),
    },
    einstellungenOffen: false,
    isSpielprotokollOffen: vi.fn().mockReturnValue(false),
    isIdle: vi.fn().mockReturnValue(true),
    letzterZustand: null as any,
    letztesModell: null as any,
    toggleSpielprotokoll: vi.fn(),
    kartenRenderer: { zeigeLetztesStichOverlay: vi.fn() },
    scale: { width: 1280, height: 720 },
  };
}

// ---------------------------------------------------------------------------
// Hilfsfunktion: Bridge nach richteE2EBrückeEin() zurückgeben
// ---------------------------------------------------------------------------
function gibBridge() {
  return (window as any).__locodoko;
}

beforeEach(() => {
  (window as any).__locodoko = { appStore: {} as any, getAktuelleSzene: vi.fn() };
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------

describe('richteE2EBrückeEin', () => {
  it('(1) bricht ab wenn window.__locodoko nicht gesetzt ist', () => {
    (window as any).__locodoko = undefined;
    const szene = baueFakeSzene();
    // Kein Fehler, keine Methoden gesetzt
    expect(() => richteE2EBrückeEin(szene as any)).not.toThrow();
    expect((window as any).__locodoko).toBeUndefined();
  });

  it('(2) setzeAnimationsGeschwindigkeit setzt szene.animationsGeschwindigkeit', () => {
    const szene = baueFakeSzene();
    richteE2EBrückeEin(szene as any);
    gibBridge().setzeAnimationsGeschwindigkeit(3);
    expect(szene.animationsGeschwindigkeit).toBe(3);
  });

  it('(3) setzeAnimationsGeschwindigkeit delegiert an animationen und flashTextManager', () => {
    const szene = baueFakeSzene();
    richteE2EBrückeEin(szene as any);
    gibBridge().setzeAnimationsGeschwindigkeit(2);
    expect(szene.animationen.setzeGeschwindigkeitsfaktor).toHaveBeenCalledWith(2);
    expect(szene.flashTextManager.setzeGeschwindigkeitsfaktor).toHaveBeenCalledWith(2);
  });

  it('(4) setzeAnimationsGeschwindigkeit ruft setzeKiKartenVerzögerung(0) nur bei f>=50', () => {
    const szene = baueFakeSzene();
    richteE2EBrückeEin(szene as any);
    gibBridge().setzeAnimationsGeschwindigkeit(3);
    expect(mockSetzeKiKartenVerzögerung).not.toHaveBeenCalled();
    gibBridge().setzeAnimationsGeschwindigkeit(50);
    expect(mockSetzeKiKartenVerzögerung).toHaveBeenCalledWith(0);
  });

  it('(5) setzeAnimationsGeschwindigkeit funktioniert ohne optionale animationen/flashTextManager', () => {
    const szene = { ...baueFakeSzene(), animationen: undefined as any, flashTextManager: undefined as any };
    richteE2EBrückeEin(szene as any);
    expect(() => gibBridge().setzeAnimationsGeschwindigkeit(2)).not.toThrow();
  });

  it('(6) setzeKiVerzoegerung delegiert an appStore.setzeKiKartenVerzögerung', () => {
    const szene = baueFakeSzene();
    richteE2EBrückeEin(szene as any);
    gibBridge().setzeKiVerzoegerung(400);
    expect(mockSetzeKiKartenVerzögerung).toHaveBeenCalledWith(400);
  });

  it('(7) isOverlaySichtbar gibt false zurück wenn kein Overlay aktiv', () => {
    const szene = baueFakeSzene();
    richteE2EBrückeEin(szene as any);
    expect(gibBridge().isOverlaySichtbar()).toBe(false);
  });

  it('(8) isOverlaySichtbar gibt true bei phaserRundenEndeModal', () => {
    const szene = baueFakeSzene();
    szene.rundenEndeController.phaserRundenEndeModal = { visible: true } as any;
    richteE2EBrückeEin(szene as any);
    expect(gibBridge().isOverlaySichtbar()).toBe(true);
  });

  it('(9) isOverlaySichtbar gibt true bei phaserPartieEndeModal', () => {
    const szene = baueFakeSzene();
    szene.rundenEndeController.phaserPartieEndeModal = { visible: true } as any;
    richteE2EBrückeEin(szene as any);
    expect(gibBridge().isOverlaySichtbar()).toBe(true);
  });

  it('(10) isOverlaySichtbar gibt true bei einstellungenOffen', () => {
    const szene = baueFakeSzene();
    szene.einstellungenOffen = true;
    richteE2EBrückeEin(szene as any);
    expect(gibBridge().isOverlaySichtbar()).toBe(true);
  });

  it('(11) isOverlaySichtbar gibt true bei isSpielprotokollOffen()', () => {
    const szene = baueFakeSzene();
    szene.isSpielprotokollOffen.mockReturnValue(true);
    richteE2EBrückeEin(szene as any);
    expect(gibBridge().isOverlaySichtbar()).toBe(true);
  });

  it('(12) isIdle delegiert an szene.isIdle mit ignoreStore', () => {
    const szene = baueFakeSzene();
    richteE2EBrückeEin(szene as any);
    gibBridge().isIdle(true);
    expect(szene.isIdle).toHaveBeenCalledWith(true);
  });

  it('(13) getHudState gibt leere Strings zurück ohne Modell', () => {
    const szene = baueFakeSzene();
    richteE2EBrückeEin(szene as any);
    const state = gibBridge().getHudState();
    expect(state.stichzaehler).toBe('');
    expect(state.spieltyp).toBe('');
  });

  it('(14) getHudState berechnet Stichzähler und Spieltyp korrekt', () => {
    const szene = baueFakeSzene();
    szene.letztesModell = {
      spieltyp: 'NORMAL',
      spieler: [{ stiche: 3 }, { stiche: 4 }, { stiche: 1 }, { stiche: 2 }],
      letzteAbgeschlosseneStiche: [],
    } as any;
    szene.letzterZustand = {
      aktuellerTisch: { konfiguration: { ohneNeunen: false }, status: 'IM_SPIEL', erstelltVonSpielerId: 'x' },
      spieler: { spielerId: 'y' },
    } as any;
    richteE2EBrückeEin(szene as any);
    const state = gibBridge().getHudState();
    expect(state.stichzaehler).toBe('Stich 10/12');
    expect(state.spieltyp).toBe('NORMAL');
    expect(state.startBtnSichtbar).toBe(false); // IM_SPIEL, nicht WARTEND
    expect(state.rundenEndeSichtbar).toBe(false);
  });

  it('(15) getHudState verwendet maxStiche=10 bei ohneNeunen', () => {
    const szene = baueFakeSzene();
    szene.letztesModell = {
      spieltyp: 'SOLO',
      spieler: [{ stiche: 5 }, { stiche: 5 }, { stiche: 0 }, { stiche: 0 }],
      letzteAbgeschlosseneStiche: [],
    } as any;
    szene.letzterZustand = {
      aktuellerTisch: { konfiguration: { ohneNeunen: true }, status: 'WARTEND', erstelltVonSpielerId: 'abc' },
      spieler: { spielerId: 'abc' },
    } as any;
    richteE2EBrückeEin(szene as any);
    const state = gibBridge().getHudState();
    expect(state.stichzaehler).toBe('Stich 10/10');
    expect(state.startBtnSichtbar).toBe(true); // WARTEND + gleiche spielerId
  });

  it('(16) initialisiert _rundenEndeModalGezeigt auf 0 und _letzterFlashTyp auf undefined', () => {
    const szene = baueFakeSzene();
    richteE2EBrückeEin(szene as any);
    expect(gibBridge()._rundenEndeModalGezeigt).toBe(0);
    expect(gibBridge()._letzterFlashTyp).toBeUndefined();
  });

  it('(17) Flash-Text-Interceptor setzt _letzterFlashTyp und ruft Original auf', async () => {
    const szene = baueFakeSzene();
    const originalZeige = szene.flashTextManager.zeigeSpielevent;
    richteE2EBrückeEin(szene as any);
    // Nach richteE2EBrückeEin wurde zeigeSpielevent durch einen Wrapper ersetzt
    await szene.flashTextManager.zeigeSpielevent('SPIEL_GESTARTET' as any, {} as any);
    expect(gibBridge()._letzterFlashTyp).toBe('SPIEL_GESTARTET');
    expect(originalZeige).toHaveBeenCalled();
  });

  it('(18) schliesseRundenEndeModal delegiert an rundenEndeController', () => {
    const szene = baueFakeSzene();
    richteE2EBrückeEin(szene as any);
    gibBridge().schliesseRundenEndeModal();
    expect(szene.rundenEndeController.schliesseRundenEndeModal).toHaveBeenCalled();
  });

  it('(19) schliesseRundenEndeModal funktioniert ohne controller (guard)', () => {
    const szene = { ...baueFakeSzene(), rundenEndeController: undefined as any };
    richteE2EBrückeEin(szene as any);
    expect(() => gibBridge().schliesseRundenEndeModal()).not.toThrow();
  });

  it('(20) toggleSpielprotokoll delegiert an szene.toggleSpielprotokoll mit Modell+Zustand', () => {
    const szene = baueFakeSzene();
    szene.letztesModell = { spieltyp: 'NORMAL' } as any;
    szene.letzterZustand = { aktuellerTisch: {} } as any;
    richteE2EBrückeEin(szene as any);
    gibBridge().toggleSpielprotokoll();
    expect(szene.toggleSpielprotokoll).toHaveBeenCalledWith(szene.letztesModell, szene.letzterZustand);
  });

  it('(21) toggleSpielprotokoll tut nichts ohne Modell', () => {
    const szene = baueFakeSzene();
    szene.letztesModell = null;
    richteE2EBrückeEin(szene as any);
    gibBridge().toggleSpielprotokoll();
    expect(szene.toggleSpielprotokoll).not.toHaveBeenCalled();
  });

  it('(22) zeigeLetztesStichOverlay delegiert an kartenRenderer.zeigeLetztesStichOverlay', () => {
    const szene = baueFakeSzene();
    const stich = { gewinnerPosition: 'SUED', karten: [] };
    szene.letztesModell = { letzteAbgeschlosseneStiche: [stich] } as any;
    szene.letzterZustand = {} as any;
    richteE2EBrückeEin(szene as any);
    gibBridge().zeigeLetztesStichOverlay();
    expect(szene.kartenRenderer.zeigeLetztesStichOverlay).toHaveBeenCalledWith(stich, 1280, 720);
  });

  it('(23) zeigeLetztesStichOverlay tut nichts ohne Modell', () => {
    const szene = baueFakeSzene();
    szene.letztesModell = null;
    richteE2EBrückeEin(szene as any);
    expect(() => gibBridge().zeigeLetztesStichOverlay()).not.toThrow();
    expect(szene.kartenRenderer.zeigeLetztesStichOverlay).not.toHaveBeenCalled();
  });

  it('(24) isPartieEndeModalSichtbar gibt true zurück bei gesetztem phaserPartieEndeModal', () => {
    const szene = baueFakeSzene();
    szene.rundenEndeController.phaserPartieEndeModal = { visible: true } as any;
    richteE2EBrückeEin(szene as any);
    expect(gibBridge().isPartieEndeModalSichtbar()).toBe(true);
  });

  it('(25) isPartieEndeModalSichtbar gibt false zurück ohne Modal', () => {
    const szene = baueFakeSzene();
    richteE2EBrückeEin(szene as any);
    expect(gibBridge().isPartieEndeModalSichtbar()).toBe(false);
  });

  it('(26) schliessePartieEndeModal delegiert an rundenEndeController', () => {
    const szene = baueFakeSzene();
    richteE2EBrückeEin(szene as any);
    gibBridge().schliessePartieEndeModal();
    expect(szene.rundenEndeController.schliessePartieEndeModal).toHaveBeenCalled();
  });
});
