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

export class AppStore {
  private zustand: AppZustand = erzeugeAnfangszustand();
  private readonly listener = new Set<Listener>();
  private readonly gemeinsameAbos: Array<() => void> = [];
  private readonly tischAbos: Array<() => void> = [];
  private aktuellePartieAbo: Uuid | null = null;
  private _kiSequenzQueue: Array<() => Promise<void>> = [];
  private readonly _sonderpunkteListener = new Set<(sonderpunkte: SonderpunktEreignisAntwortDto[]) => void>();
  private readonly _eventListener = new Set<(ereignis: PartieEreignisAntwort) => void>();
  private _eventQueue: PartieEreignisAntwort[] = [];
  private _verarbeiteEventLaeuft = false;
  private _kiKartenVerzögerungMs = 800;

  setzeKiKartenVerzögerung(ms: number): void {
    this._kiKartenVerzögerungMs = ms;
  }

  abonniereEvents(listener: (ereignis: PartieEreignisAntwort) => void): () => void {
    this._eventListener.add(listener);
    return () => this._eventListener.delete(listener);
  }

  abonniereSonderpunkte(listener: (sonderpunkte: SonderpunktEreignisAntwortDto[]) => void): () => void {
    this._sonderpunkteListener.add(listener);
    return () => this._sonderpunkteListener.delete(listener);
  }

  constructor(private readonly api: SpielverwaltungApi, private readonly echtzeit: EchtzeitPort) {}

  abonnieren(listener: Listener): () => void {
    this.listener.add(listener);
    listener(this.snapshot());
    return () => this.listener.delete(listener);
  }

  snapshot(): AppZustand {
    return structuredClone(this.zustand);
  }

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

  async registrieren(benutzername: string, passwort: string, email?: string): Promise<void> {
    await this.fuehreMitStatus(async () => {
      await this.api.registrieren(benutzername, passwort, email);
      this.patch({ authentifiziert: true, bereich: 'SPIELVERWALTUNG' });
      await this.initialisieren();
    });
  }

  async einloggen(benutzername: string, passwort: string): Promise<void> {
    await this.fuehreMitStatus(async () => {
      await this.api.einloggen(benutzername, passwort);
      this.patch({ authentifiziert: true, bereich: 'SPIELVERWALTUNG' });
      await this.initialisieren();
    });
  }

  async ausloggen(): Promise<void> {
    await this.api.ausloggen().catch(() => undefined);
    this.echtzeit.trennen();
    this.zustand = erzeugeAnfangszustand();
    this.veroeffentliche();
  }

  async alsGastStarten(): Promise<void> {
    this.patch({ authentifiziert: true, bereich: 'SPIELVERWALTUNG' });
    await this.initialisieren();
  }

  async aktualisiereTischliste(): Promise<void> {
    await this.fuehreMitStatus(async () => {
      const tische = await this.api.listeTische();
      this.patch({ tische });
      this.echtzeit.senden('/app/tische/snapshot');
    });
  }

  async erstelleQuickGame(): Promise<void> {
    await this.fuehreMitStatus(async () => {
      const tisch = await this.api.schnellstart();
      this.oeffneTisch(tisch);
      this.echtzeit.senden(`/app/tisch/${tisch.id}/snapshot`);
    });
  }

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

  async erstelleTisch(name: string): Promise<void> {
    await this.erstelleKonfiguriertenTisch(name, {});
  }

  async betreteTisch(tischId: Uuid): Promise<void> {
    await this.fuehreMitStatus(async () => {
      const tisch = await this.api.betreteTisch(tischId);
      this.oeffneTisch(tisch);
    });
  }

  async betreteTischViaCode(einladungsCode: string): Promise<void> {
    await this.fuehreMitStatus(async () => {
      const tisch = await this.api.betreteTischViaCode(einladungsCode);
      this.oeffneTisch(tisch);
    });
  }

  reconnecteTisch(tischId: Uuid): void {
    this.setzeTischAbosZurueck();
    this.registriereTischAbos(tischId, null);
    this.patch({ bereich: 'TISCH' });
    this.echtzeit.senden(`/app/tisch/${tischId}/snapshot`);
  }

  async kickeSpieler(spielerId: Uuid): Promise<void> {
    const tischId = this.zustand.aktuellerTisch?.id;
    if (!tischId) return;
    await this.fuehreMitStatus(async () => { await this.api.kickeSpieler(tischId, spielerId); });
  }

  async ladeTischName(tischId: Uuid): Promise<string> {
    return (await this.api.ladeTisch(tischId)).name;
  }

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

  async starteAktuellenTisch(): Promise<void> {
    const tisch = this.zustand.aktuellerTisch;
    if (!tisch) return;
    await this.fuehreMitStatus(async () => { await this.api.starteTisch(tisch.id); });
  }

  async starteNeuePartie(): Promise<void> {
    const tisch = this.zustand.aktuellerTisch;
    if (!tisch) return;
    await this.fuehreMitStatus(async () => { await this.api.starteNeuePartie(tisch.id); });
  }

  async aktualisiereAktuellenTischhintergrund(tischhintergrund: Tischhintergrund): Promise<void> {
    const tisch = this.zustand.aktuellerTisch;
    if (!tisch) return;
    if (tisch.konfiguration.tischhintergrund === tischhintergrund) return;
    await this.fuehreMitStatus(async () => {
      const konfiguration = await this.api.aktualisiereTischKonfiguration(tisch.id, { ...tisch.konfiguration, tischhintergrund });
      this.patch({ aktuellerTisch: { ...tisch, konfiguration }, meldung: null });
    });
  }

