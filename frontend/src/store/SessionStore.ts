import type { SpielverwaltungApi } from '../services/SpielverwaltungApi';
import type { EchtzeitPort } from '../services/SpielverwaltungEchtzeit';
import type { SpielverwaltungWebSocketFehlerAntwort, TischlisteEreignisAntwort, Uuid } from '../modelle/SpielverwaltungDto';
import { formatiereMeldung } from './StoreTypen';
import type { AppZustand } from './StoreTypen';
import type { SpielerProfilAntwortGenerated } from '../generated/schema-types';

/**
 * Verwaltet Spieler-Authentifizierung, Session-Initialisierung und gemeinsame WebSocket-Abonnements.
 */
export class SessionStore {
  private readonly gemeinsameAbos: Array<() => void> = [];

  constructor(
    private readonly api: SpielverwaltungApi,
    private readonly echtzeit: EchtzeitPort,
    private readonly patchFn: (aenderungen: Partial<AppZustand>) => void,
    private readonly gibZustand: () => AppZustand,
    private readonly resetZustand: () => void
  ) {}

  async initialisieren(): Promise<void> {
    if (this.gibZustand().initialisiert) return;
    await this.fuehreMitStatus(async () => {
      this.patchFn({ verbindung: 'verbinde' });
      try {
        const spieler = await this.api.initialisiereSpielerSession();
        await this.echtzeit.verbinde();
        this.registriereGemeinsameAbos();
        const tische = await this.api.listeTische();
        this.patchFn({ spieler, tische, initialisiert: true, verbindung: 'verbunden', meldung: null, bereich: 'SPIELVERWALTUNG' });
        this.echtzeit.senden('/app/tische/snapshot');
      } catch {
        this.patchFn({ verbindung: 'offline' });
        throw new Error('Initialisierung fehlgeschlagen.');
      }
    });
  }

  async registrieren(benutzername: string, passwort: string, email?: string): Promise<void> {
    await this.fuehreMitStatus(async () => {
      await this.api.registrieren(benutzername, passwort, email);
      this.patchFn({ authentifiziert: true, bereich: 'SPIELVERWALTUNG' });
      await this.initialisieren();
    });
  }

  async einloggen(benutzername: string, passwort: string): Promise<void> {
    await this.fuehreMitStatus(async () => {
      await this.api.einloggen(benutzername, passwort);
      this.patchFn({ authentifiziert: true, bereich: 'SPIELVERWALTUNG' });
      await this.initialisieren();
    });
  }

  async ausloggen(): Promise<void> {
    await this.api.ausloggen().catch(() => undefined);
    this.echtzeit.trennen();
    this.resetZustand();
  }

  async alsGastStarten(): Promise<void> {
    this.patchFn({ authentifiziert: true, bereich: 'SPIELVERWALTUNG' });
    await this.initialisieren();
  }

  async ladeSpielerProfil(spielerId: Uuid): Promise<SpielerProfilAntwortGenerated> {
    return this.api.ladeSpielerProfil(spielerId);
  }

  trenneGemeinsameAbos(): void {
    this.gemeinsameAbos.splice(0).forEach((abmelden) => abmelden());
  }

  private registriereGemeinsameAbos(): void {
    if (this.gemeinsameAbos.length > 0) return;
    this.gemeinsameAbos.push(
      this.echtzeit.abonnieren<TischlisteEreignisAntwort>('/topic/tische', (e) => this.patchFn({ tische: e.tische })),
      this.echtzeit.abonnieren<TischlisteEreignisAntwort>('/user/queue/tische', (e) => this.patchFn({ tische: e.tische })),
      this.echtzeit.abonnieren<SpielverwaltungWebSocketFehlerAntwort>('/user/queue/fehler', (f) => this.patchFn({ meldung: { typ: 'fehler', text: f.nachricht, fehlerCode: f.fehlerCode }, wirdGeladen: false }))
    );
  }

  private async fuehreMitStatus<T>(aktion: () => Promise<T>): Promise<T> {
    this.patchFn({ wirdGeladen: true });
    try {
      return await aktion();
    } catch (fehler) {
      this.patchFn({ meldung: formatiereMeldung(fehler) });
      throw fehler;
    } finally {
      this.patchFn({ wirdGeladen: false });
    }
  }
}
