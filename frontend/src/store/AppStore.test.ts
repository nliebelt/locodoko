import { describe, expect, it, vi } from 'vitest';
import type {
  AuthentifizierungsAntwort,
  PartieEreignisAntwort,
  PartieEreignisBatch,
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
import { SpielverwaltungFehler } from '../services/SpielverwaltungApi';
import type { EchtzeitPort, NachrichtenHandler } from '../services/SpielverwaltungEchtzeit';
import { AppStore } from './AppStore';

class FakeApi implements Pick<SpielverwaltungApi, 'initialisiereSpielerSession' | 'listeTische' | 'erstelleTisch' | 'betreteTisch' | 'betreteTischViaCode' | 'verlasseTisch' | 'starteTisch' | 'starteNeuePartie' | 'aktualisiereTischKonfiguration' | 'ladeTisch' | 'schnellstart' | 'registrieren' | 'einloggen' | 'ausloggen' | 'kickeSpieler' | 'gibPresets' | 'ladeSpielerProfil'> {
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

  async ladeSpielerProfil(): Promise<Record<string, never>> {
    return {};
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

  emit(ziel: string, nachricht: TischlisteEreignisAntwort | TischEreignisAntwort | PartieEreignisAntwort | PartieEreignisBatch | SpielverwaltungWebSocketFehlerAntwort): void {
    (this.handler.get(ziel) ?? []).forEach((callback) => callback(nachricht));
  }
}

/** Verpackt ein einzelnes Partie-Ereignis in einen PartieEreignisBatch fuer Tests. */
function batchieren(ereignis: PartieEreignisAntwort): PartieEreignisBatch {
  return { version: ereignis.version, ereignisse: [ereignis] };
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
      ) as unknown as SpielverwaltungApi,
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
      ) as unknown as SpielverwaltungApi,
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
      ) as unknown as SpielverwaltungApi,
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
      ) as unknown as SpielverwaltungApi,
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
      ) as unknown as SpielverwaltungApi,
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
      ) as unknown as SpielverwaltungApi,
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
      ) as unknown as SpielverwaltungApi,
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
    echtzeit.emit('/user/queue/partie/partie-snap', batchieren({
      timestamp: '2026-04-21T12:00:01Z',
      version: 1,
      ereignisTyp: 'KARTE_GESPIELT',
      partieStand: spiel1Stand,
      spielerPosition: 'WEST',
      karteId: 'KREUZ-AS-1',
    } as unknown as PartieEreignisAntwort));

    // Während die Animation läuft: SNAPSHOT(Spiel2) dann KARTE_GESPIELT(Spiel1) eintreffen
    echtzeit.emit('/user/queue/partie/partie-snap', batchieren({
      timestamp: '2026-04-21T12:00:02Z',
      version: 2,
      ereignisTyp: 'SNAPSHOT',
      partieStand: spiel2Stand,
    } as unknown as PartieEreignisAntwort));

    echtzeit.emit('/user/queue/partie/partie-snap', batchieren({
      timestamp: '2026-04-21T12:00:01Z',
      version: 1, // Veraltete Version
      ereignisTyp: 'KARTE_GESPIELT',
      partieStand: spiel1Stand,
      spielerPosition: 'WEST',
      karteId: 'KREUZ-AS-1',
    } as unknown as PartieEreignisAntwort));

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
      ) as unknown as SpielverwaltungApi,
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
    echtzeit.emit('/user/queue/partie/partie-rec', batchieren({
      timestamp: t2,
      version: 1,
      ereignisTyp: 'KARTE_GESPIELT',
      partieStand: spiel1Stand,
      spielerPosition: 'WEST',
      karteId: 'KREUZ-AS-1',
    } as unknown as PartieEreignisAntwort));

    // Veraltetes Event landet in Queue
    echtzeit.emit('/user/queue/partie/partie-rec', batchieren({
      timestamp: t2,
      version: 1,
      ereignisTyp: 'KARTE_GESPIELT',
      partieStand: spiel1Stand,
      spielerPosition: 'WEST',
      karteId: 'KREUZ-AS-1',
    } as unknown as PartieEreignisAntwort));

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

  it('Self-Healing: fordert automatisch Snapshot an wenn Versionsluecke erkannt wird', async () => {
    // Wichtig: Bei verlorenem WebSocket-Batch (z.B. v2 fehlt, v3 trifft ein) darf der Store
    // keinen inkonsistenten State anzeigen. reconnecteTisch() wird automatisch aufgerufen,
    // das lueckenhafte Event verworfen — der Snapshot liefert den korrekten Stand.
    const echtzeit = new FakeEchtzeit();
    const tisch = baueTisch('tisch-selfheal');
    const store = new AppStore(
      new FakeApi(
        { spielerId: 'spieler-1', name: 'Nora', istKi: false, aktiverTischId: null },
        [],
        tisch
      ) as unknown as SpielverwaltungApi,
      echtzeit
    );
    store.setzeKiKartenVerzögerung(5);
    await store.initialisieren();
    await store.betreteTisch(tisch.id);

    const t1 = new Date(1000).toISOString();
    const t2 = new Date(2000).toISOString();
    const t3 = new Date(3000).toISOString();

    // Partie-Abo via SPIEL_GESTARTET aufbauen
    echtzeit.emit('/user/queue/tisch/tisch-selfheal', {
      timestamp: t1, ereignisTyp: 'SPIEL_GESTARTET',
      tischId: 'tisch-selfheal',
      tisch: { ...tisch, status: 'IM_SPIEL', partieId: 'partie-selfheal' },
      partieStand: null
    });

    const standV1 = {
      partieId: 'partie-selfheal', version: 1, status: 'LAUFEND',
      anzahlSpiele: 8, gespielteSpiele: 0, gesamtpunktestand: { SUED: 0 },
      laufendesSpiel: { spielNummer: 1, hochzeitGeklaert: false, schweinchenGemeldetVon: null, spieler: [], aktuelleStichmitte: [], spielbareKarten: [] }
    } as unknown as PartieEreignisAntwort;

    // Version 1 → normal verarbeitet
    echtzeit.emit('/user/queue/partie/partie-selfheal', batchieren({
      timestamp: t2, ereignisTyp: 'KARTE_GESPIELT', version: 1,
      partieStand: standV1, spielerPosition: 'WEST', karteId: 'KREUZ-AS-1',
    } as unknown as PartieEreignisAntwort));

    await new Promise<void>((r) => setTimeout(r, 20));

    const sendungenVorLuecke = echtzeit.sendungen.length;

    // Version 3 ohne Version 2 → Lücke erkannt → reconnect
    echtzeit.emit('/user/queue/partie/partie-selfheal', batchieren({
      timestamp: t3, ereignisTyp: 'KARTE_GESPIELT', version: 3,
      partieStand: { ...standV1, version: 3 } as unknown as PartieStandAntwort,
      spielerPosition: 'NORD', karteId: 'PIK-BUBE-1',
    } as unknown as PartieEreignisAntwort));

    await new Promise<void>((r) => setTimeout(r, 20));

    // Snapshot-Anforderung muss nach der Lueckenerkennung gesendet worden sein
    expect(echtzeit.sendungen.length).toBeGreaterThan(sendungenVorLuecke);
    expect(echtzeit.sendungen).toEqual(expect.arrayContaining([
      expect.objectContaining({ ziel: '/app/tisch/tisch-selfheal/snapshot' })
    ]));

    // State muss zurueckgesetzt sein (aktuellerTisch null bis Snapshot eintrifft)
    expect(store.snapshot().aktuellerTisch).toBeNull();
  });

  it('aktualisiert Tischliste reaktiv via WebSocket-Event auf /topic/tische', async () => {
    // Wichtig: Die Lobby-Liste muss sich in Echtzeit aktualisieren, wenn andere Spieler
    // Tische erstellen oder verlassen. Der AppStore abonniert /topic/tische und aktualisiert
    // tische[] direkt — kein REST-Polling nötig.
    const echtzeit = new FakeEchtzeit();
    const store = new AppStore(
      new FakeApi(
        { spielerId: 'spieler-1', name: 'Nora', istKi: false, aktiverTischId: null },
        [{ id: 'tisch-1', name: 'Erster Tisch', spielerAnzahl: 1, status: 'WARTEND', kurzKonfiguration: { ohneNeunen: false, anzahlSpiele: 8 } }],
        baueTisch()
      ) as unknown as SpielverwaltungApi,
      echtzeit
    );

    await store.initialisieren();
    expect(store.snapshot().tische).toHaveLength(1);

    echtzeit.emit('/topic/tische', {
      tische: [
        { id: 'tisch-1', name: 'Erster Tisch', spielerAnzahl: 2, status: 'WARTEND', kurzKonfiguration: { ohneNeunen: false, anzahlSpiele: 8 } },
        { id: 'tisch-2', name: 'Zweiter Tisch', spielerAnzahl: 1, status: 'WARTEND', kurzKonfiguration: { ohneNeunen: false, anzahlSpiele: 8 } },
      ]
    } as TischlisteEreignisAntwort);

    expect(store.snapshot().tische).toHaveLength(2);
    expect(store.snapshot().tische[0]).toMatchObject({ id: 'tisch-1', spielerAnzahl: 2 });
    expect(store.snapshot().tische[1]).toMatchObject({ id: 'tisch-2', name: 'Zweiter Tisch' });
  });

  it('Event-Listener wird VOR Store-Subscriber aufgerufen (verhindert Ghost-Render bei Animations-Events)', async () => {
    // WARUM (B4): reiheEin() setzt _animationLaeuft = true synchron im Event-Listener.
    // Der Store-Subscriber ruft danach triggerRender() auf — der muss geblockt sein.
    // Falsches Order (Patch vor Listener) lieferte leere Stichmitte ans Render bevor
    // die Stich-Einzieh-Animation starten konnte (Ghost-Sprites auf leerem Tisch).
    const echtzeit = new FakeEchtzeit();
    const tisch = baueTisch('tisch-listener-order');
    const store = new AppStore(
      new FakeApi(
        { spielerId: 'spieler-1', name: 'Nora', istKi: false, aktiverTischId: null },
        [],
        tisch
      ) as unknown as SpielverwaltungApi,
      echtzeit
    );
    store.setzeKiKartenVerzögerung(0);
    await store.initialisieren();
    await store.betreteTisch(tisch.id);

    // Partie-Abo aufbauen via SPIEL_GESTARTET
    echtzeit.emit('/user/queue/tisch/tisch-listener-order', {
      timestamp: '2026-04-30T00:00:00Z',
      version: 1,
      ereignisTyp: 'SPIEL_GESTARTET',
      tischId: 'tisch-listener-order',
      tisch: { ...tisch, status: 'IM_SPIEL', partieId: 'partie-order' },
      partieStand: null
    } as unknown as TischEreignisAntwort);

    const stichStand = {
      partieId: 'partie-order',
      version: 1,
      status: 'LAUFEND',
      anzahlSpiele: 8,
      gespielteSpiele: 0,
      gesamtpunktestand: { SUED: 0 },
      laufendesSpiel: {
        spielNummer: 1, hochzeitGeklaert: false, schweinchenGemeldetVon: null,
        aktuelleStichmitte: [], spielbareKarten: []
      }
    } as unknown as PartieStandAntwort;

    const aufrufReihenfolge: string[] = [];
    let partieVersionBeimListenerAufruf = -1;

    store.abonniereEvents((e) => {
      if (e.ereignisTyp === 'STICH_ABGESCHLOSSEN') {
        aufrufReihenfolge.push('event-listener');
        partieVersionBeimListenerAufruf = store.snapshot().partieStand?.version ?? -1;
      }
    });
    store.abonniere((z) => {
      if (z.partieStand?.version === 1) {
        aufrufReihenfolge.push('store-subscriber');
      }
    });

    echtzeit.emit('/user/queue/partie/partie-order', batchieren({
      version: 1,
      ereignisTyp: 'STICH_ABGESCHLOSSEN',
      partieStand: stichStand,
      neueSonderpunkte: [],
    } as unknown as PartieEreignisAntwort));

    // Microtask-Checkpoint abwarten
    await Promise.resolve();

    expect(aufrufReihenfolge).toEqual(['event-listener', 'store-subscriber']);
    // Zum Zeitpunkt des Listener-Aufrufs war der partieStand noch nicht auf Version 1 gepatcht
    expect(partieVersionBeimListenerAufruf).not.toBe(1);
  });

  it('STICH_ABGESCHLOSSEN-State ist beim Event-Listener-Aufruf noch nicht im Store sichtbar', async () => {
    // WARUM (B4): Szenario mit mehreren schnellen KI-Stichs. Wenn der Store-Patch
    // vor dem Listener käme, würde triggerRender() die geleerte Stichmitte rendern,
    // bevor animiereStichEinziehen() auch nur gestartet hat (Ghost-Render-Bug).
    // Dieser Test stellt sicher dass Store-Version beim Listener noch alt ist.
    const echtzeit = new FakeEchtzeit();
    const tisch = baueTisch('tisch-stich-order');
    const store = new AppStore(
      new FakeApi(
        { spielerId: 'spieler-1', name: 'Nora', istKi: false, aktiverTischId: null },
        [],
        tisch
      ) as unknown as SpielverwaltungApi,
      echtzeit
    );
    store.setzeKiKartenVerzögerung(0);
    await store.initialisieren();
    await store.betreteTisch(tisch.id);

    echtzeit.emit('/user/queue/tisch/tisch-stich-order', {
      timestamp: '2026-04-30T00:00:01Z',
      version: 1,
      ereignisTyp: 'SPIEL_GESTARTET',
      tischId: 'tisch-stich-order',
      tisch: { ...tisch, status: 'IM_SPIEL', partieId: 'partie-stich' },
      partieStand: null
    } as unknown as TischEreignisAntwort);

    // Erster Stand: Version 0 (wird von _darfPartieStandAktualisieren als neue Partie akzeptiert)
    const standVorStich = {
      partieId: 'partie-stich',
      version: 0,
      status: 'LAUFEND',
      anzahlSpiele: 8,
      gespielteSpiele: 0,
      gesamtpunktestand: { SUED: 0 },
      laufendesSpiel: {
        spielNummer: 1, hochzeitGeklaert: false, schweinchenGemeldetVon: null,
        aktuelleStichmitte: [{ spielerPosition: 'SUED', karte: { id: 'K1', farbe: 'KREUZ', wert: 'AS', exemplarIndex: 1 }, reihenfolge: 1 }],
        spielbareKarten: []
      }
    } as unknown as PartieStandAntwort;

    // Initial-Stand via SNAPSHOT etablieren
    echtzeit.emit('/user/queue/partie/partie-stich', batchieren({
      version: 0,
      ereignisTyp: 'SNAPSHOT',
      partieStand: standVorStich,
    } as unknown as PartieEreignisAntwort));

    await Promise.resolve();
    expect(store.snapshot().partieStand?.version).toBe(0);

    const standNachStich = {
      ...standVorStich,
      version: 1,
      laufendesSpiel: { ...standVorStich.laufendesSpiel, aktuelleStichmitte: [], spielbareKarten: [] }
    } as unknown as PartieStandAntwort;

    let partieStandWaehrendListenerAufruf: PartieStandAntwort | null = null;
    store.abonniereEvents((e) => {
      if (e.ereignisTyp === 'STICH_ABGESCHLOSSEN') {
        partieStandWaehrendListenerAufruf = store.snapshot().partieStand;
      }
    });

    echtzeit.emit('/user/queue/partie/partie-stich', batchieren({
      version: 1,
      ereignisTyp: 'STICH_ABGESCHLOSSEN',
      partieStand: standNachStich,
      neueSonderpunkte: [],
    } as unknown as PartieEreignisAntwort));

    await Promise.resolve();

    // Store-Subscriber hat den neuen Stand (version=1) gesetzt
    expect(store.snapshot().partieStand?.version).toBe(1);
    // Aber beim Listener-Aufruf war noch der alte Stand sichtbar (version=0)
    const standWaehrend = partieStandWaehrendListenerAufruf as PartieStandAntwort | null;
    expect(standWaehrend?.version).toBe(0);
    // Und die Stichmitte war beim Listener-Aufruf noch nicht geleert
    expect(standWaehrend?.laufendesSpiel?.aktuelleStichmitte?.length).toBeGreaterThan(0);
  });

  it('haelt die 4. Karte kuenstlich in aktuelleStichmitte wenn KARTE_GESPIELT einen leeren Tisch meldet', async () => {
    const echtzeit = new FakeEchtzeit();
    const tischMitPartie = { ...baueTisch('tisch-4'), partieId: 'partie-4' } as TischAntwort;
    const store = new AppStore(
      new FakeApi({ spielerId: 'spieler-1', name: 'Nora', istKi: false, aktiverTischId: null }, [], tischMitPartie) as unknown as SpielverwaltungApi,
      echtzeit
    );
    store.setzeKiKartenVerzögerung(0);
    await store.initialisieren();
    await store.betreteTisch('tisch-4');

    const partieStandVorher = {
      partieId: 'partie-4', version: 1, status: 'LAUFEND', anzahlSpiele: 8, gespielteSpiele: 0, gesamtpunktestand: { SUED: 0 },
      laufendesSpiel: {
        spielNummer: 1, hochzeitGeklaert: false, schweinchenGemeldetVon: null,
        aktuelleStichmitte: [
          { spielerPosition: 'SUED', karte: { id: 'K1' }, reihenfolge: 1 },
          { spielerPosition: 'WEST', karte: { id: 'K2' }, reihenfolge: 2 },
          { spielerPosition: 'NORD', karte: { id: 'K3' }, reihenfolge: 3 }
        ],
        spielbareKarten: []
      }
    } as unknown as PartieStandAntwort;

    echtzeit.emit('/user/queue/partie/partie-4', batchieren({ version: 1, ereignisTyp: 'SNAPSHOT', partieStand: partieStandVorher } as PartieEreignisAntwort));
    await Promise.resolve();

    // Backend liefert KARTE_GESPIELT und STICH_ABGESCHLOSSEN (beide mit leerer Mitte!)
    const partieStandNachher = {
      ...partieStandVorher, version: 2,
      laufendesSpiel: { ...partieStandVorher.laufendesSpiel, aktuelleStichmitte: [] }
    } as unknown as PartieStandAntwort;

    let mitteBeiListenerAufruf = -1;
    store.abonniereEvents((e) => {
      if (e.ereignisTyp === 'STICH_ABGESCHLOSSEN') {
        mitteBeiListenerAufruf = store.snapshot().partieStand?.laufendesSpiel?.aktuelleStichmitte.length ?? 0;
      }
    });

    // 1. KARTE_GESPIELT (4. Karte von OST)
    echtzeit.emit('/user/queue/partie/partie-4', batchieren({
      version: 2, ereignisTyp: 'KARTE_GESPIELT', spielerPosition: 'OST', karteId: 'KREUZ-AS-0', partieStand: partieStandNachher
    } as unknown as PartieEreignisAntwort));

    await Promise.resolve();
    // Nach KARTE_GESPIELT MUSS die Mitte kuenstlich auf 4 stehen (Synthesizer aktiv)
    console.log("STATE", JSON.stringify(store.snapshot().partieStand));
    expect(store.snapshot().partieStand?.laufendesSpiel?.aktuelleStichmitte).toHaveLength(4);

    // 2. STICH_ABGESCHLOSSEN
    echtzeit.emit('/user/queue/partie/partie-4', batchieren({
      version: 3, ereignisTyp: 'STICH_ABGESCHLOSSEN', partieStand: partieStandNachher, neueSonderpunkte: []
    } as unknown as PartieEreignisAntwort));

    await Promise.resolve();
    // Waehrend der Listener laeuft, sind noch alle 4 Karten da (fuer AnimationGuard)
    expect(mitteBeiListenerAufruf).toBe(4);
    // Danach ist der Tisch wieder leer
    expect(store.snapshot().partieStand?.laufendesSpiel?.aktuelleStichmitte).toHaveLength(0);
  });

  it('verzoegert KI-Kartenzuege um kiVerzoegerungMs wenn Menschen am Tisch sind', async () => {
    // Wichtig: Ohne Delay spielt die KI Karten sofort, was Animationen überspringt und
    // das Spielgefühl zerstört. Dieser Test stellt sicher, dass der Delay wirklich greift
    // und der State während der Wartezeit eingefroren bleibt.
    const echtzeit = new FakeEchtzeit();
    const tischMitPartie = { ...baueTisch('tisch-ki-delay'), partieId: 'partie-ki' } as TischAntwort;
    const store = new AppStore(
      new FakeApi({ spielerId: 'spieler-1', name: 'Nora', istKi: false, aktiverTischId: null }, [], tischMitPartie) as unknown as SpielverwaltungApi,
      echtzeit
    );
    store.setzeKiKartenVerzögerung(30);
    await store.initialisieren();
    await store.betreteTisch('tisch-ki-delay');

    const initialStand = {
      partieId: 'partie-ki', version: 1, status: 'LAUFEND', anzahlSpiele: 8, gespielteSpiele: 0,
      gesamtpunktestand: {},
      laufendesSpiel: {
        spielNummer: 1, hochzeitGeklaert: false, schweinchenGemeldetVon: null, schweinchenAktiv: false,
        spieler: [
          { position: 'SUED', istKi: false, istSelbst: true, name: 'Nora', spielerId: 'spieler-1', anzeigeName: 'Nora' },
          { position: 'WEST', istKi: true, istSelbst: false, name: 'KI-West', spielerId: 'ki-1', anzeigeName: 'KI-West' },
        ],
        aktuelleStichmitte: [], spielbareKarten: [], geber: 'SUED', aktuellerSpieler: 'WEST',
        ansageHistorie: [], moeglicheAnsagen: [], moeglicheVorbehalte: [], deklarierteVorbehalte: [], bockrundenZaehler: 0,
      }
    } as unknown as PartieStandAntwort;

    echtzeit.emit('/user/queue/partie/partie-ki', batchieren({
      version: 1, ereignisTyp: 'SNAPSHOT', partieStand: initialStand
    } as PartieEreignisAntwort));
    await new Promise<void>((r) => setTimeout(r, 10)); // SNAPSHOT verarbeiten lassen

    expect(store.snapshot().partieStand?.version).toBe(1);

    const nachKiKarte = { ...initialStand, version: 2 } as unknown as PartieStandAntwort;
    echtzeit.emit('/user/queue/partie/partie-ki', batchieren({
      version: 2, ereignisTyp: 'KARTE_GESPIELT', spielerPosition: 'WEST', karteId: 'KREUZ-AS-0',
      partieStand: nachKiKarte
    } as unknown as PartieEreignisAntwort));

    // Nach einem Microtask: State noch nicht aktualisiert — Delay (30ms) läuft noch
    await Promise.resolve();
    expect(store.snapshot().partieStand?.version).toBe(1);

    // Nach dem Delay: State muss aktualisiert sein
    await new Promise<void>((r) => setTimeout(r, 80));
    expect(store.snapshot().partieStand?.version).toBe(2);
  });

  it('verzichtet auf KI-Delay wenn kiVerzoegerungMs = 0', async () => {
    // Wichtig: Tests und E2E-Szenarien müssen schnell durchlaufen können.
    // setzeKiKartenVerzögerung(0) muss den Delay vollständig deaktivieren.
    const echtzeit = new FakeEchtzeit();
    const tischMitPartie = { ...baueTisch('tisch-ki-nodelay'), partieId: 'partie-ki-nd' } as TischAntwort;
    const store = new AppStore(
      new FakeApi({ spielerId: 'spieler-1', name: 'Nora', istKi: false, aktiverTischId: null }, [], tischMitPartie) as unknown as SpielverwaltungApi,
      echtzeit
    );
    store.setzeKiKartenVerzögerung(0);
    await store.initialisieren();
    await store.betreteTisch('tisch-ki-nodelay');

    const initialStand = {
      partieId: 'partie-ki-nd', version: 1, status: 'LAUFEND', anzahlSpiele: 8, gespielteSpiele: 0,
      gesamtpunktestand: {},
      laufendesSpiel: {
        spielNummer: 1, hochzeitGeklaert: false, schweinchenGemeldetVon: null, schweinchenAktiv: false,
        spieler: [
          { position: 'SUED', istKi: false, istSelbst: true, name: 'Nora', spielerId: 'spieler-1', anzeigeName: 'Nora' },
          { position: 'WEST', istKi: true, istSelbst: false, name: 'KI-West', spielerId: 'ki-1', anzeigeName: 'KI-West' },
        ],
        aktuelleStichmitte: [], spielbareKarten: [], geber: 'SUED', aktuellerSpieler: 'WEST',
        ansageHistorie: [], moeglicheAnsagen: [], moeglicheVorbehalte: [], deklarierteVorbehalte: [], bockrundenZaehler: 0,
      }
    } as unknown as PartieStandAntwort;

    echtzeit.emit('/user/queue/partie/partie-ki-nd', batchieren({
      version: 1, ereignisTyp: 'SNAPSHOT', partieStand: initialStand
    } as PartieEreignisAntwort));
    await new Promise<void>((r) => setTimeout(r, 10));

    const nachKiKarte = { ...initialStand, version: 2 } as unknown as PartieStandAntwort;
    echtzeit.emit('/user/queue/partie/partie-ki-nd', batchieren({
      version: 2, ereignisTyp: 'KARTE_GESPIELT', spielerPosition: 'WEST', karteId: 'KREUZ-AS-0',
      partieStand: nachKiKarte
    } as unknown as PartieEreignisAntwort));

    // Mit Delay=0: State sofort (nach Microtask-Queue) aktualisiert
    await new Promise<void>((r) => setTimeout(r, 10));
    expect(store.snapshot().partieStand?.version).toBe(2);
  });

  it('aktualisiert Tischliste via /user/queue/tische wenn kein Broadcast verfuegbar', async () => {
    // Wichtig: Der Store abonniert auch /user/queue/tische für spielerbezogene Aktualisierungen
    // (z.B. nach Snapshot-Request). Beide Kanäle müssen die tische[]-Liste aktualisieren.
    const echtzeit = new FakeEchtzeit();
    const store = new AppStore(
      new FakeApi(
        { spielerId: 'spieler-1', name: 'Nora', istKi: false, aktiverTischId: null },
        [],
        baueTisch()
      ) as unknown as SpielverwaltungApi,
      echtzeit
    );

    await store.initialisieren();
    expect(store.snapshot().tische).toHaveLength(0);

    echtzeit.emit('/user/queue/tische', {
      tische: [{ id: 'tisch-x', name: 'Mein Tisch', spielerAnzahl: 1, status: 'WARTEND', kurzKonfiguration: { ohneNeunen: false, anzahlSpiele: 8 } }]
    } as TischlisteEreignisAntwort);

    expect(store.snapshot().tische).toHaveLength(1);
    expect(store.snapshot().tische[0]).toMatchObject({ name: 'Mein Tisch' });
  });
  it('erstellt Tisch mit Preset', async () => {
    const echtzeit = new FakeEchtzeit();
    const api = new FakeApi({ spielerId: 's1', name: 'Nora', istKi: false, aktiverTischId: null }, [], baueTisch()) as unknown as SpielverwaltungApi;
    const apiSpy = vi.spyOn(api, 'erstelleTisch');
    const store = new AppStore(api, echtzeit);

    await store.erstelleTischMitPreset('Mein Tisch', 'STANDARD', true);
    expect(apiSpy).toHaveBeenCalledWith('Mein Tisch', undefined, true, 'STANDARD', undefined);
  });

  it('betritt Tisch via Code', async () => {
    const echtzeit = new FakeEchtzeit();
    const api = new FakeApi({ spielerId: 's1', name: 'Nora', istKi: false, aktiverTischId: null }, [], baueTisch()) as unknown as SpielverwaltungApi;
    const apiSpy = vi.spyOn(api, 'betreteTischViaCode');
    const store = new AppStore(api, echtzeit);

    await store.betreteTischViaCode('ABCDEF12');
    expect(apiSpy).toHaveBeenCalledWith('ABCDEF12');
  });

  it('kickeSpieler ruft API auf', async () => {
    const echtzeit = new FakeEchtzeit();
    const api = new FakeApi({ spielerId: 's1', name: 'Nora', istKi: false, aktiverTischId: null }, [], baueTisch('t1')) as unknown as SpielverwaltungApi;
    const apiSpy = vi.spyOn(api, 'kickeSpieler');
    const store = new AppStore(api, echtzeit);
    await store.betreteTisch('t1');

    await store.kickeSpieler('s2');
    expect(apiSpy).toHaveBeenCalledWith('t1', 's2');
  });
