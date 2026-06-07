import type {
  ApiFehlerAntwort,
  AuthentifizierungsAntwort,
  BestaetigungAntwort,
  SpielerSessionAntwort,
  TischKonfigurationDto,
  TischAntwort,
  TischListenEintragAntwort,
  TischPresetAntwort,
  Uuid
} from '../modelle/SpielverwaltungDto';
import type { BestenlisteAntwortGenerated, SpielerProfilAntwortGenerated } from '../generated/schema-types';
import { Logger } from '../logger';

const STANDARD_SPIELERNAME_PREFIX = 'Spieler';
const SPIELERNAME_SPEICHER_SCHLUESSEL = 'locodoko-spielername';

/**
 * Repräsentiert Fehler, die bei API-Aufrufen zur Spielverwaltung auftreten können.
 */
export class SpielverwaltungFehler extends Error {
  readonly fehlerCode: string;

  constructor(fehlerCode: string, nachricht: string) {
    super(nachricht);
    this.name = 'SpielverwaltungFehler';
    this.fehlerCode = fehlerCode;
  }
}

function leseGespeichertenSpielernamen(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(SPIELERNAME_SPEICHER_SCHLUESSEL);
}

function speichereSpielernamen(name: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(SPIELERNAME_SPEICHER_SCHLUESSEL, name);
}

