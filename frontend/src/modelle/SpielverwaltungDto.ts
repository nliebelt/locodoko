/**
 * Handgeschriebene DTO-Typen fuer die Locodoko REST- und WebSocket-API.
 *
 * MIGRATION: Diese Typen werden schrittweise durch generierte Typen aus
 * {@code frontend/src/generated/api-types.ts} (via openapi-typescript) ersetzt.
 */
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
  aktiverTischId?: Uuid | null;
  anzeigeName?: string;
  avatarFarbe?: string;
}

export interface AuthentifizierungsAntwort {
  spielerId: Uuid;
  name: string;
  authentifizierungsMethode: string | null;
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

export type Tischhintergrund = 'FILZ_GRUEN' | 'BLAU_GRAFIK' | 'HOLZ_DUNKEL' | 'RECHTECK_1' | 'RECHTECK_2' | 'OVAL_1' | 'OVAL_2' | 'RUND_1';
export type KiSchwierigkeit = 'LEICHT' | 'STANDARD' | 'SCHWER';

export interface TischKonfigurationDto {
  ohneNeunen: boolean;
  anzahlSpiele: number;
  tischhintergrund: Tischhintergrund;
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
  bockrundenAktiv: boolean;
  schweinchenAktiv: boolean;
  dreissigAugenPflichtAktiv: boolean;
  schmeissenAktiv: boolean;
  herzDurchgegangenNurHoch: boolean;
  kiSchwierigkeit: KiSchwierigkeit;
}

export interface SpielerAmTischAntwort {
  spielerId: Uuid;
  name: string;
  istKi: boolean;
}

export type Zugangsmodus = 'OFFEN' | 'PRIVAT';

export interface TischAntwort {
  id: Uuid;
  name: string;
  einladungsCode: string;
  status: TischStatus;
  zugangsmodus: Zugangsmodus;
  erstelltVonSpielerId: Uuid;
  spieler: SpielerAmTischAntwort[];
  konfiguration: TischKonfigurationDto;
  partieId: Uuid | null;
}

export type SpielerPosition = 'NORD' | 'OST' | 'SUED' | 'WEST';
export type PartieStatus = 'LAUFEND' | 'BEENDET' | 'ABGEBROCHEN';
export type Spieltyp = 'NORMALSPIEL' | 'HOCHZEIT' | 'ARMUT' | 'SOLO_DAME' | 'SOLO_BUBE' | 'SOLO_FLEISCHLOS' | 'SOLO_TRUMPF' | 'SOLO_TRUMPF_KREUZ' | 'SOLO_TRUMPF_PIK' | 'SOLO_TRUMPF_HERZ';
export type Partei = 'RE' | 'KONTRA';
export type Ansage = 'RE' | 'KONTRA' | 'KEINE_90' | 'KEINE_60' | 'KEINE_30' | 'SCHWARZ';
export type VorbehaltAnsage = 'GESUND' | 'SOLO_DAME' | 'SOLO_BUBE' | 'SOLO_TRUMPF' | 'SOLO_TRUMPF_HERZ' | 'SOLO_TRUMPF_PIK' | 'SOLO_TRUMPF_KREUZ' | 'SOLO_FLEISCHLOS' | 'HOCHZEIT' | 'ARMUT' | 'SCHMEISSEN' | 'SCHMEISSEN_FUENF_NEUNEN' | 'SCHMEISSEN_WENIG_TRUMPF';
export type Sonderpunkt = 'FUCHS_GEFANGEN' | 'DOPPELKOPF' | 'KARLCHEN';

// Typsichere Konstanten fuer die zentralen Enum-artigen Werte
export const SPIELER_POSITION = {
  SUED: 'SUED',
  NORD: 'NORD',
  OST: 'OST',
  WEST: 'WEST',
} as const satisfies Record<SpielerPosition, SpielerPosition>;

export const PARTEI = {
  RE: 'RE',
  KONTRA: 'KONTRA',
} as const satisfies Record<Partei, Partei>;

export const SPIELTYP = {
  NORMALSPIEL: 'NORMALSPIEL',
  HOCHZEIT: 'HOCHZEIT',
  ARMUT: 'ARMUT',
  SOLO_DAME: 'SOLO_DAME',
  SOLO_BUBE: 'SOLO_BUBE',
  SOLO_FLEISCHLOS: 'SOLO_FLEISCHLOS',
  SOLO_TRUMPF: 'SOLO_TRUMPF',
  SOLO_TRUMPF_KREUZ: 'SOLO_TRUMPF_KREUZ',
  SOLO_TRUMPF_PIK: 'SOLO_TRUMPF_PIK',
  SOLO_TRUMPF_HERZ: 'SOLO_TRUMPF_HERZ',
} as const satisfies Record<Spieltyp, Spieltyp>;

export interface KarteAntwort {
  id: string;
  farbe: string;
  wert: string;
  exemplarIndex: number;
}

export interface GespielteKarteAntwort {
  spielerPosition: SpielerPosition;
  karte: KarteAntwort;
  reihenfolge: number;
}

export interface AnsageEreignisAntwort {
  spielerPosition: SpielerPosition;
  ansage: Ansage;
}

export interface SpielerImSpielAntwort {
  position: SpielerPosition;
  spielerId: Uuid;
  name: string;
  anzeigeName: string;
  avatarFarbe: string | null;
  istKi: boolean;
  istKiUebernommen: boolean;
  istSelbst: boolean;
  istGeber: boolean;
  istAmZug: boolean;
  verbleibendeKarten: number | null;
  gewonneneStiche: number;
  partei: Partei | null;
  sichtbareHandkarten: KarteAntwort[] | null;
}

export interface LaufendesSpielAntwort {
  spielNummer: number;
  spieltyp: Spieltyp;
  phase: string;
  geber: SpielerPosition;
  aktuellerSpieler: SpielerPosition;
  spieler: SpielerImSpielAntwort[];
  spielbareKarten: KarteAntwort[];
  aktuelleStichmitte: GespielteKarteAntwort[];
  ansageHistorie: AnsageEreignisAntwort[];
  moeglicheAnsagen: Ansage[];
  moeglicheVorbehalte: VorbehaltAnsage[];
  deklarierteVorbehalte: { position: SpielerPosition; ansage: VorbehaltAnsage }[];
  bockrundenZaehler: number;
  hochzeitGeklaert: boolean;
  schweinchenAktiv: boolean;
  schweinchenGemeldetVon: SpielerPosition | null;
  armutSpielerPosition?: SpielerPosition | null;
}

export interface AbgeschlossenerStichAntwort {
  spielNummer: number;
  stichNummer: number;
  aufspielerPosition: SpielerPosition;
  gewinnerPosition: SpielerPosition;
  augen: number;
  gespielteKarten: GespielteKarteAntwort[];
}

export interface SonderpunktEreignis {
  art: Sonderpunkt;
  taeter: SpielerPosition;
  opfer?: SpielerPosition | null;
}

export interface PunkteKomponenteAntwort {
  typ: string;
  punkte: number;
}

export interface LetztesSpielergebnisAntwort {
  spielNummer: number;
  spieltyp: Spieltyp;
  siegerPartei: Partei;
  spielwert: number;
  grundwert: number;
  absagePunkte: number;
  gegenDieAltenPunkte: number;
  soloMultiplikator: number;
  augenProPartei: Record<Partei, number>;
  spielpunkteProSpieler: Record<SpielerPosition, number>;
  sonderpunkteProPartei: Record<Partei, SonderpunktEreignis[]>;
  punkteAufschluesselung: PunkteKomponenteAntwort[];
}

export interface PartieStandAntwort {
  partieId: Uuid;
  version: number;
  status: PartieStatus;
  anzahlSpiele: number;
  gespielteSpiele: number;
  gesamtpunktestand: Partial<Record<SpielerPosition, number>>;
  letztesSpielergebnis?: LetztesSpielergebnisAntwort | null;
  letzteAbgeschlosseneStiche?: AbgeschlossenerStichAntwort[];
  laufendesSpiel: LaufendesSpielAntwort | null;
}

export type TischlisteEreignisTyp = 'SNAPSHOT' | 'AKTUALISIERT';
export type TischEreignisTyp = 'TISCH_SNAPSHOT' | 'TISCH_ERSTELLT' | 'SPIELER_BEIGETRETEN' | 'SPIELER_VERLASSEN' | 'TISCH_KONFIGURATION_AKTUALISIERT' | 'SPIEL_GESTARTET' | 'TISCH_ENTFERNT' | 'PARTIE_ABGEBROCHEN' | 'SPIELER_GEKICKT' | 'COUNTDOWN_TICK';
export type PartieEreignisTyp = 'SNAPSHOT' | 'KARTE_GESPIELT' | 'STICH_ABGESCHLOSSEN' | 'SPIEL_BEENDET' | 'ANSAGE_ERFOLGT' | 'SCHWEINCHEN_GEMELDET' | 'HOCHZEIT_PARTNER_GEFUNDEN' | 'SPIEL_GESTARTET' | 'AKTION_ABGELEHNT';

export interface GespielteKarteEreignisAntwort {
  spielerPosition: SpielerPosition;
  karteId: string;
}

export interface SonderpunktEreignisAntwortDto {
  typ: 'FUCHS_GEFANGEN' | 'DOPPELKOPF' | 'KARLCHEN';
  gewinner: SpielerPosition;
  verlierer?: SpielerPosition;
}

export interface TischlisteEreignisAntwort {
  ereignisTyp: TischlisteEreignisTyp;
  tische: TischListenEintragAntwort[];
}

export interface TischEreignisAntwort {
  ereignisTyp: TischEreignisTyp;
  tischId: Uuid;
  tisch: TischAntwort | null;
  partieStand: PartieStandAntwort | null;
  verbleibendeSekunden?: number | null;
}

// --- Locodoko Unified Architecture: Typsichere Events ---

export interface BasisPartieEreignis {
  version: number;
  ereignisTyp: PartieEreignisTyp;
  partieStand: PartieStandAntwort;
}

export interface SnapshotEreignis extends BasisPartieEreignis { ereignisTyp: 'SNAPSHOT'; }
export interface KarteGespieltEreignis extends BasisPartieEreignis { ereignisTyp: 'KARTE_GESPIELT'; spielerPosition: SpielerPosition; karteId: string; }
export interface AktionAbgelehntEreignis extends BasisPartieEreignis { ereignisTyp: 'AKTION_ABGELEHNT'; fehlerCode: string; }
export interface StichAbgeschlossenEreignis extends BasisPartieEreignis { 
  ereignisTyp: 'STICH_ABGESCHLOSSEN'; 
  neueSonderpunkte: SonderpunktEreignisAntwortDto[];
}
export interface SpielBeendetEreignis extends BasisPartieEreignis { ereignisTyp: 'SPIEL_BEENDET'; }
export interface AnsageErfolgtEreignis extends BasisPartieEreignis { ereignisTyp: 'ANSAGE_ERFOLGT'; }
export interface SchweinchenGemeldetEreignis extends BasisPartieEreignis { ereignisTyp: 'SCHWEINCHEN_GEMELDET'; spielerPosition: SpielerPosition; }
export interface HochzeitPartnerGefundenEreignis extends BasisPartieEreignis { ereignisTyp: 'HOCHZEIT_PARTNER_GEFUNDEN'; partnerPosition: SpielerPosition; }
export interface SpielGestartetEreignis extends BasisPartieEreignis { ereignisTyp: 'SPIEL_GESTARTET'; }

export type PartieEreignisAntwort = 
  | SnapshotEreignis 
  | KarteGespieltEreignis 
  | StichAbgeschlossenEreignis 
  | SpielBeendetEreignis 
  | AnsageErfolgtEreignis 
  | SchweinchenGemeldetEreignis 
  | HochzeitPartnerGefundenEreignis
  | SpielGestartetEreignis
  | AktionAbgelehntEreignis;

export interface SpielverwaltungWebSocketFehlerAntwort {
  timestamp: string;
  fehlerCode: string;
  nachricht: string;
}

export interface TischPresetAntwort {
  name?: string;
  label?: string;
  beschreibung?: string;
  konfiguration?: TischKonfigurationDto;
}
