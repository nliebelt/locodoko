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
  Sonderpunkt,
  SpielerAmTischAntwort,
  SpielerImSpielAntwort,
  SpielerPosition as BackendSpielerPosition,
  Tischhintergrund,
  TischAntwort,
  VorbehaltAnsage
} from '../modelle/SpielverwaltungDto';

/** Relative Sitzposition eines Spielers aus Sicht des eigenen Spielers (SUED = ich). */
export type SpielerPosition = 'SUED' | 'WEST' | 'NORD' | 'OST';

/**
 * View-Repraesentation eines einzelnen Spielers am Tisch.
 * Enthaelt alle Daten, die die TischSzene fuer die Darstellung benoetigt,
 * inklusive relativer Sitzposition und sichtbarer Handkarten (nur im Debug-Modus).
 */
export interface SpielerAnsicht {
  position: SpielerPosition;
  absolutePosition: BackendSpielerPosition | null;
  name: string;
  istMensch: boolean;
  istSelbst: boolean;
  istErsteller: boolean;
  istGeber: boolean;
  verbleibendeKarten: number;
  stiche: number;
  statusText: string;
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
 * Enthaelt Siegerpartei, Spielwert, Augenstand und Sonderpunkte beider Parteien.
 */
export interface LetztesSpielergebnisAnsicht {
  spielNummer: number;
  spieltyp: LaufendesSpielAntwort['spieltyp'];
  siegerPartei: Partei;
  spielwert: number;
  augenRe: number;
  augenKontra: number;
  spielpunkte: PunktestandEintrag[];
  sonderpunkteRe: Sonderpunkt[];
  sonderpunkteKontra: Sonderpunkt[];
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
  statusText: string;
  debugModus: boolean;
  tischhintergrund: Tischhintergrund;
  spieltyp: LaufendesSpielAntwort['spieltyp'] | null;
  phase: LaufendesSpielAntwort['phase'] | null;
  aktuellerSpieler: SpielerPosition | null;
  spielbareKarten: string[];
  moeglicheAnsagen: Ansage[];
  moeglicheVorbehalte: VorbehaltAnsage[];
  spieler: SpielerAnsicht[];
  aktuelleStichmitte: GespielteKarteAnsicht[];
  ansageHistorie: AnsageAnsicht[];
  gesamtpunktestand: PunktestandEintrag[];
  letzteAbgeschlosseneStiche: AbgeschlossenerStichAnsicht[];
  letztesSpielergebnis: LetztesSpielergebnisAnsicht | null;
  /** true, wenn die gesamte Partie (alle Spiele) beendet ist — loest Partie-Ende-Modal aus. */
  partieBeendet: boolean;
  armutAktion: ArmutAktionAnsicht | null;
}

const POSITIONEN: SpielerPosition[] = ['SUED', 'WEST', 'NORD', 'OST'];
const ABSOLUTE_POSITIONEN: BackendSpielerPosition[] = ['SUED', 'WEST', 'NORD', 'OST'];

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
    statusText: 'Warten auf weitere Spieler',
    debugModus: false,
    tischhintergrund: 'FILZ_GRUEN',
    spieltyp: null,
    phase: null,
    aktuellerSpieler: null,
    spielbareKarten: [],
    moeglicheAnsagen: [],
    moeglicheVorbehalte: [],
    spieler: [
      {
        position: 'SUED',
        absolutePosition: 'SUED',
        name: spielerName,
        istMensch: true,
        istSelbst: true,
        istErsteller: true,
        istGeber: false,
        verbleibendeKarten: 12,
        stiche: 0,
        statusText: 'Du',
        istAktivHervorgehoben: true,
        partei: null,
        sichtbareHandkarten: []
      },
      {
        position: 'WEST',
        absolutePosition: 'WEST',
        name: 'KI West',
        istMensch: false,
        istSelbst: false,
        istErsteller: false,
        istGeber: false,
        verbleibendeKarten: 12,
        stiche: 0,
        statusText: 'KI',
        istAktivHervorgehoben: false,
        partei: null,
        sichtbareHandkarten: []
      },
      {
        position: 'NORD',
        absolutePosition: 'NORD',
        name: 'KI Nord',
        istMensch: false,
        istSelbst: false,
        istErsteller: false,
        istGeber: false,
        verbleibendeKarten: 12,
        stiche: 0,
        statusText: 'KI',
        istAktivHervorgehoben: false,
        partei: null,
        sichtbareHandkarten: []
      },
      {
        position: 'OST',
        absolutePosition: 'OST',
        name: 'KI Ost',
        istMensch: false,
        istSelbst: false,
        istErsteller: false,
        istGeber: false,
        verbleibendeKarten: 12,
        stiche: 0,
        statusText: 'KI',
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
    armutAktion: null
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
       statusText: 'Bitte waehle in der Lobby einen Tisch aus.',
       debugModus,
       tischhintergrund: 'FILZ_GRUEN',
       spieltyp: null,
      phase: null,
      aktuellerSpieler: null,
      spielbareKarten: [],
      moeglicheAnsagen: [],
      moeglicheVorbehalte: [],
      spieler: [],
      aktuelleStichmitte: [],
      ansageHistorie: [],
      gesamtpunktestand: [],
      letzteAbgeschlosseneStiche: [],
      letztesSpielergebnis: null,
      partieBeendet: false,
      armutAktion: null
    };
  }

