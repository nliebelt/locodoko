import type {
  KiSchwierigkeit,
  PartieStandAntwort,
  TischAntwort,
  TischEreignisAntwort,
  TischKonfigurationDto,
  TischPresetAntwort,
  Tischhintergrund,
  Uuid
} from '../modelle/SpielverwaltungDto';
import type { SpielverwaltungApi } from '../services/SpielverwaltungApi';
import { SpielverwaltungFehler } from '../services/SpielverwaltungApi';
import type { EchtzeitPort } from '../services/SpielverwaltungEchtzeit';
import { Logger } from '../logger';
import type { AppZustand, UiMeldung } from './StoreTypen';

/**
 * Verwaltet Tisch-CRUD, Tisch-WebSocket-Abonnements und Tisch-Ereignisverarbeitung.
 */
export class TischStore {
  private tischAbos: Array<() => void> = [];
  private aktuellePartieAbo: Uuid | null = null;

  constructor(
    private readonly api: SpielverwaltungApi,
    private readonly echtzeit: EchtzeitPort,
    private readonly patchFn: (aenderungen: Partial<AppZustand>) => void,
    private readonly gibZustand: () => AppZustand,
    private readonly onNeuePartie: (partieId: Uuid) => (() => void),
    private readonly onPartieReset: () => void
  ) {}

