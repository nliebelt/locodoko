import { SPIELER_POSITION, PARTEI, SPIELTYP } from '../modelle/SpielverwaltungDto';
import { sortiereSichtbareHandkarten, istTrumpfFuerSpieltyp } from './TischKartenSortierung';
import type {
  AbgeschlossenerStichAntwort,
  Ansage,
  AnsageEreignisAntwort,
  GespielteKarteAntwort,
  KarteAntwort,
  LaufendesSpielAntwort,
  LetztesSpielergebnisAntwort,
  Partei,
  PartieStandAntwort,
  PunkteKomponenteAntwort,
  SonderpunktEreignis,
  SpielerAmTischAntwort,
  SpielerImSpielAntwort,
  SpielerPosition as BackendSpielerPosition,
  Tischhintergrund,
  TischAntwort,
  VorbehaltAnsage
} from '../modelle/SpielverwaltungDto';

/** Relative Sitzposition eines Spielers aus Sicht des eigenen Spielers (SUED = ich). */
export type SpielerPosition = 'SUED' | 'WEST' | 'NORD' | 'OST';
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

const POSITIONEN: SpielerPosition[] = [SPIELER_POSITION.SUED, SPIELER_POSITION.WEST, SPIELER_POSITION.NORD, SPIELER_POSITION.OST];
const ABSOLUTE_POSITIONEN: BackendSpielerPosition[] = [SPIELER_POSITION.SUED, SPIELER_POSITION.WEST, SPIELER_POSITION.NORD, SPIELER_POSITION.OST];

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

/**
 * Berechnet den Anzeigetext fuer ein Sonderspiel (z.B. "Anna spielt Damensolo").
 * Gibt null zurueck bei Normalspiel oder wenn kein Spiel laeuft.
 */
function berechneSpielerankuendigungstext(spiel: LaufendesSpielAntwort | null | undefined): string | null {
  if (!spiel || spiel.spieltyp === SPIELTYP.NORMALSPIEL) return null;
  const labels: Partial<Record<string, string>> = {
    SOLO_DAME: 'Damensolo', SOLO_BUBE: 'Bubensolo', SOLO_TRUMPF: 'Karosolo',
    SOLO_TRUMPF_HERZ: 'Herzsolo', SOLO_TRUMPF_PIK: 'Piksolo', SOLO_TRUMPF_KREUZ: 'Kreuzsolo',
    SOLO_FLEISCHLOS: 'Fleischlos', HOCHZEIT: 'Hochzeit', ARMUT: 'Armut'
  };
  const label = labels[spiel.spieltyp] ?? spiel.spieltyp;
  const solist = spiel.spieler?.find((s: SpielerImSpielAntwort) => s.partei === PARTEI.RE);
  return solist ? `${solist.name} spielt ${label}` : label;
}

function bestimmeBezugsPositionAusPartie(
  laufendesSpiel: LaufendesSpielAntwort,
  spielerId: string | null,
  tisch: TischAntwort
): BackendSpielerPosition {
  const ausSpiel = laufendesSpiel.spieler.find((spieler) => spieler.istSelbst || (spielerId !== null && spieler.spielerId === spielerId))?.position;
  return ausSpiel ?? bestimmeBezugsPositionAusTisch(spielerId, tisch);
}

function bestimmeBezugsPositionAusTisch(spielerId: string | null, tisch: TischAntwort): BackendSpielerPosition {
  const eigenerIndex = spielerId ? tisch.spieler.findIndex((spieler) => spieler.spielerId === spielerId) : -1;
  return ABSOLUTE_POSITIONEN[eigenerIndex] ?? SPIELER_POSITION.SUED;
}

function mappeSpielerAusPartie(
  spieler: SpielerImSpielAntwort[],
  tisch: TischAntwort,
  spieltyp: LaufendesSpielAntwort['spieltyp'],
  schweinchenAktiv: boolean,
  bezugPosition: BackendSpielerPosition
): SpielerAnsicht[] {
  const nachPosition = new Map<SpielerPosition, SpielerAnsicht>();
  spieler.forEach((eintrag) => {
    const position = mappeRelativePositionOhneNull(eintrag.position, bezugPosition);
    nachPosition.set(position, {
      position,
      absolutePosition: eintrag.position,
      name: eintrag.name,
      anzeigeName: eintrag.anzeigeName ?? eintrag.name,
      avatarFarbe: eintrag.avatarFarbe ?? null,
      istMensch: !eintrag.istKi,
      istSelbst: eintrag.istSelbst,
      istErsteller: eintrag.spielerId === tisch.erstelltVonSpielerId,
      istGeber: eintrag.istGeber,
      verbleibendeKarten: eintrag.verbleibendeKarten ?? 0,
      stiche: eintrag.gewonneneStiche,
      istAktivHervorgehoben: eintrag.istAmZug || eintrag.istSelbst,
      partei: eintrag.partei,
      sichtbareHandkarten: sortiereSichtbareHandkarten(eintrag.sichtbareHandkarten ?? [], spieltyp, schweinchenAktiv)
    });
  });
  return POSITIONEN.map((position) => nachPosition.get(position) ?? leererPlatz(position));
}

