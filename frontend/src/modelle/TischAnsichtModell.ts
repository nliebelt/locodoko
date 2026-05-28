import { SPIELER_POSITION, PARTEI, SPIELTYP } from '../modelle/SpielverwaltungDto';
import { mappeRelativePosition } from './SitzordnungModell';
import type { SpielerPosition } from './SitzordnungModell';
import {
  berechneSpielerankuendigungstext,
  bestimmeBezugsPositionAusPartie,
  bestimmeBezugsPositionAusTisch,
  mappeSpielerAusPartie,
  mappeSpielerAusTisch,
  mappeAktuelleStichmitte,
  mappeAnsageHistorie,
  mappeGesamtpunktestand,
  mappeLetzteAbgeschlosseneStiche,
  mappeLetztesSpielergebnis,
  bestimmeArmutAktion
} from './TischAnsichtMapper';
import type {
  Ansage,
  KarteAntwort,
  LaufendesSpielAntwort,
  Partei,
  PartieStandAntwort,
  PunkteKomponenteAntwort,
  SonderpunktEreignis,
  SpielerPosition as BackendSpielerPosition,
  Tischhintergrund,
  TischAntwort,
  VorbehaltAnsage
} from '../modelle/SpielverwaltungDto';

export type { SpielerPosition } from './SitzordnungModell';
export { SPIELER_POSITION, PARTEI, SPIELTYP };
export { istTrumpfFuerSpieltyp } from './TischKartenSortierung';
export { vorbehaltZuSpieltypFuerSortierung, istHervorgehobeneKarteImVorbehalt, sortiereKartenFuerVorbehalt } from './TischVorbehaltModell';

/**
 * View-Repraesentation eines einzelnen Spielers am Tisch.
 * Enthaelt alle Daten, die die TischSzene fuer die Darstellung benoetigt,
 * inklusive relativer Sitzposition und sichtbarer Handkarten (nur im Debug-Modus).
 */
export interface SpielerAnsicht {
  position: SpielerPosition;
  absolutePosition: BackendSpielerPosition | null;
  name: string;
  anzeigeName: string;
  avatarFarbe: string | null;
  istMensch: boolean;
  istSelbst: boolean;
  istErsteller: boolean;
  istGeber: boolean;
  verbleibendeKarten: number;
  stiche: number;
  istAktivHervorgehoben: boolean;
  partei: Partei | null;
  sichtbareHandkarten: KarteAntwort[];
}

/** Eine gespielte Karte in der Stichmitte, mit relativer Spielerposition und Reihenfolge. */
export interface GespielteKarteAnsicht {
  position: SpielerPosition;
  name: string;
  karte: KarteAntwort;
  reihenfolge: number;
}

/** Ein Eintrag in der Ansagehistorie (Re, Kontra oder Absagen) mit Spielerposition. */
export interface AnsageAnsicht {
  position: SpielerPosition;
  name: string;
  ansage: Ansage;
}

/** Einzelner Eintrag im Gesamtpunktestand einer Partie. */
export interface PunktestandEintrag {
  position: SpielerPosition;
  name: string;
  punkte: number;
}

/** Abgeschlossener Stich fuer die "Letzte Stiche"-Anzeige. */
export interface AbgeschlossenerStichAnsicht {
  spielNummer: number;
  stichNummer: number;
  aufspielerPosition: SpielerPosition;
  gewinnerPosition: SpielerPosition;
  gewinnerName: string;
  augen: number;
  gespielteKarten: GespielteKarteAnsicht[];
}

/**
 * Auswertungsergebnis des zuletzt abgeschlossenen Spiels.
 * Enthaelt Siegerpartei, Spielwert mit Aufschluesselung, Augenstand und Sonderpunkte beider Parteien.
 */
export interface LetztesSpielergebnisAnsicht {
  spielNummer: number;
  spieltyp: LaufendesSpielAntwort['spieltyp'];
  siegerPartei: Partei;
  spielwert: number;
  grundwert: number;
  absagePunkte: number;
  gegenDieAltenPunkte: number;
  soloMultiplikator: number;
  augenRe: number;
  augenKontra: number;
  spielpunkte: PunktestandEintrag[];
  sonderpunkteRe: SonderpunktEreignis[];
  sonderpunkteKontra: SonderpunktEreignis[];
  punkteAufschluesselung: PunkteKomponenteAntwort[];
}

/**
 * Beschreibt die aktuelle Armut-Interaktion des eigenen Spielers:
 * entweder das Anbieten der Armut-Karten oder die Antwort auf ein Armut-Angebot.
 */
export interface ArmutAktionAnsicht {
  modus: 'ANBIETEN' | 'ANTWORTEN';
  kartenAnzahl: number;
  armutSpielerPosition: SpielerPosition;
  armutSpielerName: string;
}

/**
 * Vollstaendiges View-Modell fuer die TischSzene.
 *
 * Transformiert den Backend-Snapshot (absolute Spielerpositionen) in eine relative
 * Sichtweise aus Perspektive des eigenen Spielers (SUED = ich). Enthaelt alle Daten,
 * die die TischSzene ohne weitere Logik direkt darstellen kann.
 *
 * Erstellt per `erstelleTischAnsichtAusStatus()` aus AppZustand.
 */
