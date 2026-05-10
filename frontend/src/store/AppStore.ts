import type {
  Ansage,
  KiSchwierigkeit,
  KarteGespieltEreignis,
  PartieEreignisAntwort,
  PartieEreignisBatch,
  PartieStandAntwort,
  SonderpunktEreignisAntwortDto,
  SpielverwaltungWebSocketFehlerAntwort,
  SpielerPosition,
  SpielerSessionAntwort,
  TischKonfigurationDto,
  Tischhintergrund,
  TischAntwort,
  TischEreignisAntwort,
  TischListenEintragAntwort,
  TischlisteEreignisAntwort,
  TischPresetAntwort,
  Uuid,
  VorbehaltAnsage
} from '../modelle/SpielverwaltungDto';
import type { SpielverwaltungApi } from '../services/SpielverwaltungApi';
import { SpielverwaltungFehler } from '../services/SpielverwaltungApi';
import type { EchtzeitPort } from '../services/SpielverwaltungEchtzeit';
import { Logger } from '../logger';

export interface UiMeldung {
  typ: 'fehler' | 'info';
  text: string;
  fehlerCode?: string;
}

export interface UiKonfiguration {
  /** Wartezeit zwischen KI-Kartenzügen in Millisekunden. 0 = kein Delay (z.B. für E2E-Tests). */
  kiVerzoegerungMs: number;
}

export interface SpielprotokollEintrag {
  nr: number;
  geber: SpielerPosition;
  spieltyp: string;
  istBockrunde: boolean;
  punkteProSpieler: Record<string, { pkt: number; stand: number }>;
}

export interface AppZustand {
  initialisiert: boolean;
  wirdGeladen: boolean;
  bereich: 'LOGIN' | 'SPIELVERWALTUNG' | 'TISCH';
  verbindung: 'offline' | 'verbinde' | 'verbunden' | 'fehler';
  debugModus: boolean;
  authentifiziert: boolean;
  spieler: SpielerSessionAntwort | null;
  tische: TischListenEintragAntwort[];
  aktuellerTisch: TischAntwort | null;
  partieStand: PartieStandAntwort | null;
  meldung: UiMeldung | null;
  uiKonfiguration: UiKonfiguration;
  /** Verbleibende Sekunden des Countdown nach Partie-Ende; null wenn kein Countdown aktiv. */
  countdownSekunden: number | null;
  spielProtokollEintraege: SpielprotokollEintrag[];
}

export type PartieEreignisListener = (ereignis: PartieEreignisAntwort) => void | Promise<void>;
export type SonderpunkteListener = (ereignis: SonderpunktEreignisAntwortDto[]) => void;
export type StoreAbo = (zustand: AppZustand) => void;

function erzeugeAnfangszustand(): AppZustand {
  return {
    initialisiert: false,
    wirdGeladen: false,
    bereich: 'LOGIN',
    verbindung: 'offline',
    debugModus: false,
    authentifiziert: false,
    spieler: null,
    tische: [],
    aktuellerTisch: null,
    partieStand: null,
    meldung: null,
    uiKonfiguration: { kiVerzoegerungMs: 800 },
    countdownSekunden: null,
    spielProtokollEintraege: []
  };
}

/**
 * Zentraler Zustandsspeicher der Anwendung.
 * Verwaltet den App-Zustand, koordiniert API-Aufrufe und WebSocket-Ereignisse,
 * und benachrichtigt registrierte Listener bei Zustandsänderungen.
 */
export class AppStore {
  private zustand: AppZustand = erzeugeAnfangszustand();
  private readonly listener = new Set<StoreAbo>();
  private readonly gemeinsameAbos: Array<() => void> = [];
  private tischAbos: Array<() => void> = [];
  private aktuellePartieAbo: Uuid | null = null;
  private _letztePartieVersion = -1;
  private readonly _sonderpunkteListener = new Set<SonderpunkteListener>();
  private readonly _eventListener = new Set<PartieEreignisListener>();
  private _eventQueue: PartieEreignisAntwort[] = [];
  private _verarbeiteEventLaeuft = false;
  private _queuePausiert = false;
  private _aktuelleSequenzId = 0;
  private _queueGeneration = 0;
  private _verpassterSpielBeendet: PartieEreignisAntwort | null = null;

  /**
   * Pausiert die Verarbeitung der Event-Warteschlange (z.B. solange Rundenauswertung sichtbar).
   */
  pausiereQueue(): void {
    this._queuePausiert = true;
  }

  /**
   * Setzt die Verarbeitung der Event-Warteschlange fort.
   */
  setzeQueueFort(): void {
    this._queuePausiert = false;
    void this._verarbeiteEventQueue();
  }