  const laufendesSpiel = partieStand?.laufendesSpiel;
  const bezugPosition = laufendesSpiel
    ? bestimmeBezugsPositionAusPartie(laufendesSpiel, spielerId, tisch)
    : bestimmeBezugsPositionAusTisch(spielerId, tisch);
  const spielerAnsichten = laufendesSpiel
    ? mappeSpielerAusPartie(laufendesSpiel.spieler, tisch, laufendesSpiel.spieltyp, bezugPosition)
    : mappeSpielerAusTisch(spielerId, tisch, bezugPosition);

  const statusText = laufendesSpiel
    ? `${lesbarerPhasenText(laufendesSpiel.phase)} · Spiel ${laufendesSpiel.spielNummer}/${partieStand?.anzahlSpiele ?? tisch.konfiguration.anzahlSpiele}`
    : partieStand?.letztesSpielergebnis
      ? `Letzte Auswertung abgeschlossen · Spiel ${partieStand.gespielteSpiele}/${partieStand.anzahlSpiele}`
    : tisch.status === 'IM_SPIEL'
      ? `Partie laeuft${partieStand ? ` · Spiel ${partieStand.gespielteSpiele + 1}/${partieStand.anzahlSpiele}` : ''}`
      : 'Warte auf Start oder weitere Spieler';

  return {
    titel: tisch.name,
    untertitel: laufendesSpiel
      ? `Spieltyp ${laufendesSpiel.spieltyp}`
      : partieStand?.letztesSpielergebnis
        ? `Letzte Auswertung · ${partieStand.letztesSpielergebnis.spieltyp}`
        : tisch.status === 'IM_SPIEL'
          ? 'Top-Down-Tischansicht'
          : 'Tisch in der Lobby',
    statusText,
    debugModus,
    tischhintergrund: tisch.konfiguration.tischhintergrund,
    spieltyp: laufendesSpiel?.spieltyp ?? null,
    phase: laufendesSpiel?.phase ?? null,
    aktuellerSpieler: mappeRelativePosition(laufendesSpiel?.aktuellerSpieler ?? null, bezugPosition),
    spielbareKarten: laufendesSpiel?.spielbareKarten.map((karte) => karte.id) ?? [],
    moeglicheAnsagen: laufendesSpiel?.moeglicheAnsagen ?? [],
    moeglicheVorbehalte: laufendesSpiel?.moeglicheVorbehalte ?? [],
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
    armutAktion: laufendesSpiel ? bestimmeArmutAktion(laufendesSpiel, spielerAnsichten, bezugPosition) : null
  };
}

