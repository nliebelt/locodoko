import { SPIELER_POSITION, PARTEI, SPIELTYP } from './SpielverwaltungDto';
import { sortiereSichtbareHandkarten, istTrumpfFuerSpieltyp } from './TischKartenSortierung';
import { POSITIONEN, ABSOLUTE_POSITIONEN, mappeRelativePosition, mappeRelativePositionOhneNull } from './SitzordnungModell';
import type { SpielerPosition } from './SitzordnungModell';
import type {
  AbgeschlossenerStichAntwort,
  AnsageEreignisAntwort,
  GespielteKarteAntwort,
  LaufendesSpielAntwort,
  LetztesSpielergebnisAntwort,
  SpielerAmTischAntwort,
  SpielerImSpielAntwort,
  SpielerPosition as BackendSpielerPosition,
  TischAntwort
} from './SpielverwaltungDto';
import type {
  ArmutAktionAnsicht,
  AnsageAnsicht,
  AbgeschlossenerStichAnsicht,
  GespielteKarteAnsicht,
  LetztesSpielergebnisAnsicht,
  PunktestandEintrag,
  SpielerAnsicht
} from './TischAnsichtModell';

export function berechneSpielerankuendigungstext(spiel: LaufendesSpielAntwort | null | undefined): string | null {
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

export function bestimmeBezugsPositionAusPartie(
  laufendesSpiel: LaufendesSpielAntwort,
  spielerId: string | null,
  tisch: TischAntwort
): BackendSpielerPosition {
  const ausSpiel = laufendesSpiel.spieler.find((spieler) => spieler.istSelbst || (spielerId !== null && spieler.spielerId === spielerId))?.position;
  return ausSpiel ?? bestimmeBezugsPositionAusTisch(spielerId, tisch);
}

export function bestimmeBezugsPositionAusTisch(spielerId: string | null, tisch: TischAntwort): BackendSpielerPosition {
  const eigenerIndex = spielerId ? tisch.spieler.findIndex((spieler) => spieler.spielerId === spielerId) : -1;
  return ABSOLUTE_POSITIONEN[eigenerIndex] ?? SPIELER_POSITION.SUED;
}

export function mappeSpielerAusPartie(
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

export function mappeSpielerAusTisch(
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

export function mappeAktuelleStichmitte(
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

export function mappeAnsageHistorie(
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

export function mappeGesamtpunktestand(
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

export function mappeLetzteAbgeschlosseneStiche(
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

export function mappeLetztesSpielergebnis(
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

export function mappeSpielpunkte(
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

export function bestimmeArmutAktion(
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
