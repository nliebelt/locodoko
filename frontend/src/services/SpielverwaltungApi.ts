import type {
  ApiFehlerAntwort,
  BestaetigungAntwort,
  SpielerSessionAntwort,
  TischKonfigurationDto,
  TischAntwort,
  TischListenEintragAntwort,
  Uuid
} from '../modelle/SpielverwaltungDto';
import { Logger } from '../logger';

const STANDARD_SPIELERNAME_PREFIX = 'Spieler';
const SPIELERNAME_SPEICHER_SCHLUESSEL = 'locodoko-spielername';

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

async function holeJson<T>(pfad: string, init?: RequestInit): Promise<T> {
  const methode = init?.method ?? 'GET';
  Logger.api(`[HOLE_JSON] Requesting: ${methode} ${pfad}`);
  try {
    const antwort = await fetch(pfad, Object.assign({}, {
      // Define base options with logic for init/defaults
      method: init?.method ?? 'GET',
      body: init?.body,
      credentials: init?.credentials ?? 'include',
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init?.headers || {}), // Merge init's headers
      },
      mode: init?.mode,
      redirect: init?.redirect,
      referrer: init?.referrer,
      cache: init?.cache,
      signal: init?.signal,
    }, init));
    Logger.api(`${methode} ${pfad}`, { status: antwort.status });
    const daten = await leseAntwort<unknown>(antwort);
    if (!antwort.ok) {
      Logger.api('API Error Response', { url: pfad, status: antwort.status, body: daten });
      if (istApiFehlerAntwort(daten)) {
        throw new SpielverwaltungFehler(daten.fehlerCode, daten.nachricht);
      }

      throw new SpielverwaltungFehler('SERVERFEHLER', `Unerwartete Antwort ${antwort.status}`);
    }
    Logger.api(`[HOLE_JSON] Successful response for ${pfad}`);
    return daten as T;
  } catch (error) {
    Logger.api(`[HOLE_JSON] Fetch/Parse Error for ${pfad}`, { error });
    throw error; // Re-throw to be caught by caller
  }
}

export class SpielverwaltungApi {
  async initialisiereSpielerSession(): Promise<SpielerSessionAntwort> {
    const bevorzugterName = leseGespeichertenSpielernamen() ?? generiereStandardSpielernamen();
    Logger.api('Attempting to initialize player session...');
    try {
      const spieler = await holeJson<SpielerSessionAntwort>('/api/spieler/session', {
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
    return holeJson<TischListenEintragAntwort[]>('/api/tische');
  }
  async erstelleTisch(name: string, konfiguration?: Partial<TischKonfigurationDto>): Promise<TischAntwort> {
    return holeJson<TischAntwort>('/api/tische', {
      method: 'POST',
      body: JSON.stringify({ name, konfiguration })
    });
  }

  async betreteTisch(tischId: Uuid): Promise<TischAntwort> {
    return holeJson<TischAntwort>(`/api/tische/${tischId}/beitreten`, { method: 'POST' });
  }

  async verlasseTisch(tischId: Uuid): Promise<BestaetigungAntwort> {
    return holeJson<BestaetigungAntwort>(`/api/tische/${tischId}/verlassen`, { method: 'POST' });
  }

  async starteTisch(tischId: Uuid): Promise<BestaetigungAntwort> {
    return holeJson<BestaetigungAntwort>(`/api/tische/${tischId}/starten`, { method: 'POST' });
  }

  async starteNeuePartie(tischId: Uuid): Promise<BestaetigungAntwort> {
    return holeJson<BestaetigungAntwort>(`/api/tische/${tischId}/neue-partie`, { method: 'POST' });
  }

  async aktualisiereTischKonfiguration(tischId: Uuid, konfiguration: TischKonfigurationDto): Promise<TischKonfigurationDto> {
    return holeJson<TischKonfigurationDto>(`/api/tische/${tischId}/konfiguration`, {
      method: 'PUT',
      body: JSON.stringify(konfiguration)
    });
  }
}