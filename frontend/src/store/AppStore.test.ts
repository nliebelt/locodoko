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

class FakeApi implements Pick<SpielverwaltungApi, 'initialisiereSpielerSession' | 'listeTische' | 'erstelleTisch' | 'betreteTisch' | 'betreteTischViaCode' | 'verlasseTisch' | 'starteTisch' | 'starteNeuePartie' | 'aktualisiereTischKonfiguration' | 'ladeTisch' | 'schnellstart'> {
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

  async schnellstart(): Promise<TischAntwort> {
    return this.tisch;
  }

  async betreteTisch(): Promise<TischAntwort> {
    return this.tisch;
  }

  async betreteTischViaCode(): Promise<TischAntwort> {
    return this.tisch;
  }

  async verlasseTisch(): Promise<{ nachricht: string }> {
    return { nachricht: 'ok' };
  }

  async starteTisch(): Promise<{ nachricht: string }> {
    return { nachricht: 'ok' };
  }

  async starteNeuePartie(): Promise<{ nachricht: string }> {
    return { nachricht: 'ok' };
  }

  async aktualisiereTischKonfiguration(_tischId: Uuid, konfiguration: TischAntwort['konfiguration']): Promise<TischAntwort['konfiguration']> {
    return konfiguration;
  }

  async ladeTisch(): Promise<TischAntwort> {
    return this.tisch;
  }
}

class FakeEchtzeit implements EchtzeitPort {
  private readonly handler = new Map<string, Array<NachrichtenHandler<unknown>>>();

  readonly sendungen: Array<{ ziel: string; payload: unknown }> = [];

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

  senden(ziel: string, payload: unknown = {}): void {
    this.sendungen.push({ ziel, payload });
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
    einladungsCode: 'ABCD1234',
    status: 'WARTEND',
    erstelltVonSpielerId: 'spieler-1',
    partieId: null,
    konfiguration: {
      ohneNeunen: false,
      anzahlSpiele: 8,
      tischhintergrund: 'FILZ_GRUEN',
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
      mindestkartenSchwarz: 7,
      bockrundenAktiv: false,
      schweinchenAktiv: false,
      dreissigAugenPflichtAktiv: false,
      kiSchwierigkeit: 'STANDARD' as const
    },
    spieler: [{ spielerId: 'spieler-1', name: 'Nora', istKi: false }]
  };
}