export interface TischAnsichtModell {
  titel: string;
  untertitel: string;
  debugModus: boolean;
  tischhintergrund: Tischhintergrund;
  spieltyp: LaufendesSpielAntwort['spieltyp'] | null;
  phase: LaufendesSpielAntwort['phase'] | null;
  aktuellerSpieler: SpielerPosition | null;
  spielbareKarten: string[];
  moeglicheAnsagen: Ansage[];
  moeglicheVorbehalte: VorbehaltAnsage[];
  deklarierteVorbehalte: { position: SpielerPosition; ansage: VorbehaltAnsage }[];
  spieler: SpielerAnsicht[];
  aktuelleStichmitte: GespielteKarteAnsicht[];
  ansageHistorie: AnsageAnsicht[];
  gesamtpunktestand: PunktestandEintrag[];
  letzteAbgeschlosseneStiche: AbgeschlossenerStichAnsicht[];
  letztesSpielergebnis: LetztesSpielergebnisAnsicht | null;
  /** true, wenn die gesamte Partie (alle Spiele) beendet ist — loest Partie-Ende-Modal aus. */
  partieBeendet: boolean;
  armutAktion: ArmutAktionAnsicht | null;
  /** Ankündigungstext für Sonderspiele (z.B. "Anna spielt Damensolo"), null bei Normalspiel oder kein laufendes Spiel. */
  spielankuendigungstext: string | null;
  /** Position des Spielers der Schweinchen gemeldet hat (erstes Karo-As gespielt), null wenn nicht gemeldet. */
  schweinchenGemeldetVon: SpielerPosition | null;
}

/**
 * Erzeugt ein Platzhalter-TischAnsichtModell fuer die Wartezeit vor dem ersten Spiel.
 * Wird in der TischSzene als Anfangszustand verwendet, bis der erste Backend-Snapshot eintrifft.
 * @param spielerName - Name des eigenen Spielers fuer den SUED-Platz
 * @returns Standardmodell mit 4 Spielerplaetzen (1 Mensch + 3 KI-Platzhalter)
 */
export function erstelleStandardTischAnsicht(spielerName: string): TischAnsichtModell {
  return {
    titel: 'Loco Doko',
    untertitel: 'Bereit fuer das erste Spiel',
    debugModus: false,
    tischhintergrund: 'OVAL_2',
    spieltyp: null,
    phase: null,
    aktuellerSpieler: null,
    spielbareKarten: [],
    moeglicheAnsagen: [],
    moeglicheVorbehalte: [],
    deklarierteVorbehalte: [],
    spieler: [
      {
        position: SPIELER_POSITION.SUED,
        absolutePosition: SPIELER_POSITION.SUED,
        name: spielerName,
        anzeigeName: spielerName,
        avatarFarbe: null,
        istMensch: true,
        istSelbst: true,
        istErsteller: true,
        istGeber: false,
        verbleibendeKarten: 12,
        stiche: 0,
        istAktivHervorgehoben: true,
        partei: null,
        sichtbareHandkarten: []
      },
      {
        position: SPIELER_POSITION.WEST,
        absolutePosition: SPIELER_POSITION.WEST,
        name: 'KI West',
        anzeigeName: 'KI West',
        avatarFarbe: null,
        istMensch: false,
        istSelbst: false,
        istErsteller: false,
        istGeber: false,
        verbleibendeKarten: 12,
        stiche: 0,
        istAktivHervorgehoben: false,
        partei: null,
        sichtbareHandkarten: []
      },
      {
        position: SPIELER_POSITION.NORD,
        absolutePosition: SPIELER_POSITION.NORD,
        name: 'KI Nord',
        anzeigeName: 'KI Nord',
        avatarFarbe: null,
        istMensch: false,
        istSelbst: false,
        istErsteller: false,
        istGeber: false,
        verbleibendeKarten: 12,
        stiche: 0,
        istAktivHervorgehoben: false,
        partei: null,
        sichtbareHandkarten: []
      },
      {
        position: SPIELER_POSITION.OST,
        absolutePosition: SPIELER_POSITION.OST,
        name: 'KI Ost',
        anzeigeName: 'KI Ost',
        avatarFarbe: null,
        istMensch: false,
        istSelbst: false,
        istErsteller: false,
        istGeber: false,
        verbleibendeKarten: 12,
        stiche: 0,
        istAktivHervorgehoben: false,
        partei: null,
        sichtbareHandkarten: []
      }
    ],
    aktuelleStichmitte: [],
    ansageHistorie: [],
    gesamtpunktestand: [],
    letzteAbgeschlosseneStiche: [],
    letztesSpielergebnis: null,
    partieBeendet: false,
    armutAktion: null,
    schweinchenGemeldetVon: null,
    spielankuendigungstext: null
  };
}

