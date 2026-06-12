import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SonderpunktEreignisAntwortDto, TischAntwort } from '../modelle/SpielverwaltungDto';
import { erzeugeAnfangszustand } from '../store/StoreTypen';
import type { AppZustand } from '../store/StoreTypen';
import type { TischSzene } from './TischSzene';
import { richteStoreAbonnementsEin } from './TischStoreAbonnements';

// === AppStore-Mock als Singleton aus ../anwendung ===
const appStoreHarness = vi.hoisted(() => {
  let eventListener: ((e: unknown) => void | Promise<void>) | undefined;
  let storeListener: ((z: AppZustand) => void) | undefined;
  let sonderpunkteListener: ((sp: SonderpunktEreignisAntwortDto[]) => void) | undefined;

  const unsubEvents = vi.fn();
  const unsubStore = vi.fn();
  const unsubSonderpunkte = vi.fn();

  return {
    async sendeEvent(e: unknown): Promise<void> { await eventListener?.(e); },
    sendeZustand(z: AppZustand): void { storeListener?.(z); },
    sendeSonderpunkte(sp: SonderpunktEreignisAntwortDto[]): void { sonderpunkteListener?.(sp); },
    unsubEvents,
    unsubStore,
    unsubSonderpunkte,
    store: {
      abonniereEvents: vi.fn().mockImplementation((cb: (e: unknown) => void | Promise<void>) => {
        eventListener = cb;
        return unsubEvents;
      }),
      abonniere: vi.fn().mockImplementation((cb: (z: AppZustand) => void) => {
        storeListener = cb;
        return unsubStore;
      }),
      abonniereSonderpunkte: vi.fn().mockImplementation((cb: (sp: SonderpunktEreignisAntwortDto[]) => void) => {
        sonderpunkteListener = cb;
        return unsubSonderpunkte;
      }),
      pausiereQueue: vi.fn(),
    },
  };
});

vi.mock('../anwendung', () => ({ appStore: appStoreHarness.store }));
vi.mock('./layout', () => ({
  nameplatePositionFuer: vi.fn().mockReturnValue({ x: 100, y: 200 }),
}));

// === Fake-Szene mit allen von richteStoreAbonnementsEin verwendeten Properties ===
type FakeModell = {
  letztesSpielergebnis: unknown;
  spieler: Array<{ absolutePosition: string | null; position: string; name: string }>;
};