function mappeSpielerAusTisch(
  spielerId: string | null,
  tisch: TischAntwort,
  bezugPosition: BackendSpielerPosition
): SpielerAnsicht[] {
  const nachPosition = new Map<SpielerPosition, SpielerAnsicht>();
  tisch.spieler.forEach((spieler, index) => {
    const absolutePosition = ABSOLUTE_POSITIONEN[index] ?? SPIELER_POSITION.SUED;
    const position = mappeRelativePositionOhneNull(absolutePosition, bezugPosition);
    nachPosition.set(position, mappeLobbySpieler(position, absolutePosition, spieler, tisch, spielerId));
  });
  return POSITIONEN.map((position) => nachPosition.get(position) ?? leererPlatz(position));
}

function mappeAktuelleStichmitte(
  aktuelleStichmitte: GespielteKarteAntwort[],
  spieler: SpielerImSpielAntwort[],
  bezugPosition: BackendSpielerPosition
): GespielteKarteAnsicht[] {
  const nameNachPosition = new Map(spieler.map((eintrag) => [eintrag.position, eintrag.name] as const));
  return [...aktuelleStichmitte]
    .sort((links, rechts) => links.reihenfolge - rechts.reihenfolge)
    .map((eintrag) => ({
      position: mappeRelativePositionOhneNull(eintrag.spielerPosition, bezugPosition),
      name: nameNachPosition.get(eintrag.spielerPosition) ?? eintrag.spielerPosition,
      karte: eintrag.karte,
      reihenfolge: eintrag.reihenfolge
    }));
}

function mappeAnsageHistorie(
  ansageHistorie: AnsageEreignisAntwort[],
  spieler: SpielerImSpielAntwort[],
  bezugPosition: BackendSpielerPosition
): AnsageAnsicht[] {
  const nameNachPosition = new Map(spieler.map((eintrag) => [eintrag.position, eintrag.name] as const));
  return ansageHistorie.map((eintrag) => ({
    position: mappeRelativePositionOhneNull(eintrag.spielerPosition, bezugPosition),
    name: nameNachPosition.get(eintrag.spielerPosition) ?? eintrag.spielerPosition,
    ansage: eintrag.ansage
  }));
}

function mappeGesamtpunktestand(
  spielerAnsichten: SpielerAnsicht[],
  gesamtpunktestand: Partial<Record<BackendSpielerPosition, number>>
): PunktestandEintrag[] {
  return spielerAnsichten
    .filter((spieler) => spieler.absolutePosition !== null)
    .map((spieler) => ({
      position: spieler.position,
      name: spieler.name,
      punkte: gesamtpunktestand[spieler.absolutePosition ?? SPIELER_POSITION.SUED] ?? 0
    }));
}

function mappeLetzteAbgeschlosseneStiche(
  stiche: AbgeschlossenerStichAntwort[],
  spielerAnsichten: SpielerAnsicht[],
  bezugPosition: BackendSpielerPosition
): AbgeschlossenerStichAnsicht[] {
  const nameNachPosition = new Map(
    spielerAnsichten
      .filter((spieler) => spieler.absolutePosition !== null)
      .map((spieler) => [spieler.absolutePosition ?? SPIELER_POSITION.SUED, spieler.name] as const)
  );
  return stiche.map((stich) => ({
    spielNummer: stich.spielNummer,
    stichNummer: stich.stichNummer,
    aufspielerPosition: mappeRelativePositionOhneNull(stich.aufspielerPosition, bezugPosition),
    gewinnerPosition: mappeRelativePositionOhneNull(stich.gewinnerPosition, bezugPosition),
    gewinnerName: nameNachPosition.get(stich.gewinnerPosition) ?? stich.gewinnerPosition,
    augen: stich.augen,
    gespielteKarten: stich.gespielteKarten
      .slice()
      .sort((links, rechts) => links.reihenfolge - rechts.reihenfolge)
      .map((karte) => ({
        position: mappeRelativePositionOhneNull(karte.spielerPosition, bezugPosition),
        name: nameNachPosition.get(karte.spielerPosition) ?? karte.spielerPosition,
        karte: karte.karte,
        reihenfolge: karte.reihenfolge
      }))
  }));
}

function mappeLetztesSpielergebnis(
  ergebnis: LetztesSpielergebnisAntwort | null,
  spielerAnsichten: SpielerAnsicht[]
): LetztesSpielergebnisAnsicht | null {
  if (!ergebnis) {
    return null;
  }
  return {
    spielNummer: ergebnis.spielNummer,
    spieltyp: ergebnis.spieltyp,
    siegerPartei: ergebnis.siegerPartei,
    spielwert: ergebnis.spielwert,
    grundwert: ergebnis.grundwert,
    absagePunkte: ergebnis.absagePunkte,
    gegenDieAltenPunkte: ergebnis.gegenDieAltenPunkte,
    soloMultiplikator: ergebnis.soloMultiplikator,
    augenRe: ergebnis.augenProPartei.RE ?? 0,
    augenKontra: ergebnis.augenProPartei.KONTRA ?? 0,
    spielpunkte: mappeSpielpunkte(spielerAnsichten, ergebnis.spielpunkteProSpieler),
    sonderpunkteRe: ergebnis.sonderpunkteProPartei.RE ?? [],
    sonderpunkteKontra: ergebnis.sonderpunkteProPartei.KONTRA ?? [],
    punkteAufschluesselung: ergebnis.punkteAufschluesselung ?? []
  };
}

