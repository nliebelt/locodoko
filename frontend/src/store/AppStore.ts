import type {
  Ansage,
  KiSchwierigkeit,
  PartieEreignisAntwort,
  PartieStandAntwort,
  SpielverwaltungWebSocketFehlerAntwort,
  SpielerSessionAntwort,
  TischKonfigurationDto,
  Tischhintergrund,
  TischAntwort,
  TischEreignisAntwort,
  TischListenEintragAntwort,
  TischlisteEreignisAntwort,
  Uuid,
  VorbehaltAnsage
} from '../modelle/SpielverwaltungDto';
import type { SpielverwaltungApi } from '../services/SpielverwaltungApi';
import { SpielverwaltungFehler } from '../services/SpielverwaltungApi';
import type { EchtzeitPort } from '../services/SpielverwaltungEchtzeit';
import { Logger } from '../logger';

/** Anzeige-Meldung fuer den Nutzer (Fehler oder Hinweis). */
export interface UiMeldung {
  /** Art der Meldung: Fehler (rot) oder Information (blau). */
  typ: 'fehler' | 'info';
  /** Anzeigetext der Meldung. */
  text: string;
  /** Maschinenlesbarer Fehlercode fuer spezifische Behandlung (z.B. 'PARTIE_ABGEBROCHEN'). */
  fehlerCode?: string;
}

/**
 * Gesamter Anwendungszustand — einzige Quelle der Wahrheit im Frontend.
 *
 * Wird immutabel per `structuredClone` aus dem AppStore herausgegeben.
 * Alle UI-Komponenten lesen ausschliesslich aus diesem Zustand.
 */
export interface AppZustand {
  /** true nach erfolgreicher Session-Initialisierung und WebSocket-Verbindung. */
  initialisiert: boolean;
  /** true waehrend einer laufenden HTTP-Anfrage (Lade-Indikator). */
  wirdGeladen: boolean;
  /** Aktuell angezeigter Bereich der Anwendung. */
  bereich: 'SPIELVERWALTUNG' | 'TISCH';
  /** WebSocket-Verbindungsstatus. */
  verbindung: 'offline' | 'verbinde' | 'verbunden' | 'fehler';
  /** true wenn der Debug-Modus aktiv ist (alle Haende sichtbar). */
  debugModus: boolean;
  /** Session des eingeloggten Spielers; null bis zur Initialisierung. */
  spieler: SpielerSessionAntwort | null;
  /** Aktuelle Tischliste aus dem letzten Snapshot. */
  tische: TischListenEintragAntwort[];
  /** Aktuell geoeffneter Tisch; null in der Lobby. */
  aktuellerTisch: TischAntwort | null;
  /** Aktueller Partie-Stand; null wenn keine Partie laeuft. */
  partieStand: PartieStandAntwort | null;
  /** Letzte Nutzer-Meldung (Fehler oder Hinweis); null wenn keine Meldung aktiv. */
  meldung: UiMeldung | null;
}

type Listener = (zustand: AppZustand) => void;

