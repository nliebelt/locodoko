import type {
  PartieEreignisAntwort,
  PartieStandAntwort,
  SonderpunktEreignisAntwortDto,
  SpielerPosition,
  SpielerSessionAntwort,
  TischAntwort,
  TischListenEintragAntwort
} from '../modelle/SpielverwaltungDto';

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
  /** Ringpuffer der letzten empfangenen X-Correlation-Id-Werte (max. 20). */
  correlationIds: string[];
}

/** Zentrale Fehler→UiMeldung-Konvertierung (wird von TischStore, SessionStore und AppStore genutzt). */
export function formatiereMeldung(fehler: unknown): UiMeldung {
  if (fehler instanceof Error) {
    const meldung: UiMeldung = { typ: 'fehler', text: fehler.message };
    if ('fehlerCode' in fehler && typeof (fehler as Record<string, unknown>).fehlerCode === 'string') {
      meldung.fehlerCode = (fehler as Record<string, unknown>).fehlerCode as string;
    }
    return meldung;
  }
  return { typ: 'fehler', text: 'Unbekannter Fehler.' };
}

export type PartieEreignisListener = (ereignis: PartieEreignisAntwort) => void | Promise<void>;
export type SonderpunkteListener = (ereignis: SonderpunktEreignisAntwortDto[]) => void;
export type StoreAbo = (zustand: AppZustand) => void;

export function erzeugeAnfangszustand(): AppZustand {
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
    spielProtokollEintraege: [],
    correlationIds: []
  };
}