/**
 * Prueft ob eine Karte im angegebenen Spieltyp als Trumpf gilt.
 * Wird fuer die visuelle Hervorhebung von Trumpfkarten in der Hand verwendet.
 * @param karte - Zu pruefende Karte
 * @param spieltyp - Aktueller Spieltyp (null = kein laufendes Spiel, Standard-Trumpf-Logik)
 * @returns true wenn die Karte Trumpf ist
 */
export function istTrumpfFuerSpieltyp(
  karte: KarteAntwort,
  spieltyp: LaufendesSpielAntwort['spieltyp'] | null
): boolean {
  switch (spieltyp) {
    case 'SOLO_DAME':
      return karte.wert === 'DAME';
    case 'SOLO_BUBE':
      return karte.wert === 'BUBE';
    case 'SOLO_FLEISCHLOS':
      return false;
    case 'SOLO_TRUMPF_HERZ':
      return karte.wert === 'DAME' || karte.wert === 'BUBE' || karte.farbe === 'HERZ';
    case 'SOLO_TRUMPF_PIK':
      return karte.wert === 'DAME' || karte.wert === 'BUBE' || karte.farbe === 'PIK';
    case 'SOLO_TRUMPF_KREUZ':
      return karte.wert === 'DAME' || karte.wert === 'BUBE' || karte.farbe === 'KREUZ';
    case 'SOLO_TRUMPF':
    case 'NORMALSPIEL':
    case 'HOCHZEIT':
    case 'ARMUT':
    default:
      return karte.wert === 'DAME'
        || karte.wert === 'BUBE'
        || karte.farbe === 'KARO'
        || (karte.farbe === 'HERZ' && karte.wert === 'ZEHN');
  }
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
  return ABSOLUTE_POSITIONEN[eigenerIndex] ?? 'SUED';
}