  async aktualisiereTischliste(): Promise<void> {
    await this.fuehreMitStatus(async () => {
      const tische = await this.api.listeTische();
      this.patchFn({ tische });
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
      this.patchFn({ meldung: { typ: 'fehler', text: 'Tischname leer.', fehlerCode: 'ANFRAGE_UNGUELTIG' } });
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

  async ladePresets(): Promise<TischPresetAntwort[]> {
    return this.api.gibPresets();
  }

  async erstelleTischMitPreset(name: string, presetName: string, privat?: boolean, anzahlSpiele?: number): Promise<void> {
    const tischName = name.trim();
    if (!tischName) {
      this.patchFn({ meldung: { typ: 'fehler', text: 'Tischname leer.', fehlerCode: 'ANFRAGE_UNGUELTIG' } });
      return;
    }
    await this.fuehreMitStatus(async () => {
      const tisch = await this.api.erstelleTisch(tischName, undefined, privat, presetName, anzahlSpiele);
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
    // Spiel-State vor Snapshot-Verarbeitung zurücksetzen (verbindungsabbruch.md:70)
    this.patchFn({ aktuellerTisch: null, partieStand: null });
    this.setzeTischAbosZurueck();
    this.registriereTischAbos(tischId, null);
    this.patchFn({ bereich: 'TISCH' });
    this.echtzeit.senden(`/app/tisch/${tischId}/snapshot`);
  }

  async kickeSpieler(spielerId: Uuid): Promise<void> {
    const tischId = this.gibZustand().aktuellerTisch?.id;
    if (!tischId) return;
    await this.fuehreMitStatus(async () => { await this.api.kickeSpieler(tischId, spielerId); });
  }

  async ladeTischName(tischId: Uuid): Promise<string> {
    return (await this.api.ladeTisch(tischId)).name;
  }

  async verlasseAktuellenTisch(): Promise<void> {
    const tisch = this.gibZustand().aktuellerTisch;
    if (!tisch) return;
    await this.fuehreMitStatus(async () => {
      await this.api.verlasseTisch(tisch.id);
      this.setzeTischAbosZurueck();
      this.patchFn({ aktuellerTisch: null, partieStand: null, bereich: 'SPIELVERWALTUNG' });
    });
    void this.aktualisiereTischliste();
  }

  async starteAktuellenTisch(): Promise<void> {
    const tisch = this.gibZustand().aktuellerTisch;
    if (!tisch) return;
    await this.fuehreMitStatus(async () => { await this.api.starteTisch(tisch.id); });
  }

  async starteNeuePartie(): Promise<void> {
    const tisch = this.gibZustand().aktuellerTisch;
    if (!tisch) return;
    await this.fuehreMitStatus(async () => { await this.api.starteNeuePartie(tisch.id); });
  }

  async aktualisiereAktuellenTischhintergrund(tischhintergrund: Tischhintergrund): Promise<void> {
    const tisch = this.gibZustand().aktuellerTisch;
    if (!tisch) return;
    if (tisch.konfiguration.tischhintergrund === tischhintergrund) return;
    await this.fuehreMitStatus(async () => {
      const konfiguration = await this.api.aktualisiereTischKonfiguration(tisch.id, { ...tisch.konfiguration, tischhintergrund });
      this.patchFn({ aktuellerTisch: { ...tisch, konfiguration }, meldung: null });
    });
  }

  async aktualisiereAktuelleKiSchwierigkeit(kiSchwierigkeit: KiSchwierigkeit): Promise<void> {
    const tisch = this.gibZustand().aktuellerTisch;
    if (!tisch) return;
    if (tisch.konfiguration.kiSchwierigkeit === kiSchwierigkeit) return;
    await this.fuehreMitStatus(async () => {
      const konfiguration = await this.api.aktualisiereTischKonfiguration(tisch.id, { ...tisch.konfiguration, kiSchwierigkeit });
      this.patchFn({ aktuellerTisch: { ...tisch, konfiguration }, meldung: null });
    });
  }

  setzeTischAbosZurueck(): void {
    this.tischAbos.splice(0).forEach((a) => a());
    this.aktuellePartieAbo = null;
    this.onPartieReset();
  }

  private oeffneTisch(tisch: TischAntwort): void {
    this.patchFn({ aktuellerTisch: tisch, partieStand: null, bereich: 'TISCH', meldung: null });
    this.registriereTischAbos(tisch.id, tisch.partieId);
  }

  private registriereTischAbos(tischId: Uuid, partieId: Uuid | null): void {
    this.setzeTischAbosZurueck();
    this.aktuellePartieAbo = partieId;
    this.tischAbos.push(
      this.echtzeit.abonnieren<TischEreignisAntwort>(`/topic/tisch/${tischId}`, (e) => this.verarbeiteTischEreignis(e)),
      this.echtzeit.abonnieren<TischEreignisAntwort>(`/user/queue/tisch/${tischId}`, (e) => this.verarbeiteTischEreignis(e))
    );
    if (partieId) this.registriereInternePartieAbos(partieId);
    this.echtzeit.senden(`/app/tisch/${tischId}/snapshot`);
  }

  private registriereInternePartieAbos(partieId: Uuid): void {
    // aktuellePartieAbo MUSS hier gesetzt werden, damit verarbeiteTischEreignis
    // bei nachfolgenden TischEreignissen mit derselben partieId NICHT erneut
    // registriereInternePartieAbos aufruft und doppelte Subscriptions erzeugt.
    this.aktuellePartieAbo = partieId;
    const unsubscribe = this.onNeuePartie(partieId);
    this.tischAbos.push(unsubscribe);
  }

  private verarbeiteTischEreignis(ereignis: TischEreignisAntwort): void {
    Logger.websocket(`Empfange TischEreignis: ${ereignis.ereignisTyp}`, ereignis);
    if (ereignis.ereignisTyp === 'COUNTDOWN_TICK') {
      this.patchFn({ countdownSekunden: ereignis.verbleibendeSekunden ?? null });
      return;
    }
    if (ereignis.ereignisTyp === 'PARTIE_ABGEBROCHEN') {
      this.setzeTischAbosZurueck();
      this.patchFn({ aktuellerTisch: null, partieStand: null, bereich: 'SPIELVERWALTUNG', meldung: { typ: 'info', text: 'Partie abgebrochen.', fehlerCode: 'PARTIE_ABGEBROCHEN' }, countdownSekunden: null });
      return;
    }
    if (ereignis.ereignisTyp === 'TISCH_ENTFERNT' || !ereignis.tisch) {
      this.setzeTischAbosZurueck();
      this.patchFn({ aktuellerTisch: null, partieStand: null, bereich: 'SPIELVERWALTUNG', countdownSekunden: null });
      return;
    }

    let partiestand: PartieStandAntwort | null = this.gibZustand().partieStand;
    if (ereignis.partieStand) {
      const aktuelleVersion = partiestand?.version ?? -1;
      const istNeuePartie = ereignis.partieStand.partieId !== partiestand?.partieId;
      if (istNeuePartie || ereignis.partieStand.version >= aktuelleVersion) {
        partiestand = ereignis.partieStand;
      } else {
        Logger.websocket('Ignoriere veralteten PartieStand aus TischEreignis', {
          neu: ereignis.partieStand.version,
          letzte: aktuelleVersion
        });
      }
    }

    this.patchFn({
      aktuellerTisch: ereignis.tisch,
      partieStand: partiestand,
      bereich: 'TISCH',
      wirdGeladen: false,
      countdownSekunden: ereignis.ereignisTyp === 'SPIEL_GESTARTET' ? null : this.gibZustand().countdownSekunden
    });
    if (ereignis.tisch.partieId && ereignis.tisch.partieId !== this.aktuellePartieAbo) {
      this.registriereInternePartieAbos(ereignis.tisch.partieId);
    }
  }

  private async fuehreMitStatus<T>(aktion: () => Promise<T>): Promise<T> {
    this.patchFn({ wirdGeladen: true });
    try { return await aktion(); } finally { this.patchFn({ wirdGeladen: false }); }
  }

  private formatiereMeldung(fehler: unknown): UiMeldung {
    if (fehler instanceof SpielverwaltungFehler) return { typ: 'fehler', text: fehler.message, fehlerCode: fehler.fehlerCode };
    return { typ: 'fehler', text: 'Unbekannter Fehler.' };
  }

  sendeSpielaktion(ziel: string, payload: unknown): void {
    try { this.patchFn({ meldung: null }); this.echtzeit.senden(ziel, payload); } catch (f) { this.patchFn({ meldung: this.formatiereMeldung(f) }); }
  }
}