  /**
   * Gibt zurück, ob sich der Store im Leerlauf befindet.
   * Dies ist der Fall, wenn keine Events in der Queue sind und keine Event-Verarbeitung läuft.
   */
  isIdle(): boolean {
    const loco = (window as any).__locodoko;
    if (loco) {
      loco._storeIdleDebug = {
        queuePausiert: this._queuePausiert,
        eventQueueLength: this._eventQueue.length,
        verarbeiteEventLaeuft: this._verarbeiteEventLaeuft
      };
    }
    if (this._queuePausiert) return true;
    return this._eventQueue.length === 0 && !this._verarbeiteEventLaeuft;
  }

  /**
   * Setzt die Verzögerung für KI-Kartenanimationen.
   * @param ms Dauer in Millisekunden.
   */
  setzeKiKartenVerzögerung(ms: number): void {
    this.patch({ uiKonfiguration: { ...this.zustand.uiKonfiguration, kiVerzoegerungMs: ms } });
  }

  /**
   * Abonniert Partie-Ereignisse.
   * Der Listener kann ein Promise zurueckgeben, um die Queue-Verarbeitung zu pausieren
   * (Sequential Processing Pattern).
   */
  abonniereEvents(listener: PartieEreignisListener): () => void {
    this._eventListener.add(listener);
    if (this._verpassterSpielBeendet) {
      const verpasst = this._verpassterSpielBeendet;
      this._verpassterSpielBeendet = null;
      void Promise.resolve().then(async () => {
        const res = listener(verpasst);
        if (res instanceof Promise) await res;
      });
    }
    return () => {
      this._eventListener.delete(listener);
      if (this._eventListener.size === 0) this._verpassterSpielBeendet = null;
    };
  }

  /**
   * Abonniert Sonderpunkt-Ereignisse.
   * @param listener Callback-Funktion, die bei neuen Sonderpunkten aufgerufen wird.
   * @returns Eine Funktion zur Abmeldung des Listeners.
   */
  abonniereSonderpunkte(listener: SonderpunkteListener): () => void {
    this._sonderpunkteListener.add(listener);
    return () => this._sonderpunkteListener.delete(listener);
  }

  /**
   * Erstellt eine neue Instanz des AppStore.
   * @param api API-Service für HTTP-Anfragen.
   * @param echtzeit Echtzeit-Service für WebSocket-Kommunikation.
   */
  constructor(private readonly api: SpielverwaltungApi, private readonly echtzeit: EchtzeitPort) {}

  /**
   * Abonniert Zustandsänderungen des Stores.
   * @param listener Callback-Funktion, die bei jeder Zustandsänderung aufgerufen wird.
   * @returns Eine Funktion zur Abmeldung des Listeners.
   */
  abonniere(listener: StoreAbo): () => void {
    this.listener.add(listener);
    listener(this.snapshot());
    return () => this.listener.delete(listener);
  }

  /**
   * Erstellt eine tiefe Kopie des aktuellen Anwendungszustands.
   * @returns Der aktuelle Zustand.
   */
  snapshot(): AppZustand {
    return structuredClone(this.zustand);
  }

  /**
   * Initialisiert die Anwendung (Spielersession, Verbindung, Tischliste).
   */
  async initialisieren(): Promise<void> {
    if (this.zustand.initialisiert) return;
    await this.fuehreMitStatus(async () => {
      this.patch({ verbindung: 'verbinde' });
      try {
        const spieler = await this.api.initialisiereSpielerSession();
        await this.echtzeit.verbinde();
        this.registriereGemeinsameAbos();
        const tische = await this.api.listeTische();
        this.patch({ spieler, tische, initialisiert: true, verbindung: 'verbunden', meldung: null });
        this.echtzeit.senden('/app/tische/snapshot');
      } catch {
        this.patch({ verbindung: 'offline' });
        throw new Error('Initialisierung fehlgeschlagen.');
      }
    });
  }

  /**
   * Registriert einen neuen Benutzer.
   * @param benutzername Benutzername.
   * @param passwort Passwort.
   * @param email Optionale E-Mail-Adresse.
   */
  async registrieren(benutzername: string, passwort: string, email?: string): Promise<void> {
    await this.fuehreMitStatus(async () => {
      await this.api.registrieren(benutzername, passwort, email);
      this.patch({ authentifiziert: true, bereich: 'SPIELVERWALTUNG' });
      await this.initialisieren();
    });
  }

  /**
   * Loggt einen Benutzer ein.
   * @param benutzername Benutzername.
   * @param passwort Passwort.
   */
  async einloggen(benutzername: string, passwort: string): Promise<void> {
    await this.fuehreMitStatus(async () => {
      await this.api.einloggen(benutzername, passwort);
      this.patch({ authentifiziert: true, bereich: 'SPIELVERWALTUNG' });
      await this.initialisieren();
    });
  }

  /**
   * Loggt den Benutzer aus.
   */
  async ausloggen(): Promise<void> {
    await this.api.ausloggen().catch(() => undefined);
    this.echtzeit.trennen();
    this.zustand = erzeugeAnfangszustand();
    this.veroeffentliche();
  }

  /**
   * Startet die Anwendung als Gast.
   */
  async alsGastStarten(): Promise<void> {
    this.patch({ authentifiziert: true, bereich: 'SPIELVERWALTUNG' });
    await this.initialisieren();
  }

  /**
   * Aktualisiert die Liste der verfügbaren Tische.
   */
  async aktualisiereTischliste(): Promise<void> {
    await this.fuehreMitStatus(async () => {
      const tische = await this.api.listeTische();
      this.patch({ tische });
      this.echtzeit.senden('/app/tische/snapshot');
    });
  }

  /**
   * Erstellt ein schnelles Spiel (Quick Game).
   */
  async erstelleQuickGame(): Promise<void> {
    await this.fuehreMitStatus(async () => {
      const tisch = await this.api.schnellstart();
      this.oeffneTisch(tisch);
      this.echtzeit.senden(`/app/tisch/${tisch.id}/snapshot`);
    });
  }

  /**
   * Erstellt einen konfigurierten Tisch.
   * @param name Tischname.
   * @param konfiguration Tischkonfiguration.
   * @param privat Ob der Tisch privat sein soll.
   */
  async erstelleKonfiguriertenTisch(name: string, konfiguration: Partial<TischKonfigurationDto>, privat?: boolean): Promise<void> {
    const tischName = name.trim();
    if (!tischName) {
      this.patch({ meldung: { typ: 'fehler', text: 'Tischname leer.', fehlerCode: 'ANFRAGE_UNGUELTIG' } });
      return;
    }
    await this.fuehreMitStatus(async () => {
      const tisch = await this.api.erstelleTisch(tischName, undefined, privat);
      if (Object.keys(konfiguration).length > 0) {
        await this.api.aktualisiereTischKonfiguration(tisch.id, { ...tisch.konfiguration, ...konfiguration });
      }
      this.oeffneTisch(tisch);
    });
  }

  /** Lädt alle verfügbaren Regel-Presets. */
  async ladePresets(): Promise<TischPresetAntwort[]> {
    return this.api.gibPresets();
  }

  /**
   * Erstellt einen neuen Tisch basierend auf einem Preset.
   * @param name Name des Tisches.
   * @param presetName Technischer Name des Presets.
   * @param privat Wenn true, wird der Tisch privat erstellt.
   */
  async erstelleTischMitPreset(name: string, presetName: string, privat?: boolean): Promise<void> {
    const tischName = name.trim();
    if (!tischName) {
      this.patch({ meldung: { typ: 'fehler', text: 'Tischname leer.', fehlerCode: 'ANFRAGE_UNGUELTIG' } });
      return;
    }
    await this.fuehreMitStatus(async () => {
      const tisch = await this.api.erstelleTisch(tischName, undefined, privat, presetName);
      this.oeffneTisch(tisch);
    });
  }

  /**
   * Erstellt einen neuen Tisch mit Standardkonfiguration.
   * @param name Tischname.
   */
  async erstelleTisch(name: string): Promise<void> {
    await this.erstelleKonfiguriertenTisch(name, {});
  }

  /**
   * Betritt einen bestehenden Tisch.
   * @param tischId ID des Tisches.
   */
  async betreteTisch(tischId: Uuid): Promise<void> {
    await this.fuehreMitStatus(async () => {
      const tisch = await this.api.betreteTisch(tischId);
      this.oeffneTisch(tisch);
    });
  }

  /**
   * Betritt einen Tisch mittels Einladungscode.
   * @param einladungsCode Einladungscode.
   */
  async betreteTischViaCode(einladungsCode: string): Promise<void> {
    await this.fuehreMitStatus(async () => {
      const tisch = await this.api.betreteTischViaCode(einladungsCode);
      this.oeffneTisch(tisch);
    });
  }

  /**
   * Stellt die Verbindung zu einem Tisch wieder her.
   * @param tischId ID des Tisches.
   */
  reconnecteTisch(tischId: Uuid): void {
    // Spiel-State vor Snapshot-Verarbeitung zurücksetzen (verbindungsabbruch.md:70):
    // aktuellerTisch und partieStand auf null, damit kein alter Overlay-Zustand den
    // initialen Render der TischSzene kontaminiert, bevor der Snapshot eintrifft.
    this.patch({ aktuellerTisch: null, partieStand: null });
    this.setzeTischAbosZurueck();
    this.registriereTischAbos(tischId, null);
    this.patch({ bereich: 'TISCH' });
    this.echtzeit.senden(`/app/tisch/${tischId}/snapshot`);
  }

  /**
   * Kickt einen Spieler vom Tisch.
   * @param spielerId ID des Spielers.
   */
  async kickeSpieler(spielerId: Uuid): Promise<void> {
    const tischId = this.zustand.aktuellerTisch?.id;
    if (!tischId) return;
    await this.fuehreMitStatus(async () => { await this.api.kickeSpieler(tischId, spielerId); });
  }

  /**
   * Lädt den Namen eines Tisches.
   * @param tischId ID des Tisches.
   * @returns Der Tischname.
   */
  async ladeTischName(tischId: Uuid): Promise<string> {
    return (await this.api.ladeTisch(tischId)).name;
  }

  /**
   * Verlässt den aktuell betretenen Tisch.
   */
  async verlasseAktuellenTisch(): Promise<void> {
    const tisch = this.zustand.aktuellerTisch;
    if (!tisch) return;
    await this.fuehreMitStatus(async () => {
      await this.api.verlasseTisch(tisch.id);
      this.setzeTischAbosZurueck();
      this.patch({ aktuellerTisch: null, partieStand: null, bereich: 'SPIELVERWALTUNG' });
    });
    void this.aktualisiereTischliste();
  }

  /**
   * Startet den aktuell betretenen Tisch.
   */
  async starteAktuellenTisch(): Promise<void> {
    const tisch = this.zustand.aktuellerTisch;
    if (!tisch) return;
    await this.fuehreMitStatus(async () => { await this.api.starteTisch(tisch.id); });
  }

  /**
   * Startet eine neue Partie am aktuellen Tisch.
   */
  async starteNeuePartie(): Promise<void> {
    const tisch = this.zustand.aktuellerTisch;
    if (!tisch) return;
    await this.fuehreMitStatus(async () => { await this.api.starteNeuePartie(tisch.id); });
  }

  /**
   * Aktualisiert den Tischhintergrund am aktuellen Tisch.
   * @param tischhintergrund Gewählter Hintergrund.
   */
  async aktualisiereAktuellenTischhintergrund(tischhintergrund: Tischhintergrund): Promise<void> {
    const tisch = this.zustand.aktuellerTisch;
    if (!tisch) return;
    if (tisch.konfiguration.tischhintergrund === tischhintergrund) return;
    await this.fuehreMitStatus(async () => {
      const konfiguration = await this.api.aktualisiereTischKonfiguration(tisch.id, { ...tisch.konfiguration, tischhintergrund });
      this.patch({ aktuellerTisch: { ...tisch, konfiguration }, meldung: null });
    });
  }

  /**
   * Aktualisiert die KI-Schwierigkeit am aktuellen Tisch.
   * @param kiSchwierigkeit Neue Schwierigkeitsstufe.
   */
  async aktualisiereAktuelleKiSchwierigkeit(kiSchwierigkeit: KiSchwierigkeit): Promise<void> {
    const tisch = this.zustand.aktuellerTisch;
    if (!tisch) return;
    if (tisch.konfiguration.kiSchwierigkeit === kiSchwierigkeit) return;
    await this.fuehreMitStatus(async () => {
      const konfiguration = await this.api.aktualisiereTischKonfiguration(tisch.id, { ...tisch.konfiguration, kiSchwierigkeit });
      this.patch({ aktuellerTisch: { ...tisch, konfiguration }, meldung: null });
    });
  }

  /**
   * Spielt eine Karte am Tisch aus.
   * @param karteId ID der Karte.
   */
  spieleKarte(karteId: string): void {
    const tischId = this.zustand.aktuellerTisch?.id;
    if (tischId) this.sendeSpielaktion(`/app/tisch/${tischId}/karte`, { karteId });
  }

  /**
   * Gibt eine Ansage ab.
   * @param ansage Ansagetyp.
   */
  sageAnsageAn(ansage: Ansage): void {
    const tischId = this.zustand.aktuellerTisch?.id;
    if (tischId) this.sendeSpielaktion(`/app/tisch/${tischId}/ansage`, { ansage });
  }