/**
 * Transformiert den AppZustand in ein TischAnsichtModell fuer die TischSzene.
 *
 * Rotiert die absoluten Backend-Spielerpositionen so, dass der eigene Spieler immer
 * auf SUED sitzt. Berechnet spielbare Karten, moegliche Ansagen/Vorbehalte und
 * die aktuelle Armut-Interaktion aus dem Partie-Stand.
 *
 * @param spielerId - ID des eigenen Spielers (null vor Initialisierung)
 * @param tisch - Aktueller Tisch-Snapshot; null wenn kein Tisch geoeffnet
 * @param partieStand - Aktueller Partie-Stand; null wenn keine Partie laeuft
 * @param debugModus - true wenn alle Handkarten sichtbar sein sollen
 * @returns Vollstaendiges View-Modell aus Sicht des eigenen Spielers
 */
export function erstelleTischAnsichtAusStatus(
  spielerId: string | null,
  tisch: TischAntwort | null,
  partieStand: PartieStandAntwort | null,
  debugModus = false
): TischAnsichtModell {
  if (!tisch) {
    return {
      titel: 'Loco Doko',
      untertitel: 'Noch kein Tisch geoeffnet',
       debugModus,
       tischhintergrund: 'OVAL_2',
       spieltyp: null,
      phase: null,
      aktuellerSpieler: null,
      spielbareKarten: [],
      moeglicheAnsagen: [],
      moeglicheVorbehalte: [],
      deklarierteVorbehalte: [],
      spieler: [],
      aktuelleStichmitte: [],
      ansageHistorie: [],
      gesamtpunktestand: [],
      letzteAbgeschlosseneStiche: [],
      letztesSpielergebnis: null,
      partieBeendet: false,
      armutAktion: null,
      schweinchenGemeldetVon: null,
      spielankuendigungstext: null
    };
  }

  const laufendesSpiel = partieStand?.laufendesSpiel;
  const bezugPosition = laufendesSpiel
    ? bestimmeBezugsPositionAusPartie(laufendesSpiel, spielerId, tisch)
    : bestimmeBezugsPositionAusTisch(spielerId, tisch);
  const spielerAnsichten = laufendesSpiel
    ? mappeSpielerAusPartie(laufendesSpiel.spieler, tisch, laufendesSpiel.spieltyp, laufendesSpiel.schweinchenAktiv, bezugPosition)
    : mappeSpielerAusTisch(spielerId, tisch, bezugPosition);

  return {
    titel: tisch.name,
    untertitel: laufendesSpiel
      ? `Spieltyp ${laufendesSpiel.spieltyp}`
      : partieStand?.letztesSpielergebnis
        ? `Letzte Auswertung · ${partieStand.letztesSpielergebnis.spieltyp}`
        : tisch.status === 'IM_SPIEL'
          ? 'Top-Down-Tischansicht'
          : 'Tisch in der Lobby',
    debugModus,
    tischhintergrund: tisch.konfiguration.tischhintergrund,
    spieltyp: laufendesSpiel?.spieltyp ?? null,
    phase: laufendesSpiel?.phase ?? null,
    aktuellerSpieler: mappeRelativePosition(laufendesSpiel?.aktuellerSpieler ?? null, bezugPosition),
    spielbareKarten: laufendesSpiel?.spielbareKarten.map((karte) => karte.id) ?? [],
    moeglicheAnsagen: laufendesSpiel?.moeglicheAnsagen ?? [],
    moeglicheVorbehalte: laufendesSpiel?.moeglicheVorbehalte ?? [],
    deklarierteVorbehalte: laufendesSpiel?.deklarierteVorbehalte ?? [],
    spieler: spielerAnsichten,
    aktuelleStichmitte: laufendesSpiel ? mappeAktuelleStichmitte(laufendesSpiel.aktuelleStichmitte, laufendesSpiel.spieler, bezugPosition) : [],
    ansageHistorie: laufendesSpiel ? mappeAnsageHistorie(laufendesSpiel.ansageHistorie, laufendesSpiel.spieler, bezugPosition) : [],
    gesamtpunktestand: mappeGesamtpunktestand(spielerAnsichten, partieStand?.gesamtpunktestand ?? {}),
    letzteAbgeschlosseneStiche: mappeLetzteAbgeschlosseneStiche(
      partieStand?.letzteAbgeschlosseneStiche ?? [],
      spielerAnsichten,
      bezugPosition
    ),
    letztesSpielergebnis: mappeLetztesSpielergebnis(
      partieStand?.letztesSpielergebnis ?? null,
      spielerAnsichten
    ),
    partieBeendet: partieStand?.status === 'BEENDET',
    armutAktion: laufendesSpiel ? bestimmeArmutAktion(laufendesSpiel, spielerAnsichten, bezugPosition) : null,
    schweinchenGemeldetVon: laufendesSpiel?.schweinchenGemeldetVon
      ? mappeRelativePosition(laufendesSpiel.schweinchenGemeldetVon, bezugPosition)
      : null,
    spielankuendigungstext: berechneSpielerankuendigungstext(laufendesSpiel)
  };
}
