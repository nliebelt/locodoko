import type {
  Ansage,
  KarteAntwort,
  LaufendesSpielAntwort,
  Partei,
  PartieStandAntwort,
  SpielerAmTischAntwort,
  SpielerImSpielAntwort,
  TischAntwort
} from '../modelle/SpielverwaltungDto';

export type SpielerPosition = 'SUED' | 'WEST' | 'NORD' | 'OST';

export interface SpielerAnsicht {
  position: SpielerPosition;
  name: string;
  istMensch: boolean;
  istErsteller: boolean;
  istGeber: boolean;
  verbleibendeKarten: number;
  stiche: number;
  statusText: string;
  istAktivHervorgehoben: boolean;
  partei: Partei | null;
  sichtbareHandkarten: KarteAntwort[];
}

export interface TischAnsichtModell {
  titel: string;
  untertitel: string;
  statusText: string;
  debugModus: boolean;
  spieltyp: LaufendesSpielAntwort['spieltyp'] | null;
  phase: LaufendesSpielAntwort['phase'] | null;
  aktuellerSpieler: SpielerPosition | null;
  spielbareKarten: string[];
  moeglicheAnsagen: Ansage[];
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
    spieltyp: null,
    phase: null,
    aktuellerSpieler: null,
    spielbareKarten: [],
    moeglicheAnsagen: [],
    moeglicheVorbehalte: [],
    spieler: [
      {
        position: 'SUED',
        name: spielerName,
        istMensch: true,
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
        name: 'KI West',
        istMensch: false,
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
        name: 'KI Nord',
        istMensch: false,
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
        name: 'KI Ost',
        istMensch: false,
        istErsteller: false,
        istGeber: false,
        verbleibendeKarten: 12,
        stiche: 0,
        statusText: 'KI',
        istAktivHervorgehoben: false,
        partei: null,
        sichtbareHandkarten: []
      }
    ]
  };
}

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
      spieltyp: null,
      phase: null,
      aktuellerSpieler: null,
      spielbareKarten: [],
      moeglicheAnsagen: [],
      moeglicheVorbehalte: [],
      spieler: []
    };
  }

  const laufendesSpiel = partieStand?.laufendesSpiel;
  const spielerAnsichten = laufendesSpiel
    ? mappeSpielerAusPartie(laufendesSpiel.spieler, tisch, laufendesSpiel.spieltyp)
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
    debugModus,
    spieltyp: laufendesSpiel?.spieltyp ?? null,
    phase: laufendesSpiel?.phase ?? null,
    aktuellerSpieler: laufendesSpiel?.aktuellerSpieler ?? null,
    spielbareKarten: laufendesSpiel?.spielbareKarten.map((karte) => karte.id) ?? [],
    moeglicheAnsagen: laufendesSpiel?.moeglicheAnsagen ?? [],
    moeglicheVorbehalte: laufendesSpiel?.moeglicheVorbehalte ?? [],
    spieler: spielerAnsichten
  };
}

function mappeSpielerAusPartie(
  spieler: SpielerImSpielAntwort[],
  tisch: TischAntwort,
  spieltyp: LaufendesSpielAntwort['spieltyp']
): SpielerAnsicht[] {
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
      istGeber: eintrag.istGeber,
      verbleibendeKarten: eintrag.verbleibendeKarten ?? 0,
      stiche: eintrag.gewonneneStiche,
      statusText: bildeStatusText(eintrag),
      istAktivHervorgehoben: eintrag.istAmZug || eintrag.istSelbst,
      partei: eintrag.partei,
      sichtbareHandkarten: sortiereSichtbareHandkarten(eintrag.sichtbareHandkarten ?? [], spieltyp)
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
  const linksTrumpf = istTrumpf(links, spieltyp);
  const rechtsTrumpf = istTrumpf(rechts, spieltyp);
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

function istTrumpf(karte: KarteAntwort, spieltyp: LaufendesSpielAntwort['spieltyp'] | null): boolean {
  switch (spieltyp) {
    case 'SOLO_DAME':
      return karte.wert === 'DAME';
    case 'SOLO_BUBE':
      return karte.wert === 'BUBE';
    case 'SOLO_FLEISCHLOS':
      return false;
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
