import type {
  Ansage,
  KiSchwierigkeit,
  KarteGespieltEreignis,
  PartieEreignisAntwort,
  PartieStandAntwort,
  SonderpunktEreignisAntwortDto,
  SpielverwaltungWebSocketFehlerAntwort,
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
}

type Listener = (zustand: AppZustand) => void;

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
    countdownSekunden: null
  };
}

/**
 * Zentraler Zustandsspeicher der Anwendung.
 * Verwaltet den App-Zustand, koordiniert API-Aufrufe und WebSocket-Ereignisse,
 * und benachrichtigt registrierte Listener bei Zustandsänderungen.
 */
export class AppStore {
  private zustand: AppZustand = erzeugeAnfangszustand();
  private readonly listener = new Set<Listener>();
  private readonly gemeinsameAbos: Array<() => void> = [];
  private tischAbos: Array<() => void> = [];
  private aktuellePartieAbo: Uuid | null = null;
  private _letztePartieVersion = -1;
  private readonly _sonderpunkteListener = new Set<(sonderpunkte: SonderpunktEreignisAntwortDto[]) => void>();
  private readonly _eventListener = new Set<(ereignis: PartieEreignisAntwort) => void>();
  private _eventQueue: PartieEreignisAntwort[] = [];
  private _verarbeiteEventLaeuft = false;
  private _queuePausiert = false;
  private _aktuelleSequenzId = 0;
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
    return this._eventQueue.length === 0 && !this._verarbeiteEventLaeuft && !this._queuePausiert;
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
   * @param listener Callback-Funktion, die bei Eintreffen eines Ereignisses aufgerufen wird.
   * @returns Eine Funktion zur Abmeldung des Listeners.
   */
  abonniereEvents(listener: (ereignis: PartieEreignisAntwort) => void): () => void {
    this._eventListener.add(listener);
    if (this._verpassterSpielBeendet) {
      const verpasst = this._verpassterSpielBeendet;
      this._verpassterSpielBeendet = null;
      void Promise.resolve().then(() => listener(verpasst));
    }
    return () => this._eventListener.delete(listener);
  }