  /**
   * Meldet einen Vorbehalt.
   * @param vorbehalt Vorbehaltstyp.
   */
  meldeVorbehalt(vorbehalt: VorbehaltAnsage): void {
    const tischId = this.zustand.aktuellerTisch?.id;
    if (tischId) this.sendeSpielaktion(`/app/tisch/${tischId}/vorbehalt`, { vorbehalt });
  }

  /**
   * Beantwortet eine Armut.
   * @param angenommen Ob die Armut angenommen wurde.
   * @param kartenIds IDs der getauschten Karten.
   */
  beantworteArmut(angenommen: boolean, kartenIds: string[]): void {
    const tischId = this.zustand.aktuellerTisch?.id;
    if (tischId) this.sendeSpielaktion(`/app/tisch/${tischId}/armut-antwort`, { angenommen, kartenIds });
  }

  /**
   * Quittiert die aktuell angezeigte Meldung.
   */
  quittiereMeldung(): void { this.patch({ meldung: null }); }

  /**
   * Schaltet den Debug-Modus um.
   */
  toggleDebugModus(): void {
    const debugModus = !this.zustand.debugModus;
    this.patch({ debugModus });
    const partieId = this.zustand.aktuellerTisch?.partieId ?? this.zustand.partieStand?.partieId ?? null;
    if (partieId) this.echtzeit.senden(debugModus ? `/app/partie/${partieId}/debug-snapshot` : `/app/partie/${partieId}/snapshot`);
  }

  /**
   * Trennt alle Verbindungen und setzt den Zustand zurück.
   */
  trennen(): void {
    this.setzeTischAbosZurueck();
    this.gemeinsameAbos.splice(0).forEach((abmelden) => abmelden());
    this.echtzeit.trennen();
    this.zustand = erzeugeAnfangszustand();
    this.veroeffentliche();
  }


  private registriereGemeinsameAbos(): void {
    if (this.gemeinsameAbos.length > 0) return;
    this.gemeinsameAbos.push(
      this.echtzeit.abonnieren<TischlisteEreignisAntwort>('/topic/tische', (e) => this.patch({ tische: e.tische })),
      this.echtzeit.abonnieren<TischlisteEreignisAntwort>('/user/queue/tische', (e) => this.patch({ tische: e.tische })),
      this.echtzeit.abonnieren<SpielverwaltungWebSocketFehlerAntwort>('/user/queue/fehler', (f) => this.patch({ meldung: { typ: 'fehler', text: f.nachricht, fehlerCode: f.fehlerCode }, wirdGeladen: false }))
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
      this.echtzeit.abonnieren<TischEreignisAntwort>(`/topic/tisch/${tischId}`, (e) => this.verarbeiteTischEreignis(e)),
      this.echtzeit.abonnieren<TischEreignisAntwort>(`/user/queue/tisch/${tischId}`, (e) => this.verarbeiteTischEreignis(e))
    );
    if (partieId) this.registrierePartieAbos(partieId);
    this.echtzeit.senden(`/app/tisch/${tischId}/snapshot`);
  }

  private registrierePartieAbos(partieId: Uuid): void {
    // aktuellePartieAbo MUSS hier gesetzt werden, damit verarbeiteTischEreignis
    // bei nachfolgenden TischEreignissen mit derselben partieId NICHT erneut
    // registrierePartieAbos aufruft und doppelte Subscriptions erzeugt.
    this.aktuellePartieAbo = partieId;
    this.tischAbos.push(this.echtzeit.abonnieren<PartieEreignisBatch>(`/user/queue/partie/${partieId}`, (batch) => {
      this.verarbeitePartieBatch(batch);
    }));
    this.echtzeit.senden(`/app/partie/${partieId}/snapshot`);
  }