function mappeSpielerAusPartie(
  spieler: SpielerImSpielAntwort[],
  tisch: TischAntwort,
  spieltyp: LaufendesSpielAntwort['spieltyp'],
  bezugPosition: BackendSpielerPosition
): SpielerAnsicht[] {
  const nachPosition = new Map<SpielerPosition, SpielerAnsicht>();
  spieler.forEach((eintrag) => {
    const position = mappeRelativePositionOhneNull(eintrag.position, bezugPosition);
    nachPosition.set(position, {
      position,
      absolutePosition: eintrag.position,
      name: eintrag.name,
      istMensch: !eintrag.istKi,
      istSelbst: eintrag.istSelbst,
      istErsteller: eintrag.spielerId === tisch.erstelltVonSpielerId,
      istGeber: eintrag.istGeber,
      verbleibendeKarten: eintrag.verbleibendeKarten ?? 0,
      stiche: eintrag.gewonneneStiche,
      statusText: bildeStatusText(eintrag),
      istAktivHervorgehoben: eintrag.istAmZug || eintrag.istSelbst,
      partei: eintrag.partei,
      sichtbareHandkarten: sortiereSichtbareHandkarten(eintrag.sichtbareHandkarten ?? [], spieltyp)
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
    const absolutePosition = ABSOLUTE_POSITIONEN[index] ?? 'SUED';
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
      punkte: gesamtpunktestand[spieler.absolutePosition ?? 'SUED'] ?? 0
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
      .map((spieler) => [spieler.absolutePosition ?? 'SUED', spieler.name] as const)
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
    augenRe: ergebnis.augenProPartei.RE ?? 0,
    augenKontra: ergebnis.augenProPartei.KONTRA ?? 0,
    spielpunkte: mappeSpielpunkte(spielerAnsichten, ergebnis.spielpunkteProSpieler),
    sonderpunkteRe: ergebnis.sonderpunkteProPartei.RE ?? [],
    sonderpunkteKontra: ergebnis.sonderpunkteProPartei.KONTRA ?? []
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
      punkte: spielpunkte[spieler.absolutePosition ?? 'SUED'] ?? 0
    }));
}

function bestimmeArmutAktion(
  laufendesSpiel: LaufendesSpielAntwort,
  spielerAnsichten: SpielerAnsicht[],
  bezugPosition: BackendSpielerPosition
): ArmutAktionAnsicht | null {
  if (laufendesSpiel.phase !== 'ARMUT_TAUSCH' || mappeRelativePosition(laufendesSpiel.aktuellerSpieler, bezugPosition) !== 'SUED') {
    return null;
  }

  const eigenerSpieler = spielerAnsichten.find((spieler) => spieler.istSelbst) ?? spielerAnsichten.find((spieler) => spieler.position === 'SUED');
  if (!eigenerSpieler) {
    return null;
  }

  const armutSpieler = spielerAnsichten
    .filter((spieler) => spieler.absolutePosition !== null)
    .reduce<SpielerAnsicht | null>((kleinsteHand, spieler) => {
      if (!kleinsteHand || spieler.verbleibendeKarten < kleinsteHand.verbleibendeKarten) {
        return spieler;
      }
      return kleinsteHand;
    }, null);

  if (!armutSpieler) {
    return null;
  }

  const kartenDifferenz = Math.max(0, eigenerSpieler.verbleibendeKarten - armutSpieler.verbleibendeKarten);
  if (kartenDifferenz > 0) {
    return {
      modus: 'ANTWORTEN',
      kartenAnzahl: kartenDifferenz,
      armutSpielerPosition: armutSpieler.position,
      armutSpielerName: armutSpieler.name
    };
  }

  return {
    modus: 'ANBIETEN',
    kartenAnzahl: eigenerSpieler.sichtbareHandkarten.filter((karte) => istTrumpfFuerSpieltyp(karte, laufendesSpiel.spieltyp)).length,
    armutSpielerPosition: eigenerSpieler.position,
    armutSpielerName: eigenerSpieler.name
  };
}

function mappeRelativePositionOhneNull(
  position: BackendSpielerPosition,
  bezugPosition: BackendSpielerPosition
): SpielerPosition {
  return mappeRelativePosition(position, bezugPosition) ?? 'SUED';
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
    istMensch: false,
    istSelbst: false,
    istErsteller: false,
    istGeber: false,
    verbleibendeKarten: 0,
    stiche: 0,
    statusText: 'Offen',
    istAktivHervorgehoben: false,
    partei: null,
    sichtbareHandkarten: []
  };
}

function lesbarerPhasenText(phase: LaufendesSpielAntwort['phase']): string {
  switch (phase) {
    case 'VORBEHALT_ANSAGE':
      return 'Vorbehalte ansagen';
    case 'VORBEHALT_AUFLOESUNG':
      return 'Vorbehalte aufloesen';
    case 'ARMUT_TAUSCH':
      return 'Armut tauschen';
    case 'STICHPHASE':
      return 'Stichphase';
    case 'AUSWERTUNG':
      return 'Auswertung';
    case 'GESAMTSTAND_AKTUALISIEREN':
      return 'Gesamtstand';
    case 'KARTEN_AUSTEILEN':
    default:
      return 'Karten austeilen';
  }
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
    istMensch: !spieler.istKi,
    istSelbst: istEigenerSpieler,
    istErsteller: spieler.spielerId === tisch.erstelltVonSpielerId,
    istGeber: false,
    verbleibendeKarten: istImSpiel ? 12 : 0,
    stiche: 0,
    statusText: istEigenerSpieler ? 'Du' : spieler.istKi ? 'KI' : 'Mitspieler',
    istAktivHervorgehoben: istEigenerSpieler || spieler.spielerId === tisch.erstelltVonSpielerId,
    partei: null,
    sichtbareHandkarten: []
  };
}