function generiereStandardSpielernamen(): string {
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${STANDARD_SPIELERNAME_PREFIX} ${suffix}`;
}

function istApiFehlerAntwort(wert: unknown): wert is ApiFehlerAntwort {
  return Boolean(
    wert
      && typeof wert === 'object'
      && 'fehlerCode' in wert
      && 'nachricht' in wert
      && typeof wert.fehlerCode === 'string'
      && typeof wert.nachricht === 'string'
  );
}

async function leseAntwort<T>(antwort: Response): Promise<T | null> {
  if (antwort.status === 204) {
    return null;
  }

  const text = await antwort.text();
  if (!text) {
    return null;
  }

  return JSON.parse(text) as T;
}

async function holeJson<T>(
  pfad: string,
  init?: RequestInit,
  meldungCallback?: (text: string, typ: 'info' | 'fehler') => void,
  correlationIdCallback?: (id: string) => void
): Promise<T> {
  const methode = init?.method ?? 'GET';
  Logger.api(`[HOLE_JSON] Requesting: ${methode} ${pfad}`);
  try {
    const antwort = await fetch(pfad, Object.assign({}, {
      method: init?.method ?? 'GET',
      body: init?.body,
      credentials: init?.credentials ?? 'include',
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init?.headers || {}),
      },
      mode: init?.mode,
      redirect: init?.redirect,
      referrer: init?.referrer,
      cache: init?.cache,
      signal: init?.signal,
    }, init));
    Logger.api(`${methode} ${pfad}`, { status: antwort.status });
    const corrId = antwort.headers?.get('X-Correlation-Id');
    if (corrId) {
      correlationIdCallback?.(corrId);
    }
    const daten = await leseAntwort<unknown>(antwort);
    if (!antwort.ok) {
      Logger.api('API Error Response', { url: pfad, status: antwort.status, body: daten });
      if (istApiFehlerAntwort(daten)) {
        if (antwort.status === 422) {
          // Fachliche Ablehnung: Regelverstoß — Server-Nachricht direkt anzeigen
          meldungCallback?.(daten.nachricht, 'fehler');
        } else if (antwort.status === 409) {
          // Konflikt: Spielstand veraltet oder gleichzeitige Aktion
          meldungCallback?.('Spielstand veraltet – bitte Seite neu laden', 'fehler');
        }
        throw new SpielverwaltungFehler(daten.fehlerCode, daten.nachricht);
      }

      throw new SpielverwaltungFehler('SERVERFEHLER', `Unerwartete Antwort ${antwort.status}`);
    }
    Logger.api(`[HOLE_JSON] Successful response for ${pfad}`);
    return daten as T;
  } catch (error) {
    Logger.api(`[HOLE_JSON] Fetch/Parse Error for ${pfad}`, { error });
    throw error;
  }
}

export class SpielverwaltungApi {
  private meldungCallback?: (text: string, typ: 'info' | 'fehler') => void;
  private correlationIdCallback?: (id: string) => void;

  /** Verbindet den API-Fehler-Handler mit der UI-Meldungsanzeige (z.B. AppStore.setMeldung). */
  setzeMeldungCallback(cb: (text: string, typ: 'info' | 'fehler') => void): void {
    this.meldungCallback = cb;
  }

  /** Verbindet den Correlation-ID-Handler mit dem AppStore-Ringpuffer. */
  setzeCorrelationIdCallback(cb: (id: string) => void): void {
    this.correlationIdCallback = cb;
  }

  private async hol<T>(pfad: string, init?: RequestInit): Promise<T> {
    return holeJson<T>(pfad, init, this.meldungCallback, this.correlationIdCallback);
  }

  async initialisiereSpielerSession(): Promise<SpielerSessionAntwort> {
    const bevorzugterName = leseGespeichertenSpielernamen() ?? generiereStandardSpielernamen();
    Logger.api('Attempting to initialize player session...');
    try {
      const spieler = await this.hol<SpielerSessionAntwort>('/api/spieler/session', {
        method: 'POST',
        body: JSON.stringify({ name: bevorzugterName })
      });
      Logger.api('Player session initialized successfully.', { spielerId: spieler.spielerId });
      speichereSpielernamen(spieler.name);
      return spieler;
    } catch (error) {
      Logger.api('Failed to initialize player session.', { error });
      throw error;
    }
  }

  async listeTische(): Promise<TischListenEintragAntwort[]> {
    return this.hol<TischListenEintragAntwort[]>('/api/tische');
  }

  async ladeTisch(tischId: Uuid): Promise<TischAntwort> {
    return this.hol<TischAntwort>(`/api/tische/${tischId}`);
  }

  async gibPresets(): Promise<TischPresetAntwort[]> {
    return this.hol<TischPresetAntwort[]>('/api/tische/presets');
  }

  async erstelleTisch(name: string, konfiguration?: Partial<TischKonfigurationDto>, privat?: boolean, presetName?: string, anzahlSpiele?: number): Promise<TischAntwort> {
    return this.hol<TischAntwort>('/api/tische', {
      method: 'POST',
      body: JSON.stringify({ name, konfiguration, privat: privat ?? false, presetName, anzahlSpiele })
    });
  }

  async schnellstart(): Promise<TischAntwort> {
    return this.hol<TischAntwort>('/api/tische/schnellstart', { method: 'POST' });
  }

  async betreteTisch(tischId: Uuid): Promise<TischAntwort> {
    return this.hol<TischAntwort>(`/api/tische/${tischId}/beitreten`, { method: 'POST' });
  }

  async betreteTischViaCode(einladungsCode: string): Promise<TischAntwort> {
    return this.hol<TischAntwort>(`/api/tische/beitreten/${encodeURIComponent(einladungsCode)}`, { method: 'POST' });
  }

  async verlasseTisch(tischId: Uuid): Promise<BestaetigungAntwort> {
    return this.hol<BestaetigungAntwort>(`/api/tische/${tischId}/verlassen`, { method: 'POST' });
  }

  async starteTisch(tischId: Uuid): Promise<BestaetigungAntwort> {
    return this.hol<BestaetigungAntwort>(`/api/tische/${tischId}/starten`, { method: 'POST' });
  }

  async starteNeuePartie(tischId: Uuid): Promise<BestaetigungAntwort> {
    return this.hol<BestaetigungAntwort>(`/api/tische/${tischId}/neue-partie`, { method: 'POST' });
  }

  async aktualisiereTischKonfiguration(tischId: Uuid, konfiguration: TischKonfigurationDto): Promise<TischKonfigurationDto> {
    return this.hol<TischKonfigurationDto>(`/api/tische/${tischId}/konfiguration`, {
      method: 'PUT',
      body: JSON.stringify(konfiguration)
    });
  }

  async registrieren(benutzername: string, passwort: string, email?: string): Promise<AuthentifizierungsAntwort> {
    return this.hol<AuthentifizierungsAntwort>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ benutzername, passwort, email: email || null })
    });
  }

  async einloggen(benutzername: string, passwort: string): Promise<AuthentifizierungsAntwort> {
    return this.hol<AuthentifizierungsAntwort>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ benutzername, passwort })
    });
  }

  async ausloggen(): Promise<void> {
    await this.hol<void>('/api/auth/logout', { method: 'POST' });
  }

  async kickeSpieler(tischId: Uuid, spielerId: Uuid): Promise<BestaetigungAntwort> {
    return this.hol<BestaetigungAntwort>(`/api/tische/${tischId}/spieler/${spielerId}`, { method: 'DELETE' });
  }

  async ladeSpielerProfil(spielerId: Uuid): Promise<SpielerProfilAntwortGenerated> {
    return this.hol<SpielerProfilAntwortGenerated>(`/api/spieler/${spielerId}/profil`);
  }

  async ladeBestenliste(regelvariante: string): Promise<BestenlisteAntwortGenerated> {
    return this.hol<BestenlisteAntwortGenerated>(`/api/spieler/leaderboard?regelvariante=${encodeURIComponent(regelvariante)}`);
  }

  async gibFeedback(text: string): Promise<void> {
    await this.hol<void>('/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ text })
    });
  }

  async meldeBugReport(anfrage: BugReportAnfrage): Promise<BugReportAntwort> {
    return this.hol<BugReportAntwort>('/api/bugreport', {
      method: 'POST',
      body: JSON.stringify(anfrage)
    });
  }
}

export interface BugReportAnfrage {
  beschreibung: string;
  schweregrad: string;
  correlationIds: string[];
  tischId: string | null;
  partieId: string | null;
  userAgent: string;
  viewport: string;
  buildSha: string | null;
  zustandZusammenfassung: string | null;
}

export interface BugReportAntwort {
  issueUrl: string | null;
}
