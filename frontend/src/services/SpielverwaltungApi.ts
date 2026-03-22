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
  const antwort = await fetch(pfad, {
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {})
    },
    ...init
  });

  Logger.api(`${methode} ${pfad}`, { status: antwort.status });
  const daten = await leseAntwort<unknown>(antwort);
  if (!antwort.ok) {
    Logger.api('Fehler', { url: pfad, status: antwort.status, body: daten });
    if (istApiFehlerAntwort(daten)) {
      throw new SpielverwaltungFehler(daten.fehlerCode, daten.nachricht);
    }

    throw new SpielverwaltungFehler('SERVERFEHLER', `Unerwartete Antwort ${antwort.status}`);
  }

  return daten as T;
}

export class SpielverwaltungApi {
  async initialisiereSpielerSession(): Promise<SpielerSessionAntwort> {
    const bevorzugterName = leseGespeichertenSpielernamen() ?? generiereStandardSpielernamen();
    const spieler = await holeJson<SpielerSessionAntwort>('/api/spieler/session', {
      method: 'POST',
      body: JSON.stringify({ name: bevorzugterName })
    });
    speichereSpielernamen(spieler.name);
    return spieler;
  }

  async listeTische(): Promise<TischListenEintragAntwort[]> {
    return holeJson<TischListenEintragAntwort[]>('/api/tische');
  }

  async erstelleTisch(name: string): Promise<TischAntwort> {
    return holeJson<TischAntwort>('/api/tische', {
      method: 'POST',
      body: JSON.stringify({ name })
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