describe('AppStore', () => {
  it('initialisiert Session, Tischliste und fordert einen Snapshot an', async () => {
    const echtzeit = new FakeEchtzeit();
    const store = new AppStore(
      new FakeApi(
        { spielerId: 'spieler-1', name: 'Nora', istKi: false, aktiverTischId: null },
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
    expect(echtzeit.sendungen).toEqual(expect.arrayContaining([
      expect.objectContaining({ ziel: '/app/tische/snapshot' })
    ]));
  });

  it('oeffnet einen Tisch, verarbeitet Snapshot-Events und kehrt nach dem Verlassen in die Spielverwaltung zurueck', async () => {
    const echtzeit = new FakeEchtzeit();
    const tisch = baueTisch('tisch-42');
    const store = new AppStore(
      new FakeApi(
        { spielerId: 'spieler-1', name: 'Nora', istKi: false, aktiverTischId: null },
        [],
        tisch
      ) as SpielverwaltungApi,
      echtzeit
    );

    await store.initialisieren();
    await store.betreteTisch(tisch.id);

    expect(store.snapshot()).toMatchObject({ bereich: 'TISCH', aktuellerTisch: { id: 'tisch-42' } });
    expect(echtzeit.sendungen).toEqual(expect.arrayContaining([
      expect.objectContaining({ ziel: '/app/tisch/tisch-42/snapshot' })
    ]));

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
    expect(echtzeit.sendungen).toEqual(expect.arrayContaining([
      expect.objectContaining({ ziel: '/app/partie/partie-1/snapshot' })
    ]));

    store.toggleDebugModus();
    expect(store.snapshot().debugModus).toBe(true);
    expect(echtzeit.sendungen).toEqual(expect.arrayContaining([
      expect.objectContaining({ ziel: '/app/partie/partie-1/debug-snapshot' })
    ]));

    await store.verlasseAktuellenTisch();
    expect(store.snapshot()).toMatchObject({ bereich: 'SPIELVERWALTUNG', aktuellerTisch: null, partieStand: null, debugModus: true });
  });

  it('sendet Karten-, Ansage-, Vorbehalt- und Armut-Aktionen an die passenden Kanaele', async () => {
    const echtzeit = new FakeEchtzeit();
    const tisch = baueTisch('tisch-84');
    const store = new AppStore(
      new FakeApi(
        { spielerId: 'spieler-1', name: 'Nora', istKi: false, aktiverTischId: null },
        [],
        tisch
      ) as SpielverwaltungApi,
      echtzeit
    );

    await store.initialisieren();
    await store.betreteTisch(tisch.id);

    store.spieleKarte('HERZ-ZEHN-1');
    store.sageAnsageAn('RE');
    store.meldeVorbehalt('GESUND');
    store.beantworteArmut(true, ['KARO-BUBE-1', 'HERZ-BUBE-1']);

    expect(echtzeit.sendungen).toEqual(expect.arrayContaining([
      expect.objectContaining({ ziel: '/app/tisch/tisch-84/karte', payload: { karteId: 'HERZ-ZEHN-1' } }),
      expect.objectContaining({ ziel: '/app/tisch/tisch-84/ansage', payload: { ansage: 'RE' } }),
      expect.objectContaining({ ziel: '/app/tisch/tisch-84/vorbehalt', payload: { vorbehalt: 'GESUND' } }),
      expect.objectContaining({ ziel: '/app/tisch/tisch-84/armut-antwort', payload: { angenommen: true, kartenIds: ['KARO-BUBE-1', 'HERZ-BUBE-1'] } })
    ]));
  });

  it('aktualisiert den konfigurierten Tischhintergrund fuer den aktuellen Tisch', async () => {
    const echtzeit = new FakeEchtzeit();
    const tisch = baueTisch('tisch-99');
    const store = new AppStore(
      new FakeApi(
        { spielerId: 'spieler-1', name: 'Nora', istKi: false, aktiverTischId: null },
        [],
        tisch
      ) as SpielverwaltungApi,
      echtzeit
    );

    await store.initialisieren();
    await store.betreteTisch(tisch.id);
    await store.aktualisiereAktuellenTischhintergrund('HOLZ_DUNKEL');

    expect(store.snapshot().aktuellerTisch?.konfiguration.tischhintergrund).toBe('HOLZ_DUNKEL');
  });

  it('reconnecteTisch abonniert Tisch-Topic und fordert Snapshot an ohne API-Aufruf', async () => {
    // Wichtig: Session-Recovery nach Tab-Reload darf NICHT erneut POST /api/tische/{id}/beitreten aufrufen —
    // der Spieler sitzt bereits am Tisch. reconnecteTisch() muss direkt Abos registrieren
    // und einen WS-Snapshot anfordern, damit der Zustand wiederhergestellt wird.
    const echtzeit = new FakeEchtzeit();
    const store = new AppStore(
      new FakeApi(
        { spielerId: 'spieler-1', name: 'Nora', istKi: false, aktiverTischId: null },
        [],
        baueTisch('tisch-reconnect')
      ) as SpielverwaltungApi,
      echtzeit
    );
    await store.initialisieren();

    store.reconnecteTisch('tisch-reconnect');

    expect(store.snapshot().bereich).toBe('TISCH');
    expect(echtzeit.sendungen).toEqual(expect.arrayContaining([
      expect.objectContaining({ ziel: '/app/tisch/tisch-reconnect/snapshot' })
    ]));
  });

  it('behandelt PARTIE_ABGEBROCHEN-Event: wechselt zur Spielverwaltung und setzt Info-Meldung', async () => {
    // Wichtig: Wenn ein Spieler waehrend einer aktiven Partie den Tisch verlaesst,
    // erhalten alle anderen Spieler ein PARTIE_ABGEBROCHEN-Event. Das Frontend muss
    // daraufhin zur Spielverwaltung wechseln und eine verstaendliche Meldung anzeigen — kein
    // stiller Fehler, keine unbemerkte Zustandsinkonsistenz.
    const echtzeit = new FakeEchtzeit();
    const tisch = baueTisch('tisch-abbruch');
    const store = new AppStore(
      new FakeApi(
        { spielerId: 'spieler-1', name: 'Nora', istKi: false, aktiverTischId: null },
        [],
        tisch
      ) as SpielverwaltungApi,
      echtzeit
    );
    await store.initialisieren();
    await store.betreteTisch(tisch.id);

    echtzeit.emit(`/topic/tisch/tisch-abbruch`, {
      timestamp: new Date().toISOString(),
      ereignisTyp: 'PARTIE_ABGEBROCHEN',
      tischId: 'tisch-abbruch',
      tisch: null,
      partieStand: null
    });

    expect(store.snapshot()).toMatchObject({
      bereich: 'SPIELVERWALTUNG',
      aktuellerTisch: null,
      partieStand: null,
      meldung: { typ: 'info', fehlerCode: 'PARTIE_ABGEBROCHEN' }
    });
  });
});