  async aktualisiereAktuelleKiSchwierigkeit(kiSchwierigkeit: KiSchwierigkeit): Promise<void> {
    const tisch = this.zustand.aktuellerTisch;
    if (!tisch) return;
    if (tisch.konfiguration.kiSchwierigkeit === kiSchwierigkeit) return;
    await this.fuehreMitStatus(async () => {
      const konfiguration = await this.api.aktualisiereTischKonfiguration(tisch.id, { ...tisch.konfiguration, kiSchwierigkeit });
      this.patch({ aktuellerTisch: { ...tisch, konfiguration }, meldung: null });
    });
  }

  spieleKarte(karteId: string): void {
    const tischId = this.zustand.aktuellerTisch?.id;
    if (tischId) this.sendeSpielaktion(`/app/tisch/${tischId}/karte`, { karteId });
  }

  sageAnsageAn(ansage: Ansage): void {
    const tischId = this.zustand.aktuellerTisch?.id;
    if (tischId) this.sendeSpielaktion(`/app/tisch/${tischId}/ansage`, { ansage });
  }

  meldeVorbehalt(vorbehalt: VorbehaltAnsage): void {
    const tischId = this.zustand.aktuellerTisch?.id;
    if (tischId) this.sendeSpielaktion(`/app/tisch/${tischId}/vorbehalt`, { vorbehalt });
  }

  beantworteArmut(angenommen: boolean, kartenIds: string[]): void {
    const tischId = this.zustand.aktuellerTisch?.id;
    if (tischId) this.sendeSpielaktion(`/app/tisch/${tischId}/armut-antwort`, { angenommen, kartenIds });
  }

  quittiereMeldung(): void { this.patch({ meldung: null }); }

  toggleDebugModus(): void {
    const debugModus = !this.zustand.debugModus;
    this.patch({ debugModus });
    const partieId = this.zustand.aktuellerTisch?.partieId ?? this.zustand.partieStand?.partieId ?? null;
    if (partieId) this.echtzeit.senden(debugModus ? `/app/partie/${partieId}/debug-snapshot` : `/app/partie/${partieId}/snapshot`);
  }

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
    const partiestand = ereignis.partieStand ?? this.zustand.partieStand;
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
        this._eventListener.forEach((l) => l(ereignis));
        switch (ereignis.ereignisTyp) {
          case 'SNAPSHOT':
            this._eventQueue.length = 0;
            this.leereKiSequenzQueue();
            this.patch({ partieStand: ereignis.partieStand });
            break;
          case 'KARTE_GESPIELT':
          case 'SPIEL_BEENDET':
          case 'ANSAGE_ERFOLGT':
          case 'SCHWEINCHEN_GEMELDET':
          case 'SPIEL_GESTARTET':
            this.patch({ partieStand: ereignis.partieStand });
            break;
          case 'KI_ZUG_SEQUENZ':
            await this._expandiereKiSequenz(ereignis.kiKartenSequenz!, ereignis.partieStand);
            break;
          case 'STICH_ABGESCHLOSSEN':
            this.patch({ partieStand: ereignis.partieStand });
            if (ereignis.neueSonderpunkte?.length) this._sonderpunkteListener.forEach((l) => l(ereignis.neueSonderpunkte!));
            break;
        }
      }
    } finally {
      this._verarbeiteEventLaeuft = false;
    }
  }

  private async _expandiereKiSequenz(sequenz: GespielteKarteEreignisAntwort[], finalStand: PartieStandAntwort): Promise<void> {
    const prevStand = this.zustand.partieStand;
    for (const [i] of sequenz.entries()) {
      // Immer synthetischen Zwischenstand verwenden, damit die Karte erst sichtbar in die Mitte
      // fliegt bevor der finale Stand (mit ggf. eingesammeltem Stich) angewendet wird.
      // Ohne diese Synthese würde die letzte Stich-Karte nie animiert, da finalStand bereits
      // aktuelleStichmitte = [] enthält.
      const stand = prevStand !== null
        ? this._synthetischerZwischenstand(prevStand, sequenz.slice(0, i + 1))
        : finalStand;
      this.patch({ partieStand: stand });
      if (this._kiKartenVerzögerungMs > 0) {
        await new Promise<void>((r) => setTimeout(r, this._kiKartenVerzögerungMs));
      }
    }
    // Finalen Stand nach allen Delays anwenden (loest ggf. Stich-Einziehen-Animation aus).
    // Guard: reconnecteTisch setzt _verarbeiteEventLaeuft auf false — in dem Fall wurde
    // bereits ein neuer Snapshot empfangen und finalStand ist veraltet → nicht ueberschreiben.
    if (this._verarbeiteEventLaeuft) {
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
  private setzeTischAbosZurueck(): void { this.tischAbos.splice(0).forEach((a) => a()); this.aktuellePartieAbo = null; this.leereKiSequenzQueue(); this._eventQueue.length = 0; this._verarbeiteEventLaeuft = false; }
  private sendeSpielaktion(ziel: string, payload: unknown): void {
    try { this.patch({ meldung: null }); this.echtzeit.senden(ziel, payload); } catch (f) { this.patch({ meldung: this.formatiereMeldung(f) }); }
  }
  private patch(aenderungen: Partial<AppZustand>): void { this.zustand = { ...this.zustand, ...aenderungen }; this.veroeffentliche(); }
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