  private verarbeiteTischEreignis(ereignis: TischEreignisAntwort): void {
    Logger.websocket(`Empfange TischEreignis: ${ereignis.ereignisTyp}`, ereignis);
    if (ereignis.ereignisTyp === 'COUNTDOWN_TICK') {
      this.patch({ countdownSekunden: ereignis.verbleibendeSekunden ?? null });
      return;
    }
    if (ereignis.ereignisTyp === 'PARTIE_ABGEBROCHEN') {
      this.setzeTischAbosZurueck();
      this.patch({ aktuellerTisch: null, partieStand: null, bereich: 'SPIELVERWALTUNG', meldung: { typ: 'info', text: 'Partie abgebrochen.', fehlerCode: 'PARTIE_ABGEBROCHEN' }, countdownSekunden: null });
      return;
    }
    if (ereignis.ereignisTyp === 'TISCH_ENTFERNT' || !ereignis.tisch) {
      this.setzeTischAbosZurueck();
      this.patch({ aktuellerTisch: null, partieStand: null, bereich: 'SPIELVERWALTUNG', countdownSekunden: null });
      return;
    }

    let partiestand = this.zustand.partieStand;
    if (ereignis.partieStand) {
      if (this._darfPartieStandAktualisieren(ereignis.partieStand, ereignis.partieStand.version)) {
        partiestand = ereignis.partieStand;
      } else {
        Logger.websocket('Ignoriere veralteten PartieStand aus TischEreignis', {
          neu: ereignis.partieStand.version,
          letzte: this._letztePartieVersion
        });
      }
    }

    this.patch({
      aktuellerTisch: ereignis.tisch,
      partieStand: partiestand,
      bereich: 'TISCH',
      wirdGeladen: false,
      // Countdown beenden wenn neues Spiel gestartet wird
      countdownSekunden: ereignis.ereignisTyp === 'SPIEL_GESTARTET' ? null : this.zustand.countdownSekunden
    });
    if (ereignis.tisch.partieId && ereignis.tisch.partieId !== this.aktuellePartieAbo) {
      this.registrierePartieAbos(ereignis.tisch.partieId);
    }
  }

  private verarbeitePartieBatch(batch: PartieEreignisBatch): void {
    Logger.websocket(`Empfange PartieBatch: v=${batch.version}, ${batch.ereignisse.length} Ereignis(se)`, batch);

    const ersteEreignisTyp = batch.ereignisse[0]?.ereignisTyp;
    const erstePartieId = batch.ereignisse[0]?.partieStand?.partieId ?? null;
    const istSnapshot = ersteEreignisTyp === 'SNAPSHOT';
    const istNeuePartie = erstePartieId != null && erstePartieId !== this.zustand.partieStand?.partieId;

    // Sequenzluecke pruefen (nur wenn gleiche Partie und Version bekannt)
    if (!istNeuePartie && !istSnapshot && this._letztePartieVersion >= 0) {
      if (batch.version > this._letztePartieVersion + 1) {
        Logger.error(`Batch-Sequenzluecke: Erwartet v=${this._letztePartieVersion + 1}, erhalten v=${batch.version}`);
        const tischId = this.zustand.aktuellerTisch?.id;
        if (tischId) this.reconnecteTisch(tischId);
        return;
      }
    }

    // Stale batch verwerfen (ausser bei neuer Partie)
    if (!istNeuePartie && batch.version < this._letztePartieVersion) {
      Logger.websocket('Verwerfe veralteten Batch', { batchVersion: batch.version, letzte: this._letztePartieVersion });
      return;
    }

    this._letztePartieVersion = batch.version;

    batch.ereignisse.forEach(e => this._eventQueue.push(e));
    void this._verarbeiteEventQueue();
  }

