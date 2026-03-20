export type Uuid = string;

export interface ApiFehlerAntwort {
  fehlerCode: string;
  nachricht: string;
}

export interface BestaetigungAntwort {
  nachricht: string;
}

export interface SpielerSessionAntwort {
  spielerId: Uuid;
  name: string;
  istKi: boolean;
}

export interface TischKurzKonfigurationAntwort {
  ohneNeunen: boolean;
  anzahlSpiele: number;
}

export type TischStatus = 'WARTEND' | 'IM_SPIEL' | 'BEENDET';

export interface TischListenEintragAntwort {
  id: Uuid;
  name: string;
  spielerAnzahl: number;
  status: TischStatus;
  kurzKonfiguration: TischKurzKonfigurationAntwort;
}

export interface TischKonfigurationDto {
  ohneNeunen: boolean;
  anzahlSpiele: number;
  hochzeitErlaubt: boolean;
  armutErlaubt: boolean;
  damensoloErlaubt: boolean;
  bubensoloErlaubt: boolean;
  fleischlosErlaubt: boolean;
  trumpfsoloErlaubt: boolean;
  zweiteDulleSticht: boolean;
  fuchsGefangenAktiv: boolean;
  karlchenAktiv: boolean;
  doppelkopfAktiv: boolean;
  mindestkartenReKontra: number;
  mindestkartenKeine90: number;
  mindestkartenKeine60: number;
  mindestkartenKeine30: number;
  mindestkartenSchwarz: number;
}

export interface SpielerAmTischAntwort {
  spielerId: Uuid;
  name: string;
  istKi: boolean;
}

export interface TischAntwort {
  id: Uuid;
  name: string;
  status: TischStatus;
  erstelltVonSpielerId: Uuid;
  spieler: SpielerAmTischAntwort[];
  konfiguration: TischKonfigurationDto;
  partieId: Uuid | null;
}

export type SpielerPosition = 'NORD' | 'OST' | 'SUED' | 'WEST';
export type PartieStatus = 'LAUFEND' | 'BEENDET';

export interface PartieStandAntwort {
  partieId: Uuid;
  status: PartieStatus;
  anzahlSpiele: number;
  gespielteSpiele: number;
  gesamtpunktestand: Partial<Record<SpielerPosition, number>>;
}

export type TischlisteEreignisTyp = 'SNAPSHOT' | 'AKTUALISIERT';
export type TischEreignisTyp =
  | 'TISCH_SNAPSHOT'
  | 'TISCH_ERSTELLT'
  | 'SPIELER_BEIGETRETEN'
  | 'SPIELER_VERLASSEN'
  | 'TISCH_KONFIGURATION_AKTUALISIERT'
  | 'SPIEL_GESTARTET'
  | 'TISCH_ENTFERNT';
export type PartieEreignisTyp = 'PARTIE_SNAPSHOT' | 'PARTIE_AKTUALISIERT';

export interface TischlisteEreignisAntwort {
  timestamp: string;
  ereignisTyp: TischlisteEreignisTyp;
  tische: TischListenEintragAntwort[];
}

export interface TischEreignisAntwort {
  timestamp: string;
  ereignisTyp: TischEreignisTyp;
  tischId: Uuid;
  tisch: TischAntwort | null;
  partieStand: PartieStandAntwort | null;
}

export interface PartieEreignisAntwort {
  timestamp: string;
  ereignisTyp: PartieEreignisTyp;
  partieStand: PartieStandAntwort;
}

export interface SpielverwaltungWebSocketFehlerAntwort {
  timestamp: string;
  fehlerCode: string;
  nachricht: string;
}
