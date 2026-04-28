import { describe, expect, it } from 'vitest';
import type {
  AuthentifizierungsAntwort,
  PartieEreignisAntwort,
  PartieStandAntwort,
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

class FakeApi implements Pick<SpielverwaltungApi, 'initialisiereSpielerSession' | 'listeTische' | 'erstelleTisch' | 'betreteTisch' | 'betreteTischViaCode' | 'verlasseTisch' | 'starteTisch' | 'starteNeuePartie' | 'aktualisiereTischKonfiguration' | 'ladeTisch' | 'schnellstart' | 'registrieren' | 'einloggen' | 'ausloggen' | 'kickeSpieler' | 'gibPresets'> {
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

  async registrieren(): Promise<AuthentifizierungsAntwort> {
    return { spielerId: this.spieler.spielerId, name: this.spieler.name, authentifizierungsMethode: 'PASSWORT' };
  }

  async einloggen(): Promise<AuthentifizierungsAntwort> {
    return { spielerId: this.spieler.spielerId, name: this.spieler.name, authentifizierungsMethode: 'PASSWORT' };
  }

  async ausloggen(): Promise<void> {
    // no-op
  }

  async kickeSpieler(): Promise<{ nachricht: string }> {
    return { nachricht: 'ok' };
  }

  async gibPresets(): Promise<[]> {
    return [];
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
    zugangsmodus: 'OFFEN',
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
      schmeissenAktiv: false,
      herzDurchgegangenNurHoch: false,
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
      timestamp: new Date(Date.now() + 1000).toISOString(),
      ereignisTyp: 'SPIEL_GESTARTET',
      tischId: 'tisch-42',
      tisch: { ...tisch, status: 'IM_SPIEL', partieId: 'partie-1' },
      partieStand: {
        partieId: 'partie-1',
        version: 1,
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

  it('reconnecteTisch setzt partieStand und aktuellerTisch zurück bevor Snapshot eintrifft', async () => {
    // Wichtig: Ctrl+R während laufendem Spiel → reconnecteTisch() muss alten partieStand
    // löschen, damit TischSzene nicht mit veralteten Overlay-Daten rendert, bevor der
    // neue Snapshot eintrifft (verbindungsabbruch.md:70).
    const echtzeit = new FakeEchtzeit();
    const tisch = baueTisch('tisch-reconnect-reset');
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

    // Tisch und PartieStand wurden gesetzt
    echtzeit.emit('/user/queue/tisch/tisch-reconnect-reset', {
      timestamp: new Date().toISOString(),
      ereignisTyp: 'TISCH_SNAPSHOT',
      tischId: 'tisch-reconnect-reset',
      tisch: { ...tisch, status: 'IM_SPIEL', partieId: 'partie-alt' },
      partieStand: {
        partieId: 'partie-alt', version: 5, status: 'LAUFEND',
        anzahlSpiele: 8, gespielteSpiele: 3,
        gesamtpunktestand: { SUED: 10 },
        laufendesSpiel: { spielNummer: 4, hochzeitGeklaert: false, schweinchenGemeldetVon: null }
      } as unknown as PartieStandAntwort
    });

    expect(store.snapshot().aktuellerTisch).not.toBeNull();
    expect(store.snapshot().partieStand).not.toBeNull();

    // Ctrl+R: reconnecteTisch muss State löschen BEVOR der neue Snapshot kommt
    store.reconnecteTisch('tisch-reconnect-reset');

    expect(store.snapshot().aktuellerTisch).toBeNull();
    expect(store.snapshot().partieStand).toBeNull();
  });

  it('SNAPSHOT verwirft veraltete Events in der Queue (Ctrl+R Schutz)', async () => {
    // Szenario: KI-Animation läuft (async Barrier durch setTimeout). Währenddessen
    // kommen SNAPSHOT(Spiel2) und danach KARTE_GESPIELT(Spiel1) in die Queue.
    const echtzeit = new FakeEchtzeit();
    const tisch = baueTisch('tisch-snapshot');
    const store = new AppStore(
      new FakeApi(
        { spielerId: 'spieler-1', name: 'Nora', istKi: false, aktiverTischId: null },
        [],
        tisch
      ) as SpielverwaltungApi,
      echtzeit
    );
    store.setzeKiKartenVerzögerung(5); // Kleines Delay als async Barrier
    await store.initialisieren();
    await store.betreteTisch(tisch.id);

    // Partie-Abo aufbauen via SPIEL_GESTARTET (Version 1)
    echtzeit.emit('/user/queue/tisch/tisch-snapshot', {
      timestamp: '2026-04-21T12:00:00Z',
      version: 1,
      ereignisTyp: 'SPIEL_GESTARTET',
      tischId: 'tisch-snapshot',
      tisch: { ...tisch, status: 'IM_SPIEL', partieId: 'partie-snap' },
      partieStand: null
    });

    const spiel1Stand = {
      partieId: 'partie-snap',
      version: 1,
      status: 'LAUFEND',
      anzahlSpiele: 8,
      gespielteSpiele: 0,
      gesamtpunktestand: { SUED: 0 },
      laufendesSpiel: {
        spielNummer: 1, hochzeitGeklaert: false, schweinchenGemeldetVon: null,
        spieler: [{ position: 'WEST', istKi: true, istKiUebernommen: false, istSelbst: false }],
        aktuelleStichmitte: [], spielbareKarten: []
      }
    } as unknown as PartieStandAntwort;
    const spiel2Stand = {
      partieId: 'partie-snap',
      version: 2,
      status: 'LAUFEND',
      anzahlSpiele: 8,
      gespielteSpiele: 1,
      gesamtpunktestand: { SUED: 0 },
      laufendesSpiel: { spielNummer: 2, hochzeitGeklaert: false, schweinchenGemeldetVon: null }
    } as unknown as PartieStandAntwort;

    // KI-Animation startet (hält die Queue mit async Barrier besetzt)
    echtzeit.emit('/user/queue/partie/partie-snap', {
      timestamp: '2026-04-21T12:00:01Z',
      version: 1,
      ereignisTyp: 'KARTE_GESPIELT',
      partieStand: spiel1Stand,
      spielerPosition: 'WEST',
      karteId: 'KREUZ-AS-1',
    } as unknown as PartieEreignisAntwort);

    // Während die Animation läuft: SNAPSHOT(Spiel2) dann KARTE_GESPIELT(Spiel1) eintreffen
    echtzeit.emit('/user/queue/partie/partie-snap', {
      timestamp: '2026-04-21T12:00:02Z',
      version: 2,
      ereignisTyp: 'SNAPSHOT',
      partieStand: spiel2Stand,
    } as unknown as PartieEreignisAntwort);

    echtzeit.emit('/user/queue/partie/partie-snap', {
      timestamp: '2026-04-21T12:00:01Z',
      version: 1, // Veraltete Version
      ereignisTyp: 'KARTE_GESPIELT',
      partieStand: spiel1Stand,
      spielerPosition: 'WEST',
      karteId: 'KREUZ-AS-1',
    } as unknown as PartieEreignisAntwort);

    // Warten bis KI-Animation (5ms) und Queue-Verarbeitung fertig
    await new Promise<void>((r) => setTimeout(r, 20));

    expect(store.snapshot().partieStand?.laufendesSpiel?.spielNummer).toBe(2);
  });

  it('reconnecteTisch löscht EventQueue sodass kein veralteter Stand nach Reconnect angezeigt wird', async () => {
    // Szenario: KI animiert, KARTE_GESPIELT(Spiel1) landet in Queue.
    // Dann Ctrl+R → reconnecteTisch() → Queue geleert.
    // Danach TISCH_SNAPSHOT(Spiel2) → partieStand muss Spiel 2 zeigen.
    const echtzeit = new FakeEchtzeit();
    const tisch = baueTisch('tisch-reconnect2');
    const store = new AppStore(
      new FakeApi(
        { spielerId: 'spieler-1', name: 'Nora', istKi: false, aktiverTischId: null },
        [],
        tisch
      ) as SpielverwaltungApi,
      echtzeit
    );
    store.setzeKiKartenVerzögerung(5);
    await store.initialisieren();
    await store.betreteTisch(tisch.id);

    const baseTime = 1713730000000;
    const t1 = new Date(baseTime + 1000).toISOString();
    const t2 = new Date(baseTime + 2000).toISOString();
    const t3 = new Date(baseTime + 3000).toISOString();

    // Partie-Abo aufbauen via SPIEL_GESTARTET
    echtzeit.emit('/user/queue/tisch/tisch-reconnect2', {
      timestamp: t1,
      ereignisTyp: 'SPIEL_GESTARTET',
      tischId: 'tisch-reconnect2',
      tisch: { ...tisch, status: 'IM_SPIEL', partieId: 'partie-rec' },
      partieStand: null
    });

    const spiel1Stand = {
      partieId: 'partie-rec',
      version: 1,
      status: 'LAUFEND',
      anzahlSpiele: 8,
      gespielteSpiele: 0,
      gesamtpunktestand: { SUED: 0 },
      laufendesSpiel: {
        spielNummer: 1, hochzeitGeklaert: false, schweinchenGemeldetVon: null,
        spieler: [{ position: 'WEST', istKi: true, istKiUebernommen: false, istSelbst: false }],
        aktuelleStichmitte: [], spielbareKarten: []
      }
    } as unknown as PartieStandAntwort;
    const spiel2Stand = {
      partieId: 'partie-rec',
      version: 2,
      status: 'LAUFEND',
      anzahlSpiele: 8,
      gespielteSpiele: 1,
      gesamtpunktestand: { SUED: 0 },
      laufendesSpiel: { spielNummer: 2, hochzeitGeklaert: false, schweinchenGemeldetVon: null }
    } as unknown as PartieStandAntwort;

    // KI animiert → async Barrier
    echtzeit.emit('/user/queue/partie/partie-rec', {
      timestamp: t2,
      ereignisTyp: 'KARTE_GESPIELT',
      partieStand: spiel1Stand,
      spielerPosition: 'WEST',
      karteId: 'KREUZ-AS-1',
    } as unknown as PartieEreignisAntwort);

    // Veraltetes Event landet in Queue
    echtzeit.emit('/user/queue/partie/partie-rec', {
      timestamp: t2,
      ereignisTyp: 'KARTE_GESPIELT',
      partieStand: spiel1Stand,
      spielerPosition: 'WEST',
      karteId: 'KREUZ-AS-1',
    } as unknown as PartieEreignisAntwort);

    // Ctrl+R: reconnecteTisch leert die Queue
    store.reconnecteTisch('tisch-reconnect2');

    // TISCH_SNAPSHOT mit Spiel-2-Stand kommt nach Reconnect
    echtzeit.emit('/user/queue/tisch/tisch-reconnect2', {
      timestamp: t3,
      ereignisTyp: 'TISCH_SNAPSHOT',
      tischId: 'tisch-reconnect2',
      tisch: { ...tisch, status: 'IM_SPIEL', partieId: 'partie-rec' },
      partieStand: spiel2Stand
    });

    await new Promise<void>((r) => setTimeout(r, 20));

    expect(store.snapshot().partieStand).toStrictEqual(spiel2Stand);
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
      timestamp: new Date(Date.now() + 1000).toISOString(),
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