  private async _verarbeiteEventQueue(): Promise<void> {
    if (this._verarbeiteEventLaeuft || this._queuePausiert) return;
    this._verarbeiteEventLaeuft = true;
    try {
      while (this._eventQueue.length > 0 && !this._queuePausiert) {
        
        // Quiescence Pattern: Warten bis alle Animationen/Szenen-Logik des VORHERIGEN Events beendet sind
        if (typeof window !== 'undefined') {
          const locodoko = (window as { __locodoko?: { isIdle?: (f: boolean) => boolean } }).__locodoko;
          if (locodoko && typeof locodoko.isIdle === 'function') {
             while (!locodoko.isIdle(true) && !this._queuePausiert && this._eventQueue.length > 0) {
               await new Promise<void>((r) => setTimeout(r, 50));
             }
          }
        }
        
        // Erneut checken, ob in der Zwischenzeit pausiert wurde oder Queue geleert wurde
        if (this._queuePausiert || this._eventQueue.length === 0) break;

        const ereignis = this._eventQueue.shift();
        if (!ereignis) break;;

        // Sequential Processing Pattern:
        // Wir rufen die Event-Listener IMMER auf, solange das Ereignis in der Queue ist.
        // Den Store-Patch (partieStand) überspringen wir jedoch, wenn bereits ein neuerer
        // Stand (z.B. durch einen Snapshot oder Reconnect) vorliegt.
        const darfStorePatchen = !!ereignis.partieStand && this._darfPartieStandAktualisieren(ereignis.partieStand, ereignis.version);
        if (!darfStorePatchen && ereignis.partieStand) {
          Logger.websocket('Verarbeite Ereignis ohne Store-Patch (neuerer Snapshot vorhanden)', {
            typ: ereignis.ereignisTyp,
            version: ereignis.version,
            storeVersion: this.zustand.partieStand?.version
          });
        }

        this._aktuelleSequenzId++; // Neue Sequenz fuer jedes Event (Animation-Guard)

        // SPIEL_BEENDET-Tracking muss vor dem Listener-Aufruf geprueft werden,
        // da Listener die Groesse des Sets nicht veraendern sollen.
        if (ereignis.ereignisTyp === 'SPIEL_BEENDET') {
          if (this._eventListener.size === 0) {
            this._verpassterSpielBeendet = ereignis;
          } else {
            this._verpassterSpielBeendet = null;
          }
        }

        // KI-Verzögerung: Menschlicheres Spielgefühl bei KI-Kartenzügen (nur wenn Menschen am Tisch sind).
        // kiVerzoegerungMs = 0 deaktiviert den Delay (z.B. in E2E-Tests).
        if (ereignis.ereignisTyp === 'KARTE_GESPIELT' && this.zustand.uiKonfiguration.kiVerzoegerungMs > 0) {
          const spielerImSpiel = this.zustand.partieStand?.laufendesSpiel?.spieler ?? [];
          const istKiZug = spielerImSpiel.find(s => s.position === (ereignis as KarteGespieltEreignis).spielerPosition)?.istKi ?? false;
          const hatMenschlicheSpieler = this.zustand.aktuellerTisch?.spieler.some(s => !s.istKi);
          if (istKiZug && hatMenschlicheSpieler) {
            const generationVorDelay = this._queueGeneration;
            await new Promise<void>((r) => setTimeout(r, this.zustand.uiKonfiguration.kiVerzoegerungMs));
            if (this._queuePausiert || this._queueGeneration !== generationVorDelay) break;
          }
        }

        // State VOR den Listenern patchen fuer flüssige Übergänge (KARTE_GESPIELT)
        // Dadurch sieht triggerRender() am Ende der Animation sofort den korrekten Folgestatus.
        const prevStand = this.zustand.partieStand;
        if (darfStorePatchen) {
          if (ereignis.ereignisTyp === 'KARTE_GESPIELT') {
            if (prevStand) {
              const syntheticStand = this._synthetischerKarteGespielt(prevStand, ereignis as KarteGespieltEreignis);
              this.patch({ partieStand: syntheticStand });
            } else {
              this.patch({ partieStand: ereignis.partieStand });
            }
          } else if (ereignis.partieStand && ereignis.ereignisTyp !== 'STICH_ABGESCHLOSSEN' && ereignis.ereignisTyp !== 'SPIEL_BEENDET') {
            this.patch({ partieStand: ereignis.partieStand });
          }
        }

        // Event-Listener aufrufen
        // FUEHRT Sequential Processing Pattern gemaess Requirement 30 aus.
        try {
          for (const l of this._eventListener) {
            const res = l(ereignis);
            if (res instanceof Promise) await res;
          }
        } catch (e) {
          Logger.error('Event-Listener hat einen Fehler geworfen', e);
        }

        // Finales Patching / Spezial-Handling NACH den Listenern
        switch (ereignis.ereignisTyp) {
          case 'SNAPSHOT':
            this._eventQueue.length = 0;
            break;
          case 'KARTE_GESPIELT':
            // Bereits oben via Synthetic Patch erledigt
            break;
          case 'STICH_ABGESCHLOSSEN': {
             if (darfStorePatchen) this.patch({ partieStand: ereignis.partieStand });
             if (ereignis.neueSonderpunkte.length) this._sonderpunkteListener.forEach((l) => l(ereignis.neueSonderpunkte));
             break;
          }
          case 'SPIEL_BEENDET': {
            if (darfStorePatchen) this.patch({ partieStand: ereignis.partieStand });
            const erg = ereignis.partieStand.letztesSpielergebnis;
            if (erg) {
              const geber = prevStand?.laufendesSpiel?.geber ?? 'SUED';
              const istBockrunde = (prevStand?.laufendesSpiel?.bockrundenZaehler ?? 0) > 0;
              const punkteProSpieler = {} as Record<string, { pkt: number; stand: number }>;
              Object.keys(erg.spielpunkteProSpieler).forEach((pos) => {
                punkteProSpieler[pos] = {
                  pkt: erg.spielpunkteProSpieler[pos as SpielerPosition] ?? 0,
                  stand: ereignis.partieStand.gesamtpunktestand?.[pos as SpielerPosition] ?? 0
                };
              });
              this.patch({
                spielProtokollEintraege: [
                  ...this.zustand.spielProtokollEintraege,
                  {
                    nr: erg.spielNummer,
                    geber,
                    spieltyp: erg.spieltyp,
                    istBockrunde,
                    punkteProSpieler
                  }
                ]
              });
            }
             break;
          }
          case 'ANSAGE_ERFOLGT':
          case 'SCHWEINCHEN_GEMELDET':
          case 'HOCHZEIT_PARTNER_GEFUNDEN':
          case 'SPIEL_GESTARTET':
          case 'AKTION_ABGELEHNT':
            // Patching bereits oben erledigt
            break;
        }
      }
    } finally {
      this._verarbeiteEventLaeuft = false;
    }
  }