it('quittiert Meldung', async () => {
  const echtzeit = new FakeEchtzeit();
  const api = new FakeApi({ spielerId: 's1', name: 'S1', istKi: false }, [], baueTisch()) as unknown as SpielverwaltungApi;
  const store = new AppStore(api, echtzeit);
  store['patch']({ meldung: { text: 'Fehler', typ: 'fehler' } });
  store.quittiereMeldung();
  expect(store.snapshot().meldung).toBeNull();
});

it('toggles debug mode', () => {
  const api = new FakeApi({ spielerId: 's1', name: 'S1', istKi: false }, [], baueTisch()) as unknown as SpielverwaltungApi;
  const store = new AppStore(api, new FakeEchtzeit());
  expect(store.snapshot().debugModus).toBe(false);
  store.toggleDebugModus();
  expect(store.snapshot().debugModus).toBe(true);
  });

  it('behandelt Fehler bei Initialisierung', async () => {
    const api = new FakeApi({ spielerId: 's1', name: 'S1', istKi: false }, [], baueTisch()) as unknown as SpielverwaltungApi;
    vi.spyOn(api, 'initialisiereSpielerSession').mockRejectedValue(new Error('API Down'));
    const store = new AppStore(api, new FakeEchtzeit());
    await expect(store.initialisieren()).rejects.toThrow('Initialisierung fehlgeschlagen.');
    expect(store.snapshot().verbindung).toBe('offline');
  });

  it('setze KI-Kartenverzoegerung', () => {
    const api = new FakeApi({ spielerId: 's1', name: 'S1', istKi: false }, [], baueTisch()) as unknown as SpielverwaltungApi;
    const store = new AppStore(api, new FakeEchtzeit());
    store.setzeKiKartenVerzögerung(400);
    expect(store.snapshot().uiKonfiguration.kiVerzoegerungMs).toBe(400);
  });

  it('initialisiert die Session und lädt Tische', async () => {
    const api = new FakeApi({ spielerId: 's1', name: 'Nora', istKi: false }, [{ id: 't1', name: 'T1', spielerAnzahl: 1, status: 'WARTEND', kurzKonfiguration: { ohneNeunen: false, anzahlSpiele: 8 } }], baueTisch()) as unknown as SpielverwaltungApi;
    const store = new AppStore(api, new FakeEchtzeit());
    await store.initialisieren();
    expect(store.snapshot().initialisiert).toBe(true);
    expect(store.snapshot().tische).toHaveLength(1);
  });

  it('erkennt Sequenzlücke und bricht Batch-Verarbeitung ab', async () => {
    const echtzeit = new FakeEchtzeit();
    const api = new FakeApi({ spielerId: 's1', name: 'S1', istKi: false }, [], baueTisch()) as unknown as SpielverwaltungApi;
    const store = new AppStore(api, echtzeit);
    store['patch']({ aktuellerTisch: { id: 't1' } as TischAntwort });
    store['_letztePartieVersion'] = 5;
    const batch: PartieEreignisBatch = { version: 7, ereignisse: [] };
    const wsSpy = vi.spyOn(echtzeit, 'senden');
    await store['verarbeitePartieBatch'](batch);
    expect(wsSpy).toHaveBeenCalled();
  });

  it('ignoriert veraltete Batches', async () => {
    const api = new FakeApi({ spielerId: 's1', name: 'S1', istKi: false }, [], baueTisch()) as unknown as SpielverwaltungApi;
    const store = new AppStore(api, new FakeEchtzeit());
    store['_letztePartieVersion'] = 10;
    const batch: PartieEreignisBatch = { version: 5, ereignisse: [{ ereignisTyp: 'SNAPSHOT' } as PartieEreignisAntwort] };
    await store['verarbeitePartieBatch'](batch);
    expect(store['_eventQueue']).toHaveLength(0);
  });

  it('formatiereMeldung behandelt unbekannte Fehler', () => {
    const api = new FakeApi({ spielerId: 's1', name: 'S1', istKi: false }, [], baueTisch()) as unknown as SpielverwaltungApi;
    const store = new AppStore(api, new FakeEchtzeit());
    const m = store['formatiereMeldung'](new Error('Normaler Fehler'));
    expect(m.text).toBe('Unbekannter Fehler.');
  });

  it('setzt Meldung bei TischStore-API-Fehler ohne Exception zu werfen', async () => {
    // Warum: Netzwerkfehler/500 dürfen nicht als stille Unhandled Rejections verschwinden
    const api = new FakeApi({ spielerId: 's1', name: 'S1', istKi: false }, [], baueTisch()) as unknown as SpielverwaltungApi;
    vi.spyOn(api, 'betreteTisch').mockRejectedValue(new SpielverwaltungFehler('NETZWERKFEHLER', 'Server nicht erreichbar'));
    const store = new AppStore(api, new FakeEchtzeit());
    await store.initialisieren();
    await store.betreteTisch('t1'); // darf nicht werfen
    expect(store.snapshot().meldung).toEqual({ typ: 'fehler', text: 'Server nicht erreichbar', fehlerCode: 'NETZWERKFEHLER' });
  });

  it('setzt Meldung bei SessionStore-Fehler und propagiert die Exception weiter', async () => {
    // Warum: BootSzene-catch muss feuern; Toast zeigt Fehlerdetail statt stiller Rejection
    const api = new FakeApi({ spielerId: 's1', name: 'S1', istKi: false }, [], baueTisch()) as unknown as SpielverwaltungApi;
    vi.spyOn(api, 'initialisiereSpielerSession').mockRejectedValue(new SpielverwaltungFehler('AUTH_FEHLER', 'Nicht autorisiert'));
    const store = new AppStore(api, new FakeEchtzeit());
    await expect(store.initialisieren()).rejects.toThrow('Initialisierung fehlgeschlagen.');
    expect(store.snapshot().meldung).toMatchObject({ typ: 'fehler' });
  });
});

