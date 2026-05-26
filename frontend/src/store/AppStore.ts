import type {
  Ansage,
  KiSchwierigkeit,
  PartieEreignisBatch,
  TischKonfigurationDto,
  TischPresetAntwort,
  Tischhintergrund,
  Uuid,
  VorbehaltAnsage
} from '../modelle/SpielverwaltungDto';
import type { SpielverwaltungApi } from '../services/SpielverwaltungApi';
import { SpielverwaltungFehler } from '../services/SpielverwaltungApi';
import type { EchtzeitPort } from '../services/SpielverwaltungEchtzeit';
import { Logger } from '../logger';
import { SessionStore } from './SessionStore';
import { TischStore } from './TischStore';
import { PartieStore } from './PartieStore';
import { erzeugeAnfangszustand } from './StoreTypen';
import type { AppZustand, PartieEreignisListener, SonderpunkteListener, StoreAbo, UiMeldung } from './StoreTypen';
import type { SpielerProfilAntwortGenerated } from '../generated/schema-types';

export type { UiMeldung, UiKonfiguration, SpielprotokollEintrag, AppZustand, PartieEreignisListener, SonderpunkteListener, StoreAbo } from './StoreTypen';

/**
 * Zentraler Zustandsspeicher der Anwendung.
 * Verwaltet den App-Zustand und delegiert an fokussierte Sub-Module.
 */
export class AppStore {
  private zustand: AppZustand = erzeugeAnfangszustand();
  private readonly listener = new Set<StoreAbo>();

  private readonly session: SessionStore;
  private readonly tisch: TischStore;
  private readonly partie: PartieStore;

  constructor(api: SpielverwaltungApi, private readonly echtzeit: EchtzeitPort) {
    const patchFn = (a: Partial<AppZustand>) => this.patch(a);
    const gibZustand = () => this.zustand;
    const resetZustand = () => { this.zustand = erzeugeAnfangszustand(); this.veroeffentliche(); };

    this.partie = new PartieStore(echtzeit, patchFn, gibZustand);
    this.tisch = new TischStore(
      api, echtzeit, patchFn, gibZustand,
      (partieId) => this.partie.registrierePartieAbos(partieId),
      () => this.partie.resetPartieZustand()
    );
    this.partie.setzeReconnectCallback((tischId) => this.tisch.reconnecteTisch(tischId));
    this.session = new SessionStore(api, echtzeit, patchFn, gibZustand, resetZustand);
  }

  // --- Zustand ---
  abonniere(listener: StoreAbo): () => void { this.listener.add(listener); listener(this.snapshot()); return () => this.listener.delete(listener); }
  snapshot(): AppZustand { return structuredClone(this.zustand); }

  // --- Queue / Ereignisse ---
  pausiereQueue(): void { this.partie.pausiereQueue(); }
  setzeQueueFort(): void { this.partie.setzeQueueFort(); }
  isIdle(): boolean { return this.partie.isIdle(); }
  abonniereEvents(listener: PartieEreignisListener): () => void { return this.partie.abonniereEvents(listener); }
  abonniereSonderpunkte(listener: SonderpunkteListener): () => void { return this.partie.abonniereSonderpunkte(listener); }

  // --- Session ---
  async initialisieren(): Promise<void> { return this.session.initialisieren(); }
  async registrieren(benutzername: string, passwort: string, email?: string): Promise<void> { return this.session.registrieren(benutzername, passwort, email); }
  async einloggen(benutzername: string, passwort: string): Promise<void> { return this.session.einloggen(benutzername, passwort); }
  async ausloggen(): Promise<void> { return this.session.ausloggen(); }
  async alsGastStarten(): Promise<void> { return this.session.alsGastStarten(); }
  async ladeSpielerProfil(spielerId: Uuid): Promise<SpielerProfilAntwortGenerated> { return this.session.ladeSpielerProfil(spielerId); }

