import type {
  Ansage,
  KiSchwierigkeit,
  GespielteKarteEreignisAntwort,
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
    meldung: null
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
  private _kiSequenzQueue: Array<() => Promise<void>> = [];
  private readonly _sonderpunkteListener = new Set<(sonderpunkte: SonderpunktEreignisAntwortDto[]) => void>();
  private readonly _eventListener = new Set<(ereignis: PartieEreignisAntwort) => void>();
  private _eventQueue: PartieEreignisAntwort[] = [];
  private _verarbeiteEventLaeuft = false;
  private _kiKartenVerzögerungMs = 800;
  private _aktuelleSequenzId = 0;

  /**
   * Gibt zurück, ob sich der Store im Leerlauf befindet.
   * Dies ist der Fall, wenn keine Events in der Queue sind und keine Event-Verarbeitung läuft.
   */
  isIdle(): boolean {
    return this._eventQueue.length === 0 && !this._verarbeiteEventLaeuft;
  }

  /**
   * Setzt die Verzögerung für KI-Kartenanimationen.
   * @param ms Dauer in Millisekunden.
   */
  setzeKiKartenVerzögerung(ms: number): void {
    this._kiKartenVerzögerungMs = ms;
  }

  /**
   * Abonniert Partie-Ereignisse.
   * @param listener Callback-Funktion, die bei Eintreffen eines Ereignisses aufgerufen wird.
   * @returns Eine Funktion zur Abmeldung des Listeners.
   */
  abonniereEvents(listener: (ereignis: PartieEreignisAntwort) => void): () => void {
    this._eventListener.add(listener);
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
      this.echtzeit.abonnieren<SpielverwaltungWebSocketFehlerAntwort>('/user/queue/fehler', (f) => this.patch({ meldung: { typ: 'fehler', text: f.nachricht, fehlerCode: f.fehlerCode } }))
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
    this.aktuellePartieAbo = partieId;
    this.tischAbos.push(this.echtzeit.abonnieren<PartieEreignisAntwort>(`/user/queue/partie/${partieId}`, (e) => this.verarbeitePartieEreignis(e)));
    this.echtzeit.senden(`/app/partie/${partieId}/snapshot`);
  }

  private verarbeiteTischEreignis(ereignis: TischEreignisAntwort): void {
    Logger.websocket(`Empfange TischEreignis: ${ereignis.ereignisTyp}`, ereignis);
    if (ereignis.ereignisTyp === 'PARTIE_ABGEBROCHEN') {
      this.setzeTischAbosZurueck();
      this.patch({ aktuellerTisch: null, partieStand: null, bereich: 'SPIELVERWALTUNG', meldung: { typ: 'info', text: 'Partie abgebrochen.', fehlerCode: 'PARTIE_ABGEBROCHEN' } });
      return;
    }
    if (ereignis.ereignisTyp === 'TISCH_ENTFERNT' || !ereignis.tisch) {
      this.setzeTischAbosZurueck();
      this.patch({ aktuellerTisch: null, partieStand: null, bereich: 'SPIELVERWALTUNG' });
      return;
    }

    let partiestand = this.zustand.partieStand;
    if (ereignis.partieStand) {
      const istSnapshot = ereignis.ereignisTyp === 'TISCH_SNAPSHOT' || ereignis.ereignisTyp === 'SPIEL_GESTARTET';
      if (this._darfPartieStandAktualisieren(ereignis.partieStand, ereignis.partieStand.version, istSnapshot)) {
        partiestand = ereignis.partieStand;
      } else {
        Logger.websocket('Ignoriere veralteten PartieStand aus TischEreignis', {
          neu: ereignis.partieStand.version,
          letzte: this._letztePartieVersion
        });
      }
    }

    this.patch({ aktuellerTisch: ereignis.tisch, partieStand: partiestand, bereich: 'TISCH' });
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
      while (this._eventQueue.length > 0) {
        const ereignis = this._eventQueue.shift()!;
        const istSnapshot = ereignis.ereignisTyp === 'SNAPSHOT';

        if (!this._darfPartieStandAktualisieren(ereignis.partieStand, ereignis.version, istSnapshot)) {
          Logger.websocket('Ignoriere veraltetes PartieEreignis', {
            typ: ereignis.ereignisTyp,
            version: ereignis.version,
            letzte: this._letztePartieVersion
          });
          continue;
        }

        // Falls wir eine Luecke in der Sequenz feststellen, koennten wir hier einen HTTP-Reload triggern.
        // Aktuell verlassen wir uns darauf, dass WebSockets in-order liefern.
        if (!istSnapshot && ereignis.version > this._letztePartieVersion + 1) {
          Logger.warn(`Sequenz-Luecke erkannt! Erwartet ${this._letztePartieVersion + 1}, erhalten ${ereignis.version}`);
          // TODO: this.reconnecteTisch(this.zustand.aktuellerTisch!.id);
        }

        this._aktuelleSequenzId++; // Neue Sequenz fuer jedes Event (Animation-Guard)
        const sequenzIdBeiStart = this._aktuelleSequenzId;

        // Zustand patchen VOR dem Benachrichtigen der Listener (Locodoko Unified Architecture)
        // AUSNAHME: Bei KI-Sequenzen regelt _expandiereKiSequenz das Patching am Ende selbst.
        if (ereignis.partieStand && ereignis.ereignisTyp !== 'KI_ZUG_SEQUENZ') {
          this.patch({ partieStand: ereignis.partieStand });
        }

        this._eventListener.forEach((l) => l(ereignis));
        switch (ereignis.ereignisTyp) {
          case 'SNAPSHOT':
            this._eventQueue.length = 0;
            this.leereKiSequenzQueue();
            break;
          case 'KARTE_GESPIELT':
          case 'SPIEL_BEENDET':
          case 'ANSAGE_ERFOLGT':
          case 'SCHWEINCHEN_GEMELDET':
          case 'SPIEL_GESTARTET':
            // Patching bereits oben erledigt
            break;
          case 'KI_ZUG_SEQUENZ':
            await this._expandiereKiSequenz(ereignis.kiKartenSequenz, ereignis.partieStand, sequenzIdBeiStart);
            break;
          case 'STICH_ABGESCHLOSSEN':
            if (ereignis.neueSonderpunkte.length) this._sonderpunkteListener.forEach((l) => l(ereignis.neueSonderpunkte));
            break;
        }
      }
    } finally {
      this._verarbeiteEventLaeuft = false;
    }
  }

  private async _expandiereKiSequenz(sequenz: GespielteKarteEreignisAntwort[], finalStand: PartieStandAntwort, sequenzId: number): Promise<void> {
    const prevStand = this.zustand.partieStand;
    for (const [i] of sequenz.entries()) {
      // Wenn in der Zwischenzeit ein SNAPSHOT kam, abbrechen
      if (this._aktuelleSequenzId !== sequenzId) return;

      const stand = prevStand !== null
        ? this._synthetischerZwischenstand(prevStand, sequenz.slice(0, i + 1))
        : finalStand;
      this.patch({ partieStand: stand });
      if (this._kiKartenVerzögerungMs > 0) {
        await new Promise<void>((r) => setTimeout(r, this._kiKartenVerzögerungMs));
      }
    }
    // Finalen Stand nach allen Delays anwenden.
    // Guard: Nur patchen, wenn keine neueren Events die Sequenz unterbrochen haben.
    if (this._aktuelleSequenzId === sequenzId) {
      this.patch({ partieStand: finalStand });
    }
  }

  private _synthetischerZwischenstand(basis: PartieStandAntwort, gespielteKarten: GespielteKarteEreignisAntwort[]): PartieStandAntwort {
    if (!basis.laufendesSpiel) return basis;
    const kartenInMitte = [...basis.laufendesSpiel.aktuelleStichmitte];
    const maxReihenfolge = kartenInMitte.reduce((max, k) => Math.max(max, k.reihenfolge ?? 0), 0);
    gespielteKarten.forEach((k, i) => {
      if (!kartenInMitte.some((bestehend) => bestehend.spielerPosition === k.spielerPosition)) {
        const [farbe, wert, idx] = k.karteId.split('-');
        kartenInMitte.push({
          spielerPosition: k.spielerPosition,
          karte: { id: k.karteId, farbe: farbe ?? '', wert: wert ?? '', exemplarIndex: parseInt(idx ?? '0', 10) },
          reihenfolge: maxReihenfolge + i + 1,
        });
      }
    });
    return { ...basis, laufendesSpiel: { ...basis.laufendesSpiel, aktuelleStichmitte: kartenInMitte } };
  }

  private leereKiSequenzQueue(): void { this._kiSequenzQueue.length = 0; }

  private _darfPartieStandAktualisieren(neuerStand: PartieStandAntwort, neueVersion: number, istSnapshot = false): boolean {
    const aktuellePartieId = this.zustand.partieStand?.partieId;

    // Wenn neue Partie: immer akzeptieren
    if (neuerStand.partieId !== aktuellePartieId) {
      this._letztePartieVersion = neueVersion;
      return true;
    }

    // Wir erlauben >= hier, da der Server fuer denselben Zustandsuebergang
    // (gleiche Version) mehrere Ereignis-Typen schicken kann (z.B. KI-Sequenz + Phase-Change).
    // Inkrementelle Updates (Events) nur wenn Version neuer oder gleich ist.
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
    this._aktuelleSequenzId++; // Invaldiert laufende KI-Sequenzen
    this.leereKiSequenzQueue(); 
    this._eventQueue.length = 0; 
    this._verarbeiteEventLaeuft = false; 
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
