import type { KarteAntwort, LaufendesSpielAntwort, PartieStandAntwort, SpielerAmTischAntwort, SpielerImSpielAntwort, TischAntwort } from '../modelle/SpielverwaltungDto';

export type SpielerPosition = 'SUED' | 'WEST' | 'NORD' | 'OST';

export interface SpielerAnsicht {
  position: SpielerPosition;
  name: string;
  istMensch: boolean;
  istErsteller: boolean;
  verbleibendeKarten: number;
  stiche: number;
  statusText: string;
  istAktivHervorgehoben: boolean;
  sichtbareHandkarten: KarteAntwort[];
}

export interface TischAnsichtModell {
  titel: string;
  untertitel: string;
  statusText: string;
  debugModus: boolean;
  aktuellerSpieler: SpielerPosition | null;
  spielbareKarten: string[];
  moeglicheVorbehalte: string[];
  spieler: SpielerAnsicht[];
}

const POSITIONEN: SpielerPosition[] = ['SUED', 'WEST', 'NORD', 'OST'];

export function erstelleStandardTischAnsicht(spielerName: string): TischAnsichtModell {
  return {
    titel: 'Loco Doko',
    untertitel: 'Bereit fuer das erste Spiel',
    statusText: 'Warten auf weitere Spieler',
    debugModus: false,
    aktuellerSpieler: null,
    spielbareKarten: [],
    moeglicheVorbehalte: [],
    spieler: [
      {
        position: 'SUED',
        name: spielerName,
        istMensch: true,
        istErsteller: true,
        verbleibendeKarten: 12,
        stiche: 0,
        statusText: 'Du',
        istAktivHervorgehoben: true,
        sichtbareHandkarten: []
      },
      {
        position: 'WEST',
        name: 'KI West',
        istMensch: false,
        istErsteller: false,
        verbleibendeKarten: 12,
        stiche: 0,
        statusText: 'KI',
        istAktivHervorgehoben: false,
        sichtbareHandkarten: []
      },
      {
        position: 'NORD',
        name: 'KI Nord',
        istMensch: false,
        istErsteller: false,
        verbleibendeKarten: 12,
        stiche: 0,
        statusText: 'KI',
        istAktivHervorgehoben: false,
        sichtbareHandkarten: []
      },
      {
        position: 'OST',
        name: 'KI Ost',
        istMensch: false,
        istErsteller: false,
        verbleibendeKarten: 12,
        stiche: 0,
        statusText: 'KI',
        istAktivHervorgehoben: false,
        sichtbareHandkarten: []
      }
    ]
  };
}

export function erstelleTischAnsichtAusStatus(
  spielerId: string | null,
  tisch: TischAntwort | null,
  partieStand: PartieStandAntwort | null
): TischAnsichtModell {
  if (!tisch) {
    return {
      titel: 'Loco Doko',
      untertitel: 'Noch kein Tisch geoeffnet',
      statusText: 'Bitte waehle in der Lobby einen Tisch aus.',
      debugModus: false,
      aktuellerSpieler: null,
      spielbareKarten: [],
      moeglicheVorbehalte: [],
      spieler: []
    };
  }

  const laufendesSpiel = partieStand?.laufendesSpiel;
  const spielerAnsichten = laufendesSpiel
    ? mappeSpielerAusPartie(laufendesSpiel.spieler, tisch)
    : mappeSpielerAusTisch(spielerId, tisch);

  const statusText = laufendesSpiel
    ? `${lesbarerPhasenText(laufendesSpiel.phase)} · Spiel ${laufendesSpiel.spielNummer}/${partieStand?.anzahlSpiele ?? tisch.konfiguration.anzahlSpiele}`
    : tisch.status === 'IM_SPIEL'
      ? `Partie laeuft${partieStand ? ` · Spiel ${partieStand.gespielteSpiele + 1}/${partieStand.anzahlSpiele}` : ''}`
      : 'Warte auf Start oder weitere Spieler';

  return {
    titel: tisch.name,
    untertitel: laufendesSpiel ? `Spieltyp ${laufendesSpiel.spieltyp}` : tisch.status === 'IM_SPIEL' ? 'Top-Down-Tischansicht' : 'Tisch in der Lobby',
    statusText,
    debugModus: false,
    aktuellerSpieler: laufendesSpiel?.aktuellerSpieler ?? null,
    spielbareKarten: laufendesSpiel?.spielbareKarten.map((karte) => karte.id) ?? [],
    moeglicheVorbehalte: laufendesSpiel?.moeglicheVorbehalte ?? [],
    spieler: spielerAnsichten
  };
}

function mappeSpielerAusPartie(spieler: SpielerImSpielAntwort[], tisch: TischAntwort): SpielerAnsicht[] {
  const nachPosition = new Map(spieler.map((eintrag) => [eintrag.position, eintrag] as const));
  return POSITIONEN.map((position) => {
    const eintrag = nachPosition.get(position);
    if (!eintrag) {
      return leererPlatz(position);
    }
    return {
      position,
      name: eintrag.name,
      istMensch: !eintrag.istKi,
      istErsteller: eintrag.spielerId === tisch.erstelltVonSpielerId,
      verbleibendeKarten: eintrag.verbleibendeKarten ?? 0,
      stiche: eintrag.gewonneneStiche,
      statusText: bildeStatusText(eintrag),
      istAktivHervorgehoben: eintrag.istAmZug || eintrag.istSelbst,
      sichtbareHandkarten: eintrag.sichtbareHandkarten ?? []
    };
  });
}

function mappeSpielerAusTisch(spielerId: string | null, tisch: TischAntwort): SpielerAnsicht[] {
  const eigenerIndex = spielerId ? tisch.spieler.findIndex((spieler) => spieler.spielerId === spielerId) : -1;
  const spielerInReihenfolge = ordneSpielerUm(tisch.spieler, eigenerIndex < 0 ? 0 : eigenerIndex);
  return POSITIONEN.map((position, index) => {
    const spieler = spielerInReihenfolge[index];
    return spieler ? mappeLobbySpieler(position, spieler, tisch, spielerId) : leererPlatz(position);
  });
}

function leererPlatz(position: SpielerPosition): SpielerAnsicht {
  return {
    position,
    name: 'Freier Platz',
    istMensch: false,
    istErsteller: false,
    verbleibendeKarten: 0,
    stiche: 0,
    statusText: 'Offen',
    istAktivHervorgehoben: false,
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

function ordneSpielerUm(spieler: SpielerAmTischAntwort[], startIndex: number): SpielerAmTischAntwort[] {
  if (spieler.length === 0) {
    return [];
  }

  const offset = ((startIndex % spieler.length) + spieler.length) % spieler.length;
  return [...spieler.slice(offset), ...spieler.slice(0, offset)];
}

function mappeLobbySpieler(
  position: SpielerPosition,
  spieler: SpielerAmTischAntwort,
  tisch: TischAntwort,
  eigenerSpielerId: string | null
): SpielerAnsicht {
  const istEigenerSpieler = spieler.spielerId === eigenerSpielerId;
  const istImSpiel = tisch.status === 'IM_SPIEL';
  return {
    position,
    name: spieler.name,
    istMensch: !spieler.istKi,
    istErsteller: spieler.spielerId === tisch.erstelltVonSpielerId,
    verbleibendeKarten: istImSpiel ? 12 : 0,
    stiche: 0,
    statusText: istEigenerSpieler ? 'Du' : spieler.istKi ? 'KI' : 'Mitspieler',
    istAktivHervorgehoben: istEigenerSpieler || spieler.spielerId === tisch.erstelltVonSpielerId,
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
