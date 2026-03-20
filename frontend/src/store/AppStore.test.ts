import { describe, expect, it } from 'vitest';
import type {
  PartieEreignisAntwort,
  SpielverwaltungWebSocketFehlerAntwort,
  SpielerSessionAntwort,
  TischAntwort,
  TischEreignisAntwort,
  TischListenEintragAntwort,
  TischlisteEreignisAntwort,
  Uuid
} from '../modelle/SpielverwaltungDto';
import type { SpielverwaltungApi } from '../services/SpielverwaltungApi';
import type { EchtzeitPort, NachrichtenHandler } from '../services/SpielverwaltungEchtzeit';
import { AppStore } from './AppStore';

class FakeApi implements Pick<SpielverwaltungApi, 'initialisiereSpielerSession' | 'listeTische' | 'erstelleTisch' | 'betreteTisch' | 'verlasseTisch' | 'starteTisch'> {
  constructor(
    private readonly spieler: SpielerSessionAntwort,
    private readonly tische: TischListenEintragAntwort[],
    private readonly tisch: TischAntwort
  ) {}

  async initialisiereSpielerSession(): Promise<SpielerSessionAntwort> {
    return this.spieler;
  }

  async listeTische(): Promise<TischListenEintragAntwort[]> {
    return this.tische;
  }

  async erstelleTisch(): Promise<TischAntwort> {
    return this.tisch;
  }

  async betreteTisch(): Promise<TischAntwort> {
    return this.tisch;
  }

  async verlasseTisch(): Promise<{ nachricht: string }> {
    return { nachricht: 'ok' };
  }

  async starteTisch(): Promise<{ nachricht: string }> {
    return { nachricht: 'ok' };
  }
}

class FakeEchtzeit implements EchtzeitPort {
  private readonly handler = new Map<string, Array<NachrichtenHandler<unknown>>>();

  readonly sendungen: string[] = [];

  async verbinde(): Promise<void> {
    return Promise.resolve();
  }

  abonnieren<T>(ziel: string, callback: NachrichtenHandler<T>): () => void {
    const eintraege = this.handler.get(ziel) ?? [];
    eintraege.push(callback as NachrichtenHandler<unknown>);
    this.handler.set(ziel, eintraege);
    return () => {
      const aktuell = this.handler.get(ziel) ?? [];
      this.handler.set(ziel, aktuell.filter((eintrag) => eintrag !== callback));
    };
  }

  senden(ziel: string): void {
    this.sendungen.push(ziel);
  }

  trennen(): void {}

  emit(ziel: string, nachricht: TischlisteEreignisAntwort | TischEreignisAntwort | PartieEreignisAntwort | SpielverwaltungWebSocketFehlerAntwort): void {
    (this.handler.get(ziel) ?? []).forEach((callback) => callback(nachricht));
  }
}

function baueTisch(tischId: Uuid = 'tisch-1'): TischAntwort {
  return {
    id: tischId,
    name: 'Testtisch',
    status: 'WARTEND',
    erstelltVonSpielerId: 'spieler-1',
    partieId: null,
    konfiguration: {
      ohneNeunen: false,
      anzahlSpiele: 8,
      hochzeitErlaubt: true,
      armutErlaubt: true,
      damensoloErlaubt: true,
      bubensoloErlaubt: true,
      fleischlosErlaubt: true,
      trumpfsoloErlaubt: true,
      zweiteDulleSticht: true,
      fuchsGefangenAktiv: true,
      karlchenAktiv: true,
      doppelkopfAktiv: true,
      mindestkartenReKontra: 11,
      mindestkartenKeine90: 10,
      mindestkartenKeine60: 9,
      mindestkartenKeine30: 8,
      mindestkartenSchwarz: 7
    },
    spieler: [{ spielerId: 'spieler-1', name: 'Nora', istKi: false }]
  };
}

describe('AppStore', () => {
  it('initialisiert Session, Tischliste und fordert einen Snapshot an', async () => {
    const echtzeit = new FakeEchtzeit();
    const store = new AppStore(
      new FakeApi(
        { spielerId: 'spieler-1', name: 'Nora', istKi: false },
        [{ id: 'tisch-1', name: 'Testtisch', spielerAnzahl: 1, status: 'WARTEND', kurzKonfiguration: { ohneNeunen: false, anzahlSpiele: 8 } }],
        baueTisch()
      ) as SpielverwaltungApi,
      echtzeit
    );

    await store.initialisieren();

    expect(store.snapshot()).toMatchObject({
      initialisiert: true,
      verbindung: 'verbunden',
      spieler: { name: 'Nora' },
      tische: [{ name: 'Testtisch' }]
    });
    expect(echtzeit.sendungen).toContain('/app/tische/snapshot');
  });

  it('oeffnet einen Tisch, verarbeitet Snapshot-Events und kehrt nach dem Verlassen in die Lobby zurueck', async () => {
    const echtzeit = new FakeEchtzeit();
    const tisch = baueTisch('tisch-42');
    const store = new AppStore(
      new FakeApi(
        { spielerId: 'spieler-1', name: 'Nora', istKi: false },
        [],
        tisch
      ) as SpielverwaltungApi,
      echtzeit
    );

    await store.initialisieren();
    await store.betreteTisch(tisch.id);

    expect(store.snapshot()).toMatchObject({ bereich: 'TISCH', aktuellerTisch: { id: 'tisch-42' } });
    expect(echtzeit.sendungen).toContain('/app/tisch/tisch-42/snapshot');

    echtzeit.emit('/user/queue/tisch/tisch-42', {
      timestamp: new Date().toISOString(),
      ereignisTyp: 'SPIEL_GESTARTET',
      tischId: 'tisch-42',
      tisch: { ...tisch, status: 'IM_SPIEL', partieId: 'partie-1' },
      partieStand: {
        partieId: 'partie-1',
        status: 'LAUFEND',
        anzahlSpiele: 8,
        gespielteSpiele: 0,
        gesamtpunktestand: { SUED: 0 },
        laufendesSpiel: null
      }
    });

    expect(store.snapshot()).toMatchObject({
      aktuellerTisch: { status: 'IM_SPIEL', partieId: 'partie-1' },
      partieStand: { partieId: 'partie-1' }
    });
    expect(echtzeit.sendungen).toContain('/app/partie/partie-1/snapshot');

    await store.verlasseAktuellenTisch();
    expect(store.snapshot()).toMatchObject({ bereich: 'LOBBY', aktuellerTisch: null, partieStand: null });
  });
});