  /**
   * Abonniert Sonderpunkt-Ereignisse.
   * @param listener Callback-Funktion, die bei neuen Sonderpunkten aufgerufen wird.
   * @returns Eine Funktion zur Abmeldung des Listeners.
   */
  abonniereSonderpunkte(listener: (sonderpunkte: SonderpunktEreignisAntwortDto[]) => void): () => void {
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
  abonnieren(listener: Listener): () => void {
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
    this.tischAbos.push(this.echtzeit.abonnieren<PartieEreignisAntwort>(`/user/queue/partie/${partieId}`, (e) => {
      this.verarbeitePartieEreignis(e);
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
      if (this._darfPartieStandAktualisieren(ereignis.partieStand, ereignis.partieStand.version, ereignis.ereignisTyp)) {
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

  private verarbeitePartieEreignis(ereignis: PartieEreignisAntwort): void {
    Logger.websocket(`Empfange PartieEreignis: ${ereignis.ereignisTyp}`, ereignis);
    this._eventQueue.push(ereignis);
    void this._verarbeiteEventQueue();
  }

  private async _verarbeiteEventQueue(): Promise<void> {
    if (this._verarbeiteEventLaeuft) return;
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
        
        // Erneut checken, ob in der Zwischenzeit pausiert wurde
        if (this._queuePausiert) break;
        
        const ereignis = this._eventQueue.shift()!;
        const istSnapshot = ereignis.ereignisTyp === 'SNAPSHOT';

        // Bei Versionsluecke (verlorene WebSocket-Nachricht) sofort Snapshot anfordern.
        // Pruefung MUSS vor _darfPartieStandAktualisieren() erfolgen, da diese Methode
        // _letztePartieVersion als Seiteneffekt setzt und die Luecke dadurch unsichtbar wuerde.
        // reconnecteTisch() leert die Queue und setzt State zurueck; das lueckenhafte Event
        // wird verworfen — der Snapshot liefert den korrekten Stand nach.
        if (!istSnapshot && this._letztePartieVersion >= 0 && ereignis.version > this._letztePartieVersion + 1) {
          Logger.error(`Sequenz-Luecke erkannt! Erwartet ${this._letztePartieVersion + 1}, erhalten ${ereignis.version}`);
          const tischId = this.zustand.aktuellerTisch?.id;
          if (tischId) this.reconnecteTisch(tischId);
          return;
        }

        if (!this._darfPartieStandAktualisieren(ereignis.partieStand, ereignis.version)) {
          Logger.websocket('Ignoriere veraltetes PartieEreignis', {
            typ: ereignis.ereignisTyp,
            version: ereignis.version,
            letzte: this._letztePartieVersion
          });
          continue;
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

        // Event-Listener ZUERST aufrufen, bevor der State gepatcht wird.
        // Listener koennen dabei Animationen einreihen (reiheEin → _animationLaeuft = true),
        // sodass der anschliessende State-Patch keinen vorzeitigen Render ausloest.
        // Neuer Contract: Listener duerfen sich NICHT auf appStore.snapshot() verlassen,
        // sondern muessen ereignis.partieStand direkt verwenden (falls benoetigt).
        // Exception-Handling: Listener-Fehler duerfen den State-Patch nicht verhindern.
        try {
          this._eventListener.forEach((l) => l(ereignis));
        } catch (e) {
          Logger.error('Event-Listener hat einen Fehler geworfen', e);
        }

        // State NACH den Listenern patchen
        // AUSNAHME: Bei KARTE_GESPIELT und STICH_ABGESCHLOSSEN regelt der case-Block das Patching selbst (hint-then-patch).
        if (ereignis.partieStand && ereignis.ereignisTyp !== 'KARTE_GESPIELT' && ereignis.ereignisTyp !== 'STICH_ABGESCHLOSSEN') {
          // Spezieller Fix für SPIEL_BEENDET gefolgt von SPIEL_GESTARTET (Rundenauswertung wird sofort geschlossen).
          // Wir warten kurz, ob noch Animationen eingereiht wurden, bevor wir den State überschreiben.
          // In Zukunft sollte der AppStore eine Referenz auf den AnimationenService bekommen, um auf dessen
          // Queue zu warten.
          this.patch({ partieStand: ereignis.partieStand });
        }
        switch (ereignis.ereignisTyp) {
          case 'SNAPSHOT':
            this._eventQueue.length = 0;
            break;
          case 'KARTE_GESPIELT': {
            const prevStand = this.zustand.partieStand;
            
            // Nutze syntheticStand fuer ALLE Karten. 
            // Wichtig bei der 4. Karte: Das Backend liefert bereits eine leere 'aktuelleStichmitte'.
            // Durch den Synthesizer zwingen wir die 4. Karte in die Mitte, 
            // damit sie beim "Stich einziehen" Delay sichtbar bleibt.
            if (prevStand) {
              const syntheticStand = this._synthetischerKarteGespielt(prevStand, ereignis);
              this.patch({ partieStand: syntheticStand });
            } else {
              this.patch({ partieStand: ereignis.partieStand });
            }
            break;
          }
          case 'STICH_ABGESCHLOSSEN': {
             this.patch({ partieStand: ereignis.partieStand });
             if (ereignis.neueSonderpunkte.length) this._sonderpunkteListener.forEach((l) => l(ereignis.neueSonderpunkte));
             break;
          }
          case 'SPIEL_BEENDET':
             // Patching bereits oben vor dem try-catch Block passiert - STOPP, 
             // Das Patching ist auskommentiert (`// Patching bereits oben erledigt`), aber 
             // in Wahrheit patcht der generische Block `ereignis.ereignisTyp !== 'KARTE_GESPIELT'` alles!
             break;
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
    const kartenInMitte = [...prevStand.laufendesSpiel.aktuelleStichmitte];
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
      this._letztePartieVersion = neueVersion;
      return true;
    }

    // Wir erlauben >=, weil mehrere Ereignisse (z.B. KarteGespielt und StichAbgeschlossen)
    // in derselben Backend-Transaktion entstehen koennen und daher dieselbe Version haben.
    if (neueVersion >= this._letztePartieVersion) {
      this._letztePartieVersion = neueVersion;
      return true;
    }

    return false;
  }

  private setzeTischAbosZurueck(): void {
    this.tischAbos.splice(0).forEach((a) => a());
    this.aktuellePartieAbo = null;
    this._letztePartieVersion = -1;
    this._aktuelleSequenzId++; // Invalidiert laufende KI-Animationen
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
