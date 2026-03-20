import type { PartieStandAntwort, SpielerAmTischAntwort, TischAntwort } from '../modelle/SpielverwaltungDto';

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
}

export interface TischAnsichtModell {
  titel: string;
  untertitel: string;
  statusText: string;
  debugModus: boolean;
  spieler: SpielerAnsicht[];
}

const POSITIONEN: SpielerPosition[] = ['SUED', 'WEST', 'NORD', 'OST'];

export function erstelleStandardTischAnsicht(spielerName: string): TischAnsichtModell {
  return {
    titel: 'Loco Doko',
    untertitel: 'Bereit fuer das erste Spiel',
    statusText: 'Warten auf weitere Spieler',
    debugModus: false,
    spieler: [
      { position: 'SUED', name: spielerName, istMensch: true, istErsteller: true, verbleibendeKarten: 12, stiche: 0, statusText: 'Du', istAktivHervorgehoben: true },
      { position: 'WEST', name: 'KI West', istMensch: false, istErsteller: false, verbleibendeKarten: 12, stiche: 0, statusText: 'KI', istAktivHervorgehoben: false },
      { position: 'NORD', name: 'KI Nord', istMensch: false, istErsteller: false, verbleibendeKarten: 12, stiche: 0, statusText: 'KI', istAktivHervorgehoben: false },
      { position: 'OST', name: 'KI Ost', istMensch: false, istErsteller: false, verbleibendeKarten: 12, stiche: 0, statusText: 'KI', istAktivHervorgehoben: false }
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
      spieler: []
    };
  }

  const eigenerIndex = spielerId ? tisch.spieler.findIndex((spieler) => spieler.spielerId === spielerId) : -1;
  const spielerInReihenfolge = ordneSpielerUm(tisch.spieler, eigenerIndex < 0 ? 0 : eigenerIndex);
  const spielerAnsichten = POSITIONEN.map((position, index) => {
    const spieler = spielerInReihenfolge[index];
    return spieler
      ? mappeSpieler(position, spieler, tisch, spielerId)
      : {
          position,
          name: 'Freier Platz',
          istMensch: false,
          istErsteller: false,
          verbleibendeKarten: 0,
          stiche: 0,
          statusText: 'Offen',
          istAktivHervorgehoben: false
        };
  });

  const statusText = tisch.status === 'IM_SPIEL'
    ? `Partie laeuft${partieStand ? ` · Spiel ${partieStand.gespielteSpiele + 1}/${partieStand.anzahlSpiele}` : ''}`
    : 'Warte auf Start oder weitere Spieler';

  return {
    titel: tisch.name,
    untertitel: tisch.status === 'IM_SPIEL' ? 'Top-Down-Tischansicht' : 'Tisch in der Lobby',
    statusText,
    debugModus: false,
    spieler: spielerAnsichten
  };
}

function ordneSpielerUm(spieler: SpielerAmTischAntwort[], startIndex: number): SpielerAmTischAntwort[] {
  if (spieler.length === 0) {
    return [];
  }

  const offset = ((startIndex % spieler.length) + spieler.length) % spieler.length;
  return [...spieler.slice(offset), ...spieler.slice(0, offset)];
}

function mappeSpieler(
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
    istAktivHervorgehoben: istEigenerSpieler || spieler.spielerId === tisch.erstelltVonSpielerId
  };
}