  // --- Tisch ---
  async aktualisiereTischliste(): Promise<void> { return this.tisch.aktualisiereTischliste(); }
  async erstelleQuickGame(): Promise<void> { return this.tisch.erstelleQuickGame(); }
  async erstelleKonfiguriertenTisch(name: string, konfiguration: Partial<TischKonfigurationDto>, privat?: boolean): Promise<void> { return this.tisch.erstelleKonfiguriertenTisch(name, konfiguration, privat); }
  async ladePresets(): Promise<TischPresetAntwort[]> { return this.tisch.ladePresets(); }
  async erstelleTischMitPreset(name: string, presetName: string, privat?: boolean): Promise<void> { return this.tisch.erstelleTischMitPreset(name, presetName, privat); }
  async erstelleTisch(name: string): Promise<void> { return this.tisch.erstelleTisch(name); }
  async betreteTisch(tischId: Uuid): Promise<void> { return this.tisch.betreteTisch(tischId); }
  async betreteTischViaCode(einladungsCode: string): Promise<void> { return this.tisch.betreteTischViaCode(einladungsCode); }
  reconnecteTisch(tischId: Uuid): void { this.tisch.reconnecteTisch(tischId); }
  async kickeSpieler(spielerId: Uuid): Promise<void> { return this.tisch.kickeSpieler(spielerId); }
  async ladeTischName(tischId: Uuid): Promise<string> { return this.tisch.ladeTischName(tischId); }
  async verlasseAktuellenTisch(): Promise<void> { return this.tisch.verlasseAktuellenTisch(); }
  async starteAktuellenTisch(): Promise<void> { return this.tisch.starteAktuellenTisch(); }
  async starteNeuePartie(): Promise<void> { return this.tisch.starteNeuePartie(); }
  async aktualisiereAktuellenTischhintergrund(tischhintergrund: Tischhintergrund): Promise<void> { return this.tisch.aktualisiereAktuellenTischhintergrund(tischhintergrund); }
  async aktualisiereAktuelleKiSchwierigkeit(kiSchwierigkeit: KiSchwierigkeit): Promise<void> { return this.tisch.aktualisiereAktuelleKiSchwierigkeit(kiSchwierigkeit); }

  // --- Spielaktionen ---
  spieleKarte(karteId: string): void { const t = this.zustand.aktuellerTisch?.id; if (t) this.tisch.sendeSpielaktion(`/app/tisch/${t}/karte`, { karteId }); }
  sageAnsageAn(ansage: Ansage): void { const t = this.zustand.aktuellerTisch?.id; if (t) this.tisch.sendeSpielaktion(`/app/tisch/${t}/ansage`, { ansage }); }
  meldeVorbehalt(vorbehalt: VorbehaltAnsage): void { const t = this.zustand.aktuellerTisch?.id; if (t) this.tisch.sendeSpielaktion(`/app/tisch/${t}/vorbehalt`, { vorbehalt }); }
  beantworteArmut(angenommen: boolean, kartenIds: string[]): void { const t = this.zustand.aktuellerTisch?.id; if (t) this.tisch.sendeSpielaktion(`/app/tisch/${t}/armut-antwort`, { angenommen, kartenIds }); }

  // --- Sonstiges ---
  quittiereMeldung(): void { this.patch({ meldung: null }); }
  setzeKiKartenVerzögerung(ms: number): void { this.patch({ uiKonfiguration: { ...this.zustand.uiKonfiguration, kiVerzoegerungMs: ms } }); }
  toggleDebugModus(): void {
    const debugModus = !this.zustand.debugModus;
    this.patch({ debugModus });
    const partieId = this.zustand.aktuellerTisch?.partieId ?? this.zustand.partieStand?.partieId ?? null;
    if (partieId) this.echtzeit.senden(debugModus ? `/app/partie/${partieId}/debug-snapshot` : `/app/partie/${partieId}/snapshot`);
  }
  trennen(): void {
    this.tisch.setzeTischAbosZurueck();
    this.session.trenneGemeinsameAbos();
    this.echtzeit.trennen();
    this.zustand = erzeugeAnfangszustand();
    this.veroeffentliche();
  }

  // --- Weiterleitung für Test-Zugriff auf interne Felder ---
  get _letztePartieVersion(): number { return this.partie._letztePartieVersion; }
  set _letztePartieVersion(v: number) { this.partie._letztePartieVersion = v; }
  get _eventQueue() { return this.partie._eventQueue; }
  /** @internal Nur für Tests — interne Weiterleitung an PartieStore. */
  verarbeitePartieBatch(batch: PartieEreignisBatch): void { this.partie.verarbeitePartieBatch(batch); }

  // --- Private Kern ---
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
  /** @internal Nur für Tests — interne Hilfsmethode. */
  formatiereMeldung(fehler: unknown): UiMeldung {
    if (fehler instanceof SpielverwaltungFehler) return { typ: 'fehler', text: fehler.message, fehlerCode: fehler.fehlerCode };
    return { typ: 'fehler', text: 'Unbekannter Fehler.' };
  }
}