function baueSzene() {
  const verarbeitePartieEreignis = vi.fn().mockResolvedValue(undefined);
  const reiheEin = vi.fn().mockResolvedValue(undefined);
  const zeigeSpielevent = vi.fn().mockResolvedValue(undefined);
  const shake = vi.fn();
  const fakeModell: FakeModell = { letztesSpielergebnis: null, spieler: [] };

  const szene = {
    ereignisHandler: { verarbeitePartieEreignis },
    animationen: { reiheEin },
    sys: { displayList: {} as unknown },
    triggerRender: vi.fn(),
    scene: { start: vi.fn() },
    letzterZustand: undefined as AppZustand | undefined,
    initialisiereZustand: vi.fn(),
    erstelleModell: vi.fn<(zustand: unknown) => FakeModell>().mockReturnValue(fakeModell),
    zustandsKontroller: { synchronisiereAnimationszustand: vi.fn() },
    letztesModell: null as FakeModell | null,
    aktualisiereUi: vi.fn(),
    _zeigeOverlayNachSnapshot: null as { spielNummer: number; partieBeendet: boolean } | null,
    rundenEndeController: {
      zeigePartieEndeModal: vi.fn(),
      zeigeRundenEndeModal: vi.fn().mockResolvedValue(undefined),
    },
    scale: { gameSize: { width: 1280, height: 720 } },
    flashTextManager: { zeigeSpielevent },
    nameplates: new Map<string, { shake: ReturnType<typeof vi.fn> }>([['SUED', { shake }]]),
  };
  return { szene, verarbeitePartieEreignis, reiheEin, zeigeSpielevent, shake, fakeModell };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('richteStoreAbonnementsEin()', () => {
  describe('Registrierung', () => {
    it('registriert alle 3 AppStore-Abonnements beim Aufruf', () => {
      const { szene } = baueSzene();

      richteStoreAbonnementsEin(szene as unknown as TischSzene);

      expect(appStoreHarness.store.abonniereEvents).toHaveBeenCalledOnce();
      expect(appStoreHarness.store.abonniere).toHaveBeenCalledOnce();
      expect(appStoreHarness.store.abonniereSonderpunkte).toHaveBeenCalledOnce();
    });
  });

  describe('abonniereEvents', () => {
    it('ruft verarbeitePartieEreignis mit dem empfangenen Ereignis auf', async () => {
      const { szene, verarbeitePartieEreignis } = baueSzene();
      richteStoreAbonnementsEin(szene as unknown as TischSzene);
      const ereignis = { ereignisTyp: 'KARTE_GESPIELT' };

      await appStoreHarness.sendeEvent(ereignis);

      expect(verarbeitePartieEreignis).toHaveBeenCalledWith(ereignis);
    });

    it('reiht nach Ereignisverarbeitung eine Animation in die Queue ein', async () => {
      const { szene, reiheEin } = baueSzene();
      richteStoreAbonnementsEin(szene as unknown as TischSzene);

      await appStoreHarness.sendeEvent({ ereignisTyp: 'KARTE_GESPIELT' });

      expect(reiheEin).toHaveBeenCalledOnce();
    });
  });

  describe('Store-Listener', () => {
    it('wechselt bei bereich=SPIELVERWALTUNG zur SpielverwaltungsSzene', () => {
      const { szene } = baueSzene();
      richteStoreAbonnementsEin(szene as unknown as TischSzene);

      appStoreHarness.sendeZustand({ ...erzeugeAnfangszustand(), bereich: 'SPIELVERWALTUNG' });

      expect(szene.scene.start).toHaveBeenCalledWith('SpielverwaltungsSzene');
    });

    it('meldet Events- und Store-Abo bei SPIELVERWALTUNG ab', () => {
      const { szene } = baueSzene();
      richteStoreAbonnementsEin(szene as unknown as TischSzene);

      appStoreHarness.sendeZustand({ ...erzeugeAnfangszustand(), bereich: 'SPIELVERWALTUNG' });

      expect(appStoreHarness.unsubEvents).toHaveBeenCalledOnce();
      expect(appStoreHarness.unsubStore).toHaveBeenCalledOnce();
    });

    it('überspringt Modell-Update bei SPIELVERWALTUNG und kehrt frühzeitig zurück', () => {
      const { szene } = baueSzene();
      richteStoreAbonnementsEin(szene as unknown as TischSzene);

      appStoreHarness.sendeZustand({ ...erzeugeAnfangszustand(), bereich: 'SPIELVERWALTUNG' });

      expect(szene.erstelleModell).not.toHaveBeenCalled();
      expect(szene.aktualisiereUi).not.toHaveBeenCalled();
    });

    it('ruft initialisiereZustand auf wenn Tisch entfernt wird', () => {
      const { szene } = baueSzene();
      richteStoreAbonnementsEin(szene as unknown as TischSzene);
      szene.letzterZustand = {
        ...erzeugeAnfangszustand(),
        aktuellerTisch: { id: 'tisch-1' } as unknown as TischAntwort,
      };

      appStoreHarness.sendeZustand({
        ...erzeugeAnfangszustand(),
        bereich: 'TISCH',
        aktuellerTisch: null,
      });

      expect(szene.initialisiereZustand).toHaveBeenCalledOnce();
    });

    it('ruft initialisiereZustand NICHT auf wenn kein Tisch-Wechsel stattfindet', () => {
      const { szene } = baueSzene();
      richteStoreAbonnementsEin(szene as unknown as TischSzene);
      szene.letzterZustand = { ...erzeugeAnfangszustand(), aktuellerTisch: null };

      appStoreHarness.sendeZustand({
        ...erzeugeAnfangszustand(),
        bereich: 'TISCH',
        aktuellerTisch: null,
      });

      expect(szene.initialisiereZustand).not.toHaveBeenCalled();
    });

    it('synchronisiert Modell, Animation und UI bei normalem Zustandsupdate', () => {
      const { szene } = baueSzene();
      richteStoreAbonnementsEin(szene as unknown as TischSzene);
      const zustand = { ...erzeugeAnfangszustand(), bereich: 'TISCH' } as AppZustand;

      appStoreHarness.sendeZustand(zustand);

      expect(szene.erstelleModell).toHaveBeenCalledWith(zustand);
      expect(szene.zustandsKontroller.synchronisiereAnimationszustand).toHaveBeenCalledOnce();
      expect(szene.aktualisiereUi).toHaveBeenCalledOnce();
      expect(szene.triggerRender).toHaveBeenCalledOnce();
    });

    it('aktualisiert letzterZustand und letztesModell nach Zustandsupdate', () => {
      const { szene } = baueSzene();
      richteStoreAbonnementsEin(szene as unknown as TischSzene);
      const zustand = { ...erzeugeAnfangszustand(), bereich: 'TISCH' } as AppZustand;

      appStoreHarness.sendeZustand(zustand);

      expect(szene.letzterZustand).toBe(zustand);
      expect(szene.letztesModell).not.toBeNull();
    });

    it('zeigt Partie-Ende-Modal wenn _zeigeOverlayNachSnapshot und partieBeendet=true', () => {
      const { szene, fakeModell } = baueSzene();
      fakeModell.letztesSpielergebnis = { spielwert: 3 };
      richteStoreAbonnementsEin(szene as unknown as TischSzene);
      szene._zeigeOverlayNachSnapshot = { spielNummer: 1, partieBeendet: true };

      appStoreHarness.sendeZustand({
        ...erzeugeAnfangszustand(),
        bereich: 'TISCH',
        aktuellerTisch: { id: 'tisch-1' } as unknown as TischAntwort,
      });

      expect(szene.rundenEndeController.zeigePartieEndeModal).toHaveBeenCalledOnce();
      expect(szene.rundenEndeController.zeigeRundenEndeModal).not.toHaveBeenCalled();
    });

    it('zeigt Rundenende-Modal wenn _zeigeOverlayNachSnapshot und partieBeendet=false', () => {
      const { szene, fakeModell } = baueSzene();
      fakeModell.letztesSpielergebnis = { spielwert: 2 };
      richteStoreAbonnementsEin(szene as unknown as TischSzene);
      szene._zeigeOverlayNachSnapshot = { spielNummer: 2, partieBeendet: false };

      appStoreHarness.sendeZustand({
        ...erzeugeAnfangszustand(),
        bereich: 'TISCH',
        aktuellerTisch: { id: 'tisch-1' } as unknown as TischAntwort,
      });

      expect(szene.rundenEndeController.zeigeRundenEndeModal).toHaveBeenCalledOnce();
      expect(szene.rundenEndeController.zeigePartieEndeModal).not.toHaveBeenCalled();
    });

    it('setzt _zeigeOverlayNachSnapshot=null nach Modal-Anzeige', () => {
      const { szene, fakeModell } = baueSzene();
      fakeModell.letztesSpielergebnis = { spielwert: 1 };
      richteStoreAbonnementsEin(szene as unknown as TischSzene);
      szene._zeigeOverlayNachSnapshot = { spielNummer: 1, partieBeendet: true };

      appStoreHarness.sendeZustand({
        ...erzeugeAnfangszustand(),
        bereich: 'TISCH',
        aktuellerTisch: { id: 'tisch-1' } as unknown as TischAntwort,
      });

      expect(szene._zeigeOverlayNachSnapshot).toBeNull();
    });

    it('zeigt kein Modal wenn kein aktuellerTisch im Zustand vorhanden', () => {
      const { szene, fakeModell } = baueSzene();
      fakeModell.letztesSpielergebnis = { spielwert: 1 };
      richteStoreAbonnementsEin(szene as unknown as TischSzene);
      szene._zeigeOverlayNachSnapshot = { spielNummer: 1, partieBeendet: true };

      appStoreHarness.sendeZustand({
        ...erzeugeAnfangszustand(),
        bereich: 'TISCH',
        aktuellerTisch: null,
      });

      expect(szene.rundenEndeController.zeigePartieEndeModal).not.toHaveBeenCalled();
      expect(szene.rundenEndeController.zeigeRundenEndeModal).not.toHaveBeenCalled();
    });
  });

  describe('Sonderpunkte-Listener', () => {
    it('FUCHS_GEFANGEN reiht FuchsGefangen-Animation ein und schüttelt Nameplate', async () => {
      const { szene, reiheEin, zeigeSpielevent, shake } = baueSzene();
      szene.letztesModell = {
        letztesSpielergebnis: null,
        spieler: [{ absolutePosition: 'SUED', position: 'SUED', name: 'TestSpieler' }],
      };
      richteStoreAbonnementsEin(szene as unknown as TischSzene);

      appStoreHarness.sendeSonderpunkte([{ typ: 'FUCHS_GEFANGEN', gewinner: 'SUED' }] as SonderpunktEreignisAntwortDto[]);

      expect(reiheEin).toHaveBeenCalledOnce();
      expect(shake).toHaveBeenCalledOnce();
      const eingereihteFn = reiheEin.mock.calls[0][0] as () => Promise<void>;
      await eingereihteFn();
      expect(zeigeSpielevent).toHaveBeenCalledWith('FuchsGefangen', {
        spielerName: 'TestSpieler',
        x: 100,
        y: 200,
      });
    });

    it('KARLCHEN reiht KarlchenGespielt-Animation ein und schüttelt Nameplate', async () => {
      const { szene, reiheEin, zeigeSpielevent, shake } = baueSzene();
      szene.letztesModell = {
        letztesSpielergebnis: null,
        spieler: [{ absolutePosition: 'SUED', position: 'SUED', name: 'TestSpieler' }],
      };
      richteStoreAbonnementsEin(szene as unknown as TischSzene);

      appStoreHarness.sendeSonderpunkte([{ typ: 'KARLCHEN', gewinner: 'SUED' }] as SonderpunktEreignisAntwortDto[]);

      expect(reiheEin).toHaveBeenCalledOnce();
      expect(shake).toHaveBeenCalledOnce();
      const eingereihteFn = reiheEin.mock.calls[0][0] as () => Promise<void>;
      await eingereihteFn();
      expect(zeigeSpielevent).toHaveBeenCalledWith('KarlchenGespielt', {
        spielerName: 'TestSpieler',
        x: 100,
        y: 200,
      });
    });

    it('DOPPELKOPF reiht DoppelkopfGestochen-Animation ein ohne Nameplate-Shake', async () => {
      const { szene, reiheEin, zeigeSpielevent, shake } = baueSzene();
      szene.letztesModell = {
        letztesSpielergebnis: null,
        spieler: [{ absolutePosition: 'SUED', position: 'SUED', name: 'TestSpieler' }],
      };
      richteStoreAbonnementsEin(szene as unknown as TischSzene);

      appStoreHarness.sendeSonderpunkte([{ typ: 'DOPPELKOPF', gewinner: 'SUED' }] as SonderpunktEreignisAntwortDto[]);

      expect(reiheEin).toHaveBeenCalledOnce();
      expect(shake).not.toHaveBeenCalled();
      const eingereihteFn = reiheEin.mock.calls[0][0] as () => Promise<void>;
      await eingereihteFn();
      expect(zeigeSpielevent).toHaveBeenCalledWith('DoppelkopfGestochen', { x: 100, y: 200 });
    });

    it('ignoriert Sonderpunkt wenn Gewinner-Spieler nicht im Modell gefunden wird', () => {
      const { szene, shake } = baueSzene();
      szene.letztesModell = {
        letztesSpielergebnis: null,
        spieler: [{ absolutePosition: 'NORD', position: 'NORD', name: 'Anderer' }],
      };
      richteStoreAbonnementsEin(szene as unknown as TischSzene);

      appStoreHarness.sendeSonderpunkte([{ typ: 'FUCHS_GEFANGEN', gewinner: 'SUED' }] as SonderpunktEreignisAntwortDto[]);

      // reiheEin wird aufgerufen, aber shake nicht (kein Eintrag für SUED in nameplates über gewinnerSpieler.position)
      expect(shake).not.toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('kombinierte Abmeldefunktion ruft alle 3 Unsubscribe-Funktionen auf', () => {
      const { szene } = baueSzene();
      const abmelden = richteStoreAbonnementsEin(szene as unknown as TischSzene);

      abmelden();

      expect(appStoreHarness.unsubEvents).toHaveBeenCalledOnce();
      expect(appStoreHarness.unsubStore).toHaveBeenCalledOnce();
      expect(appStoreHarness.unsubSonderpunkte).toHaveBeenCalledOnce();
    });
  });
});
