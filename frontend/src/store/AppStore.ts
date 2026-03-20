import type {
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
import { SpielverwaltungFehler } from '../services/SpielverwaltungApi';
import type { EchtzeitPort } from '../services/SpielverwaltungEchtzeit';

export interface UiMeldung {
  typ: 'fehler' | 'info';
  text: string;
  fehlerCode?: string;
}

export interface AppZustand {
  initialisiert: boolean;
  wirdGeladen: boolean;
  bereich: 'LOBBY' | 'TISCH';
  verbindung: 'offline' | 'verbinde' | 'verbunden' | 'fehler';
  debugModus: boolean;
  spieler: SpielerSessionAntwort | null;
  tische: TischListenEintragAntwort[];
  aktuellerTisch: TischAntwort | null;
  partieStand: PartieStandAntwort | null;
  meldung: UiMeldung | null;
}

type Listener = (zustand: AppZustand) => void;

function erzeugeAnfangszustand(): AppZustand {
  return {
    initialisiert: false,
    wirdGeladen: false,
    bereich: 'LOBBY',
    verbindung: 'offline',
    debugModus: false,
    spieler: null,
    tische: [],
    aktuellerTisch: null,
    partieStand: null,
    meldung: null
  };
}

function istBekannterFehler(fehler: unknown): fehler is { message: string } {
  return Boolean(fehler && typeof fehler === 'object' && 'message' in fehler && typeof fehler.message === 'string');
}

export class AppStore {
  private zustand: AppZustand = erzeugeAnfangszustand();

  private readonly listener = new Set<Listener>();

  private readonly gemeinsameAbos: Array<() => void> = [];

  private readonly tischAbos: Array<() => void> = [];

  private aktuellePartieAbo: Uuid | null = null;

  constructor(
    private readonly api: SpielverwaltungApi,
    private readonly echtzeit: EchtzeitPort
  ) {}

  abonnieren(listener: Listener): () => void {
    this.listener.add(listener);
    listener(this.snapshot());
    return () => this.listener.delete(listener);
  }

  snapshot(): AppZustand {
    return structuredClone(this.zustand);
  }

  async initialisieren(): Promise<void> {
    if (this.zustand.initialisiert) {
      return;
    }

    await this.fuehreMitStatus(async () => {
      this.patch({ verbindung: 'verbinde' });
      const spieler = await this.api.initialisiereSpielerSession();
      await this.echtzeit.verbinde();
      this.registriereGemeinsameAbos();
      const tische = await this.api.listeTische();
      this.patch({
        spieler,
        tische,
        initialisiert: true,
        verbindung: 'verbunden',
        meldung: null
      });
      this.echtzeit.senden('/app/tische/snapshot');
    });
  }

  async aktualisiereTischliste(): Promise<void> {
    await this.fuehreMitStatus(async () => {
      const tische = await this.api.listeTische();
      this.patch({ tische });
      this.echtzeit.senden('/app/tische/snapshot');
    });
  }

  async erstelleTisch(name: string): Promise<void> {
    const tischName = name.trim();
    if (!tischName) {
      this.patch({ meldung: { typ: 'fehler', text: 'Bitte gib einen Tischnamen ein.', fehlerCode: 'ANFRAGE_UNGUELTIG' } });
      return;
    }

    await this.fuehreMitStatus(async () => {
      const tisch = await this.api.erstelleTisch(tischName);
      this.oeffneTisch(tisch);
    });
  }

  async betreteTisch(tischId: Uuid): Promise<void> {
    await this.fuehreMitStatus(async () => {
      const tisch = await this.api.betreteTisch(tischId);
      this.oeffneTisch(tisch);
    });
  }

  async verlasseAktuellenTisch(): Promise<void> {
    const tisch = this.zustand.aktuellerTisch;
    if (!tisch) {
      return;
    }

    await this.fuehreMitStatus(async () => {
      await this.api.verlasseTisch(tisch.id);
      this.setzeTischAbosZurueck();
      this.patch({ aktuellerTisch: null, partieStand: null, bereich: 'LOBBY' });
      await this.aktualisiereTischliste();
    });
  }

  async starteAktuellenTisch(): Promise<void> {
    const tisch = this.zustand.aktuellerTisch;
    if (!tisch) {
      return;
    }

    await this.fuehreMitStatus(async () => {
      await this.api.starteTisch(tisch.id);
    });
  }

  quittiereMeldung(): void {
    this.patch({ meldung: null });
  }

  toggleDebugModus(): void {
    const debugModus = !this.zustand.debugModus;
    this.patch({ debugModus });
    this.fordereAktuellenPartieSnapshotAn(debugModus);
  }

  trennen(): void {
    this.setzeTischAbosZurueck();
    this.gemeinsameAbos.splice(0).forEach((abmelden) => abmelden());
    this.echtzeit.trennen();
    this.zustand = erzeugeAnfangszustand();
    this.veroeffentliche();
  }

  private registriereGemeinsameAbos(): void {
    if (this.gemeinsameAbos.length > 0) {
      return;
    }

    this.gemeinsameAbos.push(
      this.echtzeit.abonnieren<TischlisteEreignisAntwort>('/topic/tische', (ereignis) => {
        this.patch({ tische: ereignis.tische });
      }),
      this.echtzeit.abonnieren<TischlisteEreignisAntwort>('/user/queue/tische', (ereignis) => {
        this.patch({ tische: ereignis.tische });
      }),
      this.echtzeit.abonnieren<SpielverwaltungWebSocketFehlerAntwort>('/user/queue/fehler', (fehler) => {
        this.patch({
          meldung: {
            typ: 'fehler',
            text: fehler.nachricht,
            fehlerCode: fehler.fehlerCode
          }
        });
      })
    );
  }

  private oeffneTisch(tisch: TischAntwort): void {
    this.patch({ aktuellerTisch: tisch, partieStand: null, bereich: 'TISCH', meldung: null });
    this.registriereTischAbos(tisch.id, tisch.partieId);
  }

  private registriereTischAbos(tischId: Uuid, partieId: Uuid | null): void {
    this.setzeTischAbosZurueck();
    this.aktuellePartieAbo = partieId;
    this.tischAbos.push(
      this.echtzeit.abonnieren<TischEreignisAntwort>(`/topic/tisch/${tischId}`, (ereignis) => {
        this.verarbeiteTischEreignis(ereignis);
      }),
      this.echtzeit.abonnieren<TischEreignisAntwort>(`/user/queue/tisch/${tischId}`, (ereignis) => {
        this.verarbeiteTischEreignis(ereignis);
      })
    );

    if (partieId) {
      this.registrierePartieAbos(partieId);
    }

    this.echtzeit.senden(`/app/tisch/${tischId}/snapshot`);
    this.forderePartieSnapshotAn(partieId, this.zustand.debugModus);
  }

  private registrierePartieAbos(partieId: Uuid): void {
    this.tischAbos.push(
      this.echtzeit.abonnieren<PartieEreignisAntwort>(`/topic/partie/${partieId}`, (ereignis) => {
        this.patch({ partieStand: ereignis.partieStand });
      }),
      this.echtzeit.abonnieren<PartieEreignisAntwort>(`/user/queue/partie/${partieId}`, (ereignis) => {
        this.patch({ partieStand: ereignis.partieStand });
      })
    );
  }

  private fordereAktuellenPartieSnapshotAn(debugModus: boolean): void {
    this.forderePartieSnapshotAn(this.zustand.aktuellerTisch?.partieId ?? this.zustand.partieStand?.partieId ?? null, debugModus);
  }

  private forderePartieSnapshotAn(partieId: Uuid | null, debugModus: boolean): void {
    if (!partieId) {
      return;
    }
    this.echtzeit.senden(debugModus ? `/app/partie/${partieId}/debug-snapshot` : `/app/partie/${partieId}/snapshot`);
  }

  private verarbeiteTischEreignis(ereignis: TischEreignisAntwort): void {
    if (ereignis.ereignisTyp === 'TISCH_ENTFERNT' || !ereignis.tisch) {
      this.setzeTischAbosZurueck();
      this.patch({ aktuellerTisch: null, partieStand: null, bereich: 'LOBBY' });
      return;
    }

    const bekanntePartieId = this.aktuellePartieAbo;
    const partiestand = ereignis.partieStand ?? this.zustand.partieStand;
    this.patch({ aktuellerTisch: ereignis.tisch, partieStand: partiestand, bereich: 'TISCH' });

    if (ereignis.tisch.partieId && ereignis.tisch.partieId !== bekanntePartieId) {
      this.registriereTischAbos(ereignis.tisch.id, ereignis.tisch.partieId);
    }
  }

  private setzeTischAbosZurueck(): void {
    this.tischAbos.splice(0).forEach((abmelden) => abmelden());
    this.aktuellePartieAbo = null;
  }

  private patch(aenderungen: Partial<AppZustand>): void {
    this.zustand = { ...this.zustand, ...aenderungen };
    this.veroeffentliche();
  }

  private veroeffentliche(): void {
    const zustand = this.snapshot();
    this.listener.forEach((listener) => listener(zustand));
  }

  private async fuehreMitStatus<T>(aktion: () => Promise<T>): Promise<T> {
    this.patch({ wirdGeladen: true });
    try {
      const ergebnis = await aktion();
      this.patch({ wirdGeladen: false });
      return ergebnis;
    } catch (fehler) {
      this.patch({
        wirdGeladen: false,
        verbindung: this.zustand.initialisiert ? this.zustand.verbindung : 'fehler',
        meldung: this.formatiereMeldung(fehler)
      });
      throw fehler;
    }
  }

  private formatiereMeldung(fehler: unknown): UiMeldung {
    if (fehler instanceof SpielverwaltungFehler) {
      return { typ: 'fehler', text: fehler.message, fehlerCode: fehler.fehlerCode };
    }
    if (istBekannterFehler(fehler)) {
      return { typ: 'fehler', text: fehler.message };
    }
    return { typ: 'fehler', text: 'Es ist ein unerwarteter Frontend-Fehler aufgetreten.' };
  }
}