function erzeugeAnfangszustand(): AppZustand {
  return {
    initialisiert: false,
    wirdGeladen: false,
    bereich: 'SPIELVERWALTUNG',
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

/**
 * Zentraler Zustandsspeicher der Locodoko-Anwendung.
 *
 * Verwaltet den gesamten AppZustand reaktiv und stellt ihn allen UI-Szenen
 * als immutablen Snapshot bereit. Koordiniert REST-API-Aufrufe (SpielverwaltungApi)
 * und WebSocket-Abonnements (EchtzeitPort) und leitet alle eingehenden Ereignisse
 * als State-Updates weiter.
 *
 * Verwendung: `appStore.abonnieren(listener)` — der Listener wird sofort mit dem
 * aktuellen Zustand aufgerufen und danach bei jeder Zustandsaenderung.
 */
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

  /**
   * Registriert einen Listener und ruft ihn sofort mit dem aktuellen Zustand auf.
   * @param listener - Callback, der bei jeder Zustandsaenderung aufgerufen wird
   * @returns Abmelde-Funktion zum Entfernen des Listeners
   */
  abonnieren(listener: Listener): () => void {
    this.listener.add(listener);
    listener(this.snapshot());
    return () => this.listener.delete(listener);
  }

  /**
   * Gibt einen tiefen Klon des aktuellen Zustands zurueck.
   * Alle Listener erhalten ebenfalls tiefe Klone — Mutationen haben keinen Effekt.
   */
  snapshot(): AppZustand {
    return structuredClone(this.zustand);
  }

  /**
   * Initialisiert die Anwendung: Spieler-Session anlegen, WebSocket verbinden,
   * gemeinsame Abonnements registrieren und initiale Tischliste laden.
   * Idempotent: bei bereits initialisiertem Zustand wird nichts getan.
   * @throws Error bei Verbindungs- oder Session-Fehler (wird als UiMeldung gesetzt)
   */
  async initialisieren(): Promise<void> {
    if (this.zustand.initialisiert) {
      return;
    }

    await this.fuehreMitStatus(async () => {
      this.patch({ verbindung: 'verbinde' });
      try {
        const spieler = await this.api.initialisiereSpielerSession();
        Logger.store('Spieler-Session erfolgreich initialisiert', { spielerId: spieler.spielerId });
        try {
          await this.echtzeit.verbinde();
          Logger.store('WebSocket-Verbindung erfolgreich hergestellt');
          this.registriereGemeinsameAbos();
          const tische = await this.api.listeTische();
          Logger.store('Tischliste erfolgreich geladen');
          this.patch({
            spieler,
            tische,
            initialisiert: true,
            verbindung: 'verbunden',
            meldung: null
          });
          this.echtzeit.senden('/app/tische/snapshot');
        } catch (wsFehler) {
          Logger.store('WebSocket-Verbindungsfehler', { fehler: wsFehler });
          throw new Error('WebSocket-Verbindung fehlgeschlagen.');
        }
      } catch (apiFehler) {
        Logger.store('API-Session-Initialisierungsfehler', { fehler: apiFehler });
        throw new Error('API-Session-Initialisierung fehlgeschlagen.');
      }
    });
  }

  /** Laedt die Tischliste per REST neu und fordert einen WebSocket-Snapshot an. */
  async aktualisiereTischliste(): Promise<void> {
    await this.fuehreMitStatus(async () => {
      const tische = await this.api.listeTische();
      this.patch({ tische });
      this.echtzeit.senden('/app/tische/snapshot');
    });
  }

  /**
   * Schnellstart: Tritt einem offenen Tisch bei oder erstellt einen neuen.
   * KI-Spieler werden serverseitig aufgefuellt und die Partie sofort gestartet.
   */
  async erstelleQuickGame(): Promise<void> {
    await this.fuehreMitStatus(async () => {
      const tisch = await this.api.schnellstart();
      this.oeffneTisch(tisch);
      this.echtzeit.senden(`/app/tisch/${tisch.id}/snapshot`);
    });
  }

  /**
   * Erstellt einen neuen Tisch und überschreibt danach selektiv die gewünschten Konfig-Felder.
   * Strategie: Erst erstellen (Backend-Defaults), dann PATCH der User-Prefs via PUT.
   */
  async erstelleKonfiguriertenTisch(name: string, konfiguration: Partial<TischKonfigurationDto>): Promise<void> {
    const tischName = name.trim();
    if (!tischName) {
      this.patch({ meldung: { typ: 'fehler', text: 'Bitte gib einen Tischnamen ein.', fehlerCode: 'ANFRAGE_UNGUELTIG' } });
      return;
    }

    await this.fuehreMitStatus(async () => {
      // Erst ohne Konfiguration erstellen, damit Backend-Defaults greifen
      const tisch = await this.api.erstelleTisch(tischName);
      // Dann User-Prefs als vollständige Konfiguration (Defaults + Overrides) zurückschreiben
      const hatOverrides = Object.keys(konfiguration).length > 0;
      if (hatOverrides) {
        const vollstaendig: TischKonfigurationDto = { ...tisch.konfiguration, ...konfiguration };
        await this.api.aktualisiereTischKonfiguration(tisch.id, vollstaendig);
      }
      this.oeffneTisch(tisch);
    });
  }

  /**
   * Erstellt einen neuen Tisch mit dem angegebenen Namen und wechselt zur TischSzene.
   * @param name - Tischname (wird getrimmt; leer → Fehlermeldung ohne HTTP-Aufruf)
   */
  async erstelleTisch(name: string): Promise<void> {
    await this.erstelleKonfiguriertenTisch(name, {});
  }

  /**
   * Tritt einem bestehenden Tisch bei und wechselt zur TischSzene.
   * @param tischId - ID des beizutretenden Tisches
   */
  async betreteTisch(tischId: Uuid): Promise<void> {
    await this.fuehreMitStatus(async () => {
      const tisch = await this.api.betreteTisch(tischId);
      this.oeffneTisch(tisch);
    });
  }

  /**
   * Tritt einem Tisch ueber seinen Einladungscode bei und wechselt zur TischSzene.
   * @param einladungsCode - 8-stelliger alphanumerischer Code
   */
  async betreteTischViaCode(einladungsCode: string): Promise<void> {
    await this.fuehreMitStatus(async () => {
      const tisch = await this.api.betreteTischViaCode(einladungsCode);
      this.oeffneTisch(tisch);
    });
  }

  /**
   * Session-Recovery nach Tab-Reload: Abonniert den Tisch direkt anhand seiner ID
   * und fordert einen Snapshot an, ohne erneut beizutreten.
   * Der Snapshot kommt asynchron via WebSocket und befuellt den Zustand.
   */
  reconnecteTisch(tischId: Uuid): void {
    Logger.store('Session-Recovery: Reconnect zu Tisch', { tischId });
    this.setzeTischAbosZurueck();
    this.registriereTischAbos(tischId, null);
    this.patch({ bereich: 'TISCH' });
    this.echtzeit.senden(`/app/tisch/${tischId}/snapshot`);
  }

  /**
   * Laedt den Namen eines Tisches per REST-API.
   * Wird fuer die Session-Recovery verwendet, wenn nur die TischId bekannt ist.
   * @param tischId - ID des Tisches
   * @returns Name des Tisches
   */
  async ladeTischName(tischId: Uuid): Promise<string> {
    const tisch = await this.api.ladeTisch(tischId);
    return tisch.name;
  }

  /**
   * Verlaesst den aktuellen Tisch und kehrt zur Lobby zurueck.
   * Bei laufender Partie wird diese fuer alle Spieler abgebrochen.
   */
  async verlasseAktuellenTisch(): Promise<void> {
    const tisch = this.zustand.aktuellerTisch;
    if (!tisch) {
      return;
    }

    await this.fuehreMitStatus(async () => {
      await this.api.verlasseTisch(tisch.id);
      this.setzeTischAbosZurueck();
      this.patch({ aktuellerTisch: null, partieStand: null, bereich: 'SPIELVERWALTUNG' });
    });
    // Tischliste separat aktualisieren — wirdGeladen ist hier bereits false,
    // damit der Erstellen-Button in der SpielverwaltungsSzene sofort aktiv ist.
    void this.aktualisiereTischliste();
  }

  /** Startet die Partie am aktuellen Tisch (nur fuer den Tisch-Ersteller moeglich). */
  async starteAktuellenTisch(): Promise<void> {
    const tisch = this.zustand.aktuellerTisch;
    if (!tisch) {
      return;
    }

    await this.fuehreMitStatus(async () => {
      await this.api.starteTisch(tisch.id);
    });
  }

  /**
   * Startet eine neue Partie am aktuellen Tisch nach Ende der vorherigen Partie.
   * Idempotent: Wenn die Partie bereits laeuft, wird nichts getan.
   */
  async starteNeuePartie(): Promise<void> {
    const tisch = this.zustand.aktuellerTisch;
    if (!tisch) {
      return;
    }
    await this.fuehreMitStatus(async () => {
      await this.api.starteNeuePartie(tisch.id);
    });
  }

  /**
   * Aendert den Tischhintergrund per REST-API und aktualisiert den lokalen Zustand.
   * Bei bereits gesetztem Hintergrund wird kein HTTP-Aufruf gemacht.
   * @param tischhintergrund - Neuer Tischhintergrund (FILZ_GRUEN | HOLZ_DUNKEL | BLAU_GRAFIK)
   */
  async aktualisiereAktuellenTischhintergrund(tischhintergrund: Tischhintergrund): Promise<void> {
    const tisch = this.zustand.aktuellerTisch;
    if (!tisch) {
      this.aktuellerTischIdOderFehler();
      return;
    }
    if (tisch.konfiguration.tischhintergrund === tischhintergrund) {
      return;
    }

    await this.fuehreMitStatus(async () => {
      const konfiguration = await this.api.aktualisiereTischKonfiguration(
        tisch.id,
        this.aktualisierteKonfiguration(tisch.konfiguration, tischhintergrund)
      );
      this.patch({
        aktuellerTisch: {
          ...tisch,
          konfiguration
        },
        meldung: null
      });
    });
  }

  /** Aktualisiert die KI-Schwierigkeitsstufe des aktuellen Tisches. */
  async aktualisiereAktuelleKiSchwierigkeit(kiSchwierigkeit: KiSchwierigkeit): Promise<void> {
    const tisch = this.zustand.aktuellerTisch;
    if (!tisch) {
      this.aktuellerTischIdOderFehler();
      return;
    }
    if (tisch.konfiguration.kiSchwierigkeit === kiSchwierigkeit) {
      return;
    }

    await this.fuehreMitStatus(async () => {
      const konfiguration = await this.api.aktualisiereTischKonfiguration(
        tisch.id,
        { ...tisch.konfiguration, kiSchwierigkeit }
      );
      this.patch({
        aktuellerTisch: {
          ...tisch,
          konfiguration
        },
        meldung: null
      });
    });
  }

  /**
   * Sendet die Spielaktion "Karte ausspielen" per WebSocket.
   * @param karteId - ID der auszuspielenden Karte
   */
  spieleKarte(karteId: string): void {
    if (!karteId.trim()) {
      this.patch({ meldung: { typ: 'fehler', text: 'Es wurde keine gueltige Karte ausgewaehlt.', fehlerCode: 'KARTE_UNGUELTIG' } });
      return;
    }
    const tischId = this.aktuellerTischIdOderFehler();
    if (!tischId) {
      return;
    }
    this.sendeSpielaktion(`/app/tisch/${tischId}/karte`, { karteId });
  }

  /**
   * Sendet die Spielaktion "Ansage machen" per WebSocket.
   * @param ansage - Typ der Ansage (RE, KONTRA, KEINE_90, …)
   */
  sageAnsageAn(ansage: Ansage): void {
    const tischId = this.aktuellerTischIdOderFehler();
    if (!tischId) {
      return;
    }
    this.sendeSpielaktion(`/app/tisch/${tischId}/ansage`, { ansage });
  }

  /**
   * Sendet die Vorbehalt-Ansage per WebSocket.
   * @param vorbehalt - Vorbehalt-Typ (GESUND, SOLO_*, HOCHZEIT, ARMUT)
   */
  meldeVorbehalt(vorbehalt: VorbehaltAnsage): void {
    const tischId = this.aktuellerTischIdOderFehler();
    if (!tischId) {
      return;
    }
    this.sendeSpielaktion(`/app/tisch/${tischId}/vorbehalt`, { vorbehalt });
  }

  /**
   * Sendet die Antwort auf ein Armut-Angebot per WebSocket.
   * @param angenommen - true wenn der Spieler die Armut annimmt
   * @param kartenIds - IDs der zurueckzugebenden Karten (bei Annahme)
   */
  beantworteArmut(angenommen: boolean, kartenIds: string[]): void {
    const tischId = this.aktuellerTischIdOderFehler();
    if (!tischId) {
      return;
    }
    this.sendeSpielaktion(`/app/tisch/${tischId}/armut-antwort`, { angenommen, kartenIds });
  }

  /** Blendet die aktuelle Fehlermeldung oder Hinweismeldung aus. */
  quittiereMeldung(): void {
    this.patch({ meldung: null });
  }

  /**
   * Schaltet den Debug-Modus um und fordert einen neuen Partie-Snapshot an.
   * Im Debug-Modus sind alle Handkarten aller Spieler sichtbar.
   */
  toggleDebugModus(): void {
    const debugModus = !this.zustand.debugModus;
    this.patch({ debugModus });
    this.fordereAktuellenPartieSnapshotAn(debugModus);
  }

  /**
   * Trennt alle WebSocket-Abonnements und die Verbindung, setzt den Zustand zurueck.
   * Wird beim App-Teardown oder bei explizitem Logout aufgerufen.
   */
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
        Logger.store('Partie-Snapshot', { status: ereignis.partieStand?.status });
        this.patch({ partieStand: ereignis.partieStand });
      }),
      this.echtzeit.abonnieren<PartieEreignisAntwort>(`/user/queue/partie/${partieId}`, (ereignis) => {
        Logger.store('Partie-Snapshot', { status: ereignis.partieStand?.status });
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
    if (ereignis.ereignisTyp === 'PARTIE_ABGEBROCHEN') {
      Logger.store('Partie abgebrochen – Zurueck zur Lobby');
      this.setzeTischAbosZurueck();
      this.patch({
        aktuellerTisch: null,
        partieStand: null,
        bereich: 'SPIELVERWALTUNG',
        meldung: { typ: 'info', text: 'Die Partie wurde abgebrochen, weil ein Spieler den Tisch verlassen hat.', fehlerCode: 'PARTIE_ABGEBROCHEN' }
      });
      return;
    }
    if (ereignis.ereignisTyp === 'TISCH_ENTFERNT' || !ereignis.tisch) {
      Logger.store('Zurueck zur Lobby');
      this.setzeTischAbosZurueck();
      this.patch({ aktuellerTisch: null, partieStand: null, bereich: 'SPIELVERWALTUNG' });
      return;
    }

    const bekanntePartieId = this.aktuellePartieAbo;
    const partiestand = ereignis.partieStand ?? this.zustand.partieStand;
    Logger.store('Tisch-Snapshot', { tischId: ereignis.tisch.id, status: ereignis.tisch.status });
    this.patch({ aktuellerTisch: ereignis.tisch, partieStand: partiestand, bereich: 'TISCH' });

    if (ereignis.tisch.partieId && ereignis.tisch.partieId !== bekanntePartieId) {
      this.registriereTischAbos(ereignis.tisch.id, ereignis.tisch.partieId);
    }
  }

  private setzeTischAbosZurueck(): void {
    this.tischAbos.splice(0).forEach((abmelden) => abmelden());
    this.aktuellePartieAbo = null;
  }

  private sendeSpielaktion(ziel: string, payload: unknown): void {
    Logger.store('Aktion ausgeloest', { typ: ziel });
    try {
      this.patch({ meldung: null });
      this.echtzeit.senden(ziel, payload);
    } catch (fehler) {
      this.patch({ meldung: this.formatiereMeldung(fehler) });
    }
  }

  private aktuellerTischIdOderFehler(): Uuid | null {
    const tischId = this.zustand.aktuellerTisch?.id ?? null;
    if (!tischId) {
      this.patch({
        meldung: {
          typ: 'fehler',
          text: 'Es ist aktuell kein Tisch geoeffnet.',
          fehlerCode: 'TISCH_NICHT_AUSGEWAEHLT'
        }
      });
      return null;
    }
    return tischId;
  }

  private patch(aenderungen: Partial<AppZustand>): void {
    this.zustand = { ...this.zustand, ...aenderungen };
    this.veroeffentliche();
  }

  private aktualisierteKonfiguration(
    konfiguration: TischKonfigurationDto,
    tischhintergrund: Tischhintergrund
  ): TischKonfigurationDto {
    return {
      ...konfiguration,
      tischhintergrund
    };
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