  private _synthetischerKarteGespielt(prevStand: PartieStandAntwort, ereignis: KarteGespieltEreignis): PartieStandAntwort {
    if (!prevStand.laufendesSpiel || !ereignis.partieStand.laufendesSpiel) return prevStand;
    const kartenInMitte = [...(prevStand.laufendesSpiel.aktuelleStichmitte ?? [])];
    const maxReihenfolge = kartenInMitte.reduce((max, k) => Math.max(max, k.reihenfolge ?? 0), 0);
    if (!kartenInMitte.some(k => k.spielerPosition === ereignis.spielerPosition)) {
      const [farbe, wert, idx] = ereignis.karteId.split('-');
      kartenInMitte.push({
        spielerPosition: ereignis.spielerPosition,
        karte: { id: ereignis.karteId, farbe: farbe ?? '', wert: wert ?? '', exemplarIndex: parseInt(idx ?? '0', 10) },
        reihenfolge: maxReihenfolge + 1,
      });
    }
    return {
      ...ereignis.partieStand,
      laufendesSpiel: {
        ...ereignis.partieStand.laufendesSpiel,
        aktuelleStichmitte: kartenInMitte,
      }
    };
  }

  private _darfPartieStandAktualisieren(neuerStand: PartieStandAntwort, neueVersion: number): boolean {
    const aktuellePartieId = this.zustand.partieStand?.partieId;

    // Wenn neue Partie: immer akzeptieren
    if (neuerStand.partieId !== aktuellePartieId) {
      return true;
    }

    const aktuelleStoreVersion = this.zustand.partieStand?.version ?? -1;

    // Wir erlauben >=, weil mehrere Ereignisse (z.B. KarteGespielt und StichAbgeschlossen)
    // in derselben Backend-Transaktion entstehen koennen und daher dieselbe Version haben.
    const darfPatchen = neueVersion >= aktuelleStoreVersion;
    if (!darfPatchen) {
      Logger.websocket('PartieStand-Patch abgelehnt (veraltet)', {
        neueVersion,
        aktuelleStoreVersion,
        partieId: neueStand.partieId
      });
    }
    return darfPatchen;
  }

  private setzeTischAbosZurueck(): void {
    this.tischAbos.splice(0).forEach((a) => a());
    this.aktuellePartieAbo = null;
    this._letztePartieVersion = -1;
    this._aktuelleSequenzId++; // Invalidiert laufende KI-Animationen
    this._queueGeneration++; // Bricht in-flight KI-Delays ab (Reconnect/Reset-Schutz)
    this._eventQueue.length = 0;
    this._verarbeiteEventLaeuft = false;
    this._queuePausiert = false;
    this._verpassterSpielBeendet = null;
  }
  private sendeSpielaktion(ziel: string, payload: unknown): void {
    try { this.patch({ meldung: null }); this.echtzeit.senden(ziel, payload); } catch (f) { this.patch({ meldung: this.formatiereMeldung(f) }); }
  }
  private patch(aenderungen: Partial<AppZustand>): void {
    if (aenderungen.partieStand) {
      const stand = aenderungen.partieStand;
      const spiel = stand.laufendesSpiel;
      Logger.websocket('Patching PartieStand', {
        spielNr: spiel?.spielNummer,
        phase: spiel?.phase,
        handkarten: spiel?.spieler?.find(s => s.istSelbst)?.verbleibendeKarten
      });
    }
    this.zustand = { ...this.zustand, ...aenderungen };
    this.veroeffentliche();
  }
  private veroeffentliche(): void { const zustand = this.snapshot(); this.listener.forEach((l) => l(zustand)); }
  private async fuehreMitStatus<T>(aktion: () => Promise<T>): Promise<T> {
    this.patch({ wirdGeladen: true });
    try { return await aktion(); } finally { this.patch({ wirdGeladen: false }); }
  }
  private formatiereMeldung(fehler: unknown): UiMeldung {
    if (fehler instanceof SpielverwaltungFehler) return { typ: 'fehler', text: fehler.message, fehlerCode: fehler.fehlerCode };
    return { typ: 'fehler', text: 'Unbekannter Fehler.' };
  }
}