function mappeSpielpunkte(
  spielerAnsichten: SpielerAnsicht[],
  spielpunkte: Partial<Record<BackendSpielerPosition, number>>
): PunktestandEintrag[] {
  return spielerAnsichten
    .filter((spieler) => spieler.absolutePosition !== null)
    .map((spieler) => ({
      position: spieler.position,
      name: spieler.name,
      punkte: spielpunkte[spieler.absolutePosition ?? SPIELER_POSITION.SUED] ?? 0
    }));
}

function bestimmeArmutAktion(
  laufendesSpiel: LaufendesSpielAntwort,
  spielerAnsichten: SpielerAnsicht[],
  bezugPosition: BackendSpielerPosition
): ArmutAktionAnsicht | null {
  if (laufendesSpiel.phase !== 'ARMUT_TAUSCH' || mappeRelativePosition(laufendesSpiel.aktuellerSpieler, bezugPosition) !== SPIELER_POSITION.SUED) {
    return null;
  }

  const armutSpielerAbsolut = laufendesSpiel.armutSpielerPosition;
  if (!armutSpielerAbsolut) {
    return null;
  }

  const eigenerSpieler = spielerAnsichten.find((spieler) => spieler.istSelbst) ?? spielerAnsichten.find((spieler) => spieler.position === SPIELER_POSITION.SUED);
  if (!eigenerSpieler) {
    return null;
  }

  if (armutSpielerAbsolut === bezugPosition) {
    return {
      modus: 'ANBIETEN',
      kartenAnzahl: eigenerSpieler.sichtbareHandkarten.filter((karte) => istTrumpfFuerSpieltyp(karte, laufendesSpiel.spieltyp)).length,
      armutSpielerPosition: eigenerSpieler.position,
      armutSpielerName: eigenerSpieler.name
    };
  }

  const armutSpieler = spielerAnsichten.find((spieler) => spieler.absolutePosition === armutSpielerAbsolut);
  if (!armutSpieler) {
    return null;
  }

  return {
    modus: 'ANTWORTEN',
    kartenAnzahl: Math.max(0, eigenerSpieler.verbleibendeKarten - armutSpieler.verbleibendeKarten),
    armutSpielerPosition: armutSpieler.position,
    armutSpielerName: armutSpieler.name
  };
}

function mappeRelativePositionOhneNull(
  position: BackendSpielerPosition,
  bezugPosition: BackendSpielerPosition
): SpielerPosition {
  return mappeRelativePosition(position, bezugPosition) ?? SPIELER_POSITION.SUED;
}

function mappeRelativePosition(
  position: BackendSpielerPosition | null,
  bezugPosition: BackendSpielerPosition
): SpielerPosition | null {
  if (position === null) {
    return null;
  }
  const positionsIndex = ABSOLUTE_POSITIONEN.indexOf(position);
  const bezugsIndex = ABSOLUTE_POSITIONEN.indexOf(bezugPosition);
  if (positionsIndex < 0 || bezugsIndex < 0) {
    return position as SpielerPosition;
  }
  return POSITIONEN[(positionsIndex - bezugsIndex + POSITIONEN.length) % POSITIONEN.length];
}

function leererPlatz(position: SpielerPosition): SpielerAnsicht {
  return {
    position,
    absolutePosition: null,
    name: 'Freier Platz',
    anzeigeName: 'Freier Platz',
    avatarFarbe: null,
    istMensch: false,
    istSelbst: false,
    istErsteller: false,
    istGeber: false,
    verbleibendeKarten: 0,
    stiche: 0,
    istAktivHervorgehoben: false,
    partei: null,
    sichtbareHandkarten: []
  };
}

function mappeLobbySpieler(
  position: SpielerPosition,
  absolutePosition: BackendSpielerPosition,
  spieler: SpielerAmTischAntwort,
  tisch: TischAntwort,
  eigenerSpielerId: string | null
): SpielerAnsicht {
  const istEigenerSpieler = spieler.spielerId === eigenerSpielerId;
  const istImSpiel = tisch.status === 'IM_SPIEL';
  return {
    position,
    absolutePosition,
    name: spieler.name,
    anzeigeName: spieler.name,
    avatarFarbe: null,
    istMensch: !spieler.istKi,
    istSelbst: istEigenerSpieler,
    istErsteller: spieler.spielerId === tisch.erstelltVonSpielerId,
    istGeber: false,
    verbleibendeKarten: istImSpiel ? 12 : 0,
    stiche: 0,
    istAktivHervorgehoben: istEigenerSpieler || spieler.spielerId === tisch.erstelltVonSpielerId,
    partei: null,
    sichtbareHandkarten: []
  };
}

