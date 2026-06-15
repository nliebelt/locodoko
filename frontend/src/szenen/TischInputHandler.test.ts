// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TischInputHandler } from './TischInputHandler';
import { SPIELER_POSITION, PARTEI } from '../modelle/TischAnsichtModell';

let mockStore: any;
vi.mock('../anwendung', () => ({
  get appStore() { return mockStore; }
}));

describe('TischInputHandler', () => {
  let handler: TischInputHandler;
  let mockKontext: any;
  let mockModell: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockModell = {
      aktuellerSpieler: SPIELER_POSITION.SUED,
      moeglicheVorbehalte: [],
      moeglicheAnsagen: [],
      spielbareKarten: [],
      armutAktion: null
    };
    mockKontext = {
      getLetztesModell: vi.fn(() => mockModell),
      getLetzterZustand: vi.fn(() => ({})),
      getAusgewaehlteArmutKarten: vi.fn(() => ({ clear: vi.fn() })),
      isSeitenladeOffen: vi.fn(() => false),
      isEinstellungenOffen: vi.fn(() => false),
      isPhaserModalOffen: vi.fn(() => false),
      isSpielzugAnimationAktiv: vi.fn(() => false),
      isArmutAnnahmeAktiv: vi.fn(() => false),
      setArmutAnnahmeAktiv: vi.fn(),
      getTastaturKarteIndex: vi.fn(() => -1),
      setTastaturKarteIndex: vi.fn(),
      getTastaturVorbehaltIndex: vi.fn(() => 0),
      setTastaturVorbehaltIndex: vi.fn(),
      togglSeitenlade: vi.fn(),
      togglEinstellungen: vi.fn(),
      togglHilfe: vi.fn(),
      renderTisch: vi.fn(),
      spieleKarteMitAnimation: vi.fn()
    };
    mockStore = {
      meldeVorbehalt: vi.fn(),
      sageAnsageAn: vi.fn(),
      beantworteArmut: vi.fn()
    };
    handler = new TischInputHandler(mockKontext);
  });

  it('verarbeitet Vorbehalt-Auswahl (Zahlen)', () => {
    mockModell.moeglicheVorbehalte = ['GESUND', 'HOCHZEIT'];
    const event = new KeyboardEvent('keydown', { key: '2' });
    (handler as any).verarbeiteTastatureingabe(event);
    expect(mockStore.meldeVorbehalt).toHaveBeenCalledWith('HOCHZEIT');
  });

  it('verarbeitet Vorbehalt-Navigation (Pfeiltasten)', () => {
    mockModell.moeglicheVorbehalte = ['GESUND', 'HOCHZEIT'];
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
    (handler as any).verarbeiteTastatureingabe(event);
    expect(mockKontext.setTastaturVorbehaltIndex).toHaveBeenCalledWith(1);
  });

  it('bestätigt Vorbehalt mit Enter', () => {
    mockModell.moeglicheVorbehalte = ['GESUND', 'HOCHZEIT'];
    mockKontext.getTastaturVorbehaltIndex.mockReturnValue(1);
    const event = new KeyboardEvent('keydown', { key: 'Enter' });
    (handler as any).verarbeiteTastatureingabe(event);
    expect(mockStore.meldeVorbehalt).toHaveBeenCalledWith('HOCHZEIT');
  });

  it('verarbeitet Ansagen (R/K)', () => {
    mockModell.moeglicheAnsagen = [PARTEI.RE, PARTEI.KONTRA];
    
    (handler as any).verarbeiteTastatureingabe(new KeyboardEvent('keydown', { key: 'r' }));
    expect(mockStore.sageAnsageAn).toHaveBeenCalledWith(PARTEI.RE);

    (handler as any).verarbeiteTastatureingabe(new KeyboardEvent('keydown', { key: 'k' }));
    expect(mockStore.sageAnsageAn).toHaveBeenCalledWith(PARTEI.KONTRA);
  });

  it('verarbeitet Kartennavigation (Pfeiltasten)', () => {
    mockModell.spielbareKarten = ['K1', 'K2', 'K3'];
    mockKontext.getTastaturKarteIndex.mockReturnValue(0);
    
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
    (handler as any).verarbeiteTastatureingabe(event);
    expect(mockKontext.setTastaturKarteIndex).toHaveBeenCalledWith(1);
  });

  it('spielt Karte mit Enter', () => {
    mockModell.spielbareKarten = ['K1', 'K2'];
    mockKontext.getTastaturKarteIndex.mockReturnValue(0);
    
    const event = new KeyboardEvent('keydown', { key: 'Enter' });
    (handler as any).verarbeiteTastatureingabe(event);
    expect(mockKontext.spieleKarteMitAnimation).toHaveBeenCalledWith('K1');
  });

  it('öffnet/schließt Overlays (I, S, Escape)', () => {
    (handler as any).verarbeiteTastatureingabe(new KeyboardEvent('keydown', { key: 'i' }));
    expect(mockKontext.togglSeitenlade).toHaveBeenCalled();

    (handler as any).verarbeiteTastatureingabe(new KeyboardEvent('keydown', { key: 's' }));
    expect(mockKontext.togglEinstellungen).toHaveBeenCalled();

    mockKontext.isSeitenladeOffen.mockReturnValue(true);
    (handler as any).verarbeiteTastatureingabe(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(mockKontext.togglSeitenlade).toHaveBeenCalledTimes(2);
  });

  it('öffnet Einstellungen auch während aktiver Vorbehalt-Auswahl', () => {
    mockModell.moeglicheVorbehalte = ['GESUND', 'HOCHZEIT'];
    (handler as any).verarbeiteTastatureingabe(new KeyboardEvent('keydown', { key: 's' }));
    expect(mockKontext.togglEinstellungen).toHaveBeenCalled();
    expect(mockStore.meldeVorbehalt).not.toHaveBeenCalled();
  });

  it('behandelt Armut-Antwort (A, N)', () => {
    mockModell.armutAktion = { modus: 'ANTWORTEN', kartenAnzahl: 0 };

    (handler as any).verarbeiteTastatureingabe(new KeyboardEvent('keydown', { key: 'a' }));
    expect(mockStore.beantworteArmut).toHaveBeenCalledWith(true, []);

    (handler as any).verarbeiteTastatureingabe(new KeyboardEvent('keydown', { key: 'n' }));
    expect(mockStore.beantworteArmut).toHaveBeenCalledWith(false, []);
  });

  it('ignoriert Tastatureingabe wenn Focus in Formularfeld liegt (C1)', () => {
    // Tippen in einer TEXTAREA (z.B. Bugreport-Dialog) darf keine Spielaktion auslösen
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();

    const event = new KeyboardEvent('keydown', { key: 'i', bubbles: true });
    Object.defineProperty(event, 'target', { value: textarea });
    (handler as any).verarbeiteTastatureingabe(event);

    expect(mockKontext.togglSeitenlade).not.toHaveBeenCalled();
    document.body.removeChild(textarea);
  });

  it('ignoriert Tastatureingabe wenn Phaser-Modal (RundenEnde/PartieEnde) offen ist (C2)', () => {
    // Wenn ein Phaser-Modal offen ist, dürfen keine Navigationskürzel feuern
    mockKontext.isPhaserModalOffen.mockReturnValue(true);

    (handler as any).verarbeiteTastatureingabe(new KeyboardEvent('keydown', { key: 'i' }));
    expect(mockKontext.togglSeitenlade).not.toHaveBeenCalled();

    (handler as any).verarbeiteTastatureingabe(new KeyboardEvent('keydown', { key: 's' }));
    expect(mockKontext.togglEinstellungen).not.toHaveBeenCalled();
  });
});
