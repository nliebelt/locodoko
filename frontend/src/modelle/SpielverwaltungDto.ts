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
  /** ID des Tisches, an dem der Spieler aktuell sitzt; null falls keiner. Fuer Session-Recovery. */
  aktiverTischId?: Uuid | null;
}

/** Antwort nach erfolgreicher Registrierung oder Login. */
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
  /** Schwierigkeitsstufe der KI-Gegner. Standard: STANDARD. */
  kiSchwierigkeit: KiSchwierigkeit;
}

export interface SpielerAmTischAntwort {
  spielerId: Uuid;
  name: string;
  istKi: boolean;
}

export interface TischAntwort {
  id: Uuid;
  name: string;
  einladungsCode: string;
  status: TischStatus;
  erstelltVonSpielerId: Uuid;
  spieler: SpielerAmTischAntwort[];
  konfiguration: TischKonfigurationDto;
  partieId: Uuid | null;
}

export type SpielerPosition = 'NORD' | 'OST' | 'SUED' | 'WEST';
export type Tischhintergrund = 'FILZ_GRUEN' | 'HOLZ_DUNKEL' | 'BLAU_GRAFIK' | 'RECHTECK_1' | 'RECHTECK_2' | 'OVAL_1' | 'OVAL_2' | 'RUND_1';
export type KiSchwierigkeit = 'LEICHT' | 'STANDARD' | 'SCHWER';
export type PartieStatus = 'LAUFEND' | 'BEENDET';
export type Spieltyp =
  | 'NORMALSPIEL'
  | 'HOCHZEIT'
  | 'ARMUT'
  | 'SOLO_DAME'
  | 'SOLO_BUBE'
  | 'SOLO_TRUMPF'
  | 'SOLO_TRUMPF_HERZ'
  | 'SOLO_TRUMPF_PIK'
  | 'SOLO_TRUMPF_KREUZ'
  | 'SOLO_FLEISCHLOS';
export type Spielphase =
  | 'KARTEN_AUSTEILEN'
  | 'VORBEHALT_ANSAGE'
  | 'VORBEHALT_AUFLOESUNG'
  | 'ARMUT_TAUSCH'
  | 'STICHPHASE'
  | 'AUSWERTUNG'
  | 'GESAMTSTAND_AKTUALISIEREN';
export type Partei = 'RE' | 'KONTRA';
export type Ansage = 'RE' | 'KONTRA' | 'KEINE_90' | 'KEINE_60' | 'KEINE_30' | 'SCHWARZ';
export type Sonderpunkt = 'FUCHS_GEFANGEN' | 'KARLCHEN' | 'DOPPELKOPF';
export type SpielerPositionTyp = 'SUED' | 'WEST' | 'NORD' | 'OST';
export interface SonderpunktEreignis {
  art: Sonderpunkt;
  taeter: SpielerPositionTyp;
  opfer: SpielerPositionTyp | null;
}
export type VorbehaltAnsage =
  | 'GESUND'
  | 'SOLO_DAME'
  | 'SOLO_BUBE'
  | 'SOLO_TRUMPF'
  | 'SOLO_TRUMPF_HERZ'
  | 'SOLO_TRUMPF_PIK'
  | 'SOLO_TRUMPF_KREUZ'
  | 'SOLO_FLEISCHLOS'
  | 'HOCHZEIT'
  | 'ARMUT';

export interface KarteAntwort {
  id: string;
  farbe: string;
  wert: string;
  exemplarIndex: number;
}

export interface SpielerImSpielAntwort {
  position: SpielerPosition;
  spielerId: Uuid | null;
  name: string;
  istKi: boolean;
  istSelbst: boolean;
  istGeber: boolean;
  istAmZug: boolean;
  verbleibendeKarten: number | null;
  gewonneneStiche: number;
  partei: Partei | null;
  sichtbareHandkarten: KarteAntwort[] | null;
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

export interface LaufendesSpielAntwort {
  spielNummer: number;
  spieltyp: Spieltyp;
  phase: Spielphase;
  geber: SpielerPosition;
  aktuellerSpieler: SpielerPosition | null;
  spieler: SpielerImSpielAntwort[];
  spielbareKarten: KarteAntwort[];
  aktuelleStichmitte: GespielteKarteAntwort[];
  ansageHistorie: AnsageEreignisAntwort[];
  moeglicheAnsagen: Ansage[];
  moeglicheVorbehalte: VorbehaltAnsage[];
  istBockrunde: boolean;
}

export interface AbgeschlossenerStichAntwort {
  spielNummer: number;
  stichNummer: number;
  aufspielerPosition: SpielerPosition;
  gewinnerPosition: SpielerPosition;
  augen: number;
  gespielteKarten: GespielteKarteAntwort[];
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
}

export interface PartieStandAntwort {
  partieId: Uuid;
  status: PartieStatus;
  anzahlSpiele: number;
  gespielteSpiele: number;
  gesamtpunktestand: Partial<Record<SpielerPosition, number>>;
  letztesSpielergebnis?: LetztesSpielergebnisAntwort | null;
  letzteAbgeschlosseneStiche?: AbgeschlossenerStichAntwort[];
  laufendesSpiel: LaufendesSpielAntwort | null;
}

export type TischlisteEreignisTyp = 'SNAPSHOT' | 'AKTUALISIERT';
export type TischEreignisTyp =
  | 'TISCH_SNAPSHOT'
  | 'TISCH_ERSTELLT'
  | 'SPIELER_BEIGETRETEN'
  | 'SPIELER_VERLASSEN'
  | 'TISCH_KONFIGURATION_AKTUALISIERT'
  | 'SPIEL_GESTARTET'
  | 'TISCH_ENTFERNT'
  /** Partie abgebrochen, weil ein Spieler den Tisch willentlich verlassen hat. */
  | 'PARTIE_ABGEBROCHEN';
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