function bildeStatusText(spieler: SpielerImSpielAntwort): string {
  if (spieler.istSelbst) {
    return spieler.istAmZug ? 'Du bist dran' : 'Du';
  }
  if (spieler.istAmZug) {
    return 'Am Zug';
  }
  if (spieler.istKi) {
    return 'KI';
  }
  return 'Mitspieler';
}

function sortiereSichtbareHandkarten(
  handkarten: KarteAntwort[],
  spieltyp: LaufendesSpielAntwort['spieltyp'] | null
): KarteAntwort[] {
  return [...handkarten].sort((links, rechts) => vergleicheKarten(links, rechts, spieltyp));
}

function vergleicheKarten(
  links: KarteAntwort,
  rechts: KarteAntwort,
  spieltyp: LaufendesSpielAntwort['spieltyp'] | null
): number {
  const linksTrumpf = istTrumpfFuerSpieltyp(links, spieltyp);
  const rechtsTrumpf = istTrumpfFuerSpieltyp(rechts, spieltyp);
  if (linksTrumpf !== rechtsTrumpf) {
    return linksTrumpf ? -1 : 1;
  }

  if (linksTrumpf && rechtsTrumpf) {
    const rangDifferenz = trumpfRang(rechts, spieltyp) - trumpfRang(links, spieltyp);
    return rangDifferenz !== 0 ? rangDifferenz : links.id.localeCompare(rechts.id);
  }

  const farbenDifferenz = fehlFarbRang(links.farbe) - fehlFarbRang(rechts.farbe);
  if (farbenDifferenz !== 0) {
    return farbenDifferenz;
  }
  const wertDifferenz = fehlWertRang(rechts.wert) - fehlWertRang(links.wert);
  return wertDifferenz !== 0 ? wertDifferenz : links.id.localeCompare(rechts.id);
}

function trumpfRang(karte: KarteAntwort, spieltyp: LaufendesSpielAntwort['spieltyp'] | null): number {
  if (spieltyp === 'SOLO_DAME' || spieltyp === 'SOLO_BUBE') {
    return soloTrumpfRang(karte.farbe);
  }
  return normaleTrumpfRang(karte);
}

function soloTrumpfRang(farbe: KarteAntwort['farbe']): number {
  return ({
    KARO: 1,
    HERZ: 2,
    PIK: 3,
    KREUZ: 4
  } as Record<KarteAntwort['farbe'], number>)[farbe] ?? 0;
}

function normaleTrumpfRang(karte: KarteAntwort): number {
  const schluessel = `${karte.farbe}-${karte.wert}`;
  return ({
    'KARO-NEUN': 1,
    'KARO-KOENIG': 2,
    'KARO-ZEHN': 3,
    'KARO-AS': 4,
    'KARO-BUBE': 5,
    'HERZ-BUBE': 6,
    'PIK-BUBE': 7,
    'KREUZ-BUBE': 8,
    'KARO-DAME': 9,
    'HERZ-DAME': 10,
    'PIK-DAME': 11,
    'KREUZ-DAME': 12,
    'HERZ-ZEHN': 13
  } as Record<string, number>)[schluessel] ?? 0;
}

function fehlFarbRang(farbe: KarteAntwort['farbe']): number {
  return ({
    KREUZ: 1,
    PIK: 2,
    HERZ: 3,
    KARO: 4
  } as Record<KarteAntwort['farbe'], number>)[farbe] ?? 99;
}

function fehlWertRang(wert: KarteAntwort['wert']): number {
  return ({
    NEUN: 1,
    BUBE: 2,
    DAME: 3,
    KOENIG: 4,
    ZEHN: 5,
    AS: 6
  } as Record<KarteAntwort['wert'], number>)[wert] ?? 0;
}
