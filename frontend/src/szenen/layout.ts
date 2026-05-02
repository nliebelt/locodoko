/**
 * Zustandslose Layout- und Positionsberechnungen fuer die Tischdarstellung.
 * Alle Funktionen sind reine Utility-Funktionen ohne Seiteneffekte.
 */
import type { SpielerPosition } from '../modelle/TischAnsichtModell';

export interface TischLayoutEintrag {
  x: number;
  y: number;
  kartenX: number;
  kartenY: number;
  kartenWinkel: number;
}

export type TischLayout = Record<SpielerPosition, TischLayoutEintrag>;

export function stichSlotPositionen(
  mitteX: number, mitteY: number, breite: number, hoehe: number
): Record<SpielerPosition, { x: number; y: number; winkel: number }> {
  const versatzY = Math.round(hoehe * 0.15);
  const versatzX = Math.round(breite * 0.103);
  return {
    SUED: { x: mitteX,           y: mitteY + versatzY, winkel: -4 },
    WEST: { x: mitteX - versatzX, y: mitteY,            winkel:  6 },
    NORD: { x: mitteX,           y: mitteY - versatzY, winkel:  3 },
    OST:  { x: mitteX + versatzX, y: mitteY,            winkel: -5 }
  };
}

export function berechneKartenGroesse(breite: number): { w: number; h: number } {
  const w = Math.round(Math.min(110, breite * 0.086));
  return { w, h: Math.round(w * (165 / 110)) };
}

export function berechneKartenAbstand(breite: number, hoehe: number): { horizontal: number; vertikal: number } {
  return {
    horizontal: Math.max(22, Math.round(breite * 0.022)),
    vertikal: Math.max(12, Math.round(hoehe * 0.022))
  };
}

export function berechneLayout(breite: number, hoehe: number): TischLayout {
  return {
    SUED: { x: breite * 0.5, y: hoehe * 0.82, kartenX: breite * 0.28, kartenY: hoehe * 0.91, kartenWinkel: 0 },
    WEST: { x: breite * 0.12, y: hoehe * 0.5, kartenX: breite * 0.03, kartenY: hoehe * 0.37, kartenWinkel: 90 },
    NORD: { x: breite * 0.5, y: hoehe * 0.18, kartenX: breite * 0.28, kartenY: hoehe * 0.01, kartenWinkel: 0 },
    OST: { x: breite * 0.88, y: hoehe * 0.5, kartenX: breite * 0.97, kartenY: hoehe * 0.37, kartenWinkel: 90 }
  };
}

export function nameplatePositionFuer(
  spielerPosition: SpielerPosition,
  breite: number,
  hoehe: number
): { x: number; y: number } {
  switch (spielerPosition) {
    case 'NORD': return { x: breite * 0.5, y: hoehe * 0.15 };
    case 'SUED': return { x: breite * 0.5, y: hoehe * 0.85 };
    case 'WEST': return { x: breite * 0.14, y: hoehe * 0.84 };
    case 'OST':  return { x: breite * 0.86, y: hoehe * 0.16 };
  }
}

export function stichStapelPositionFuer(
  position: SpielerPosition,
  breite: number,
  hoehe: number,
  kartenAnzahl: number
): { x: number; y: number; winkel: number } {
  const kAbstand = berechneKartenAbstand(breite, hoehe);
  const kGroesse = berechneKartenGroesse(breite);
  const layout = berechneLayout(breite, hoehe);
  const abstand = 12;

  switch (position) {
    case 'SUED': {
      const fHalbe = kartenAnzahl > 0 ? ((kartenAnzahl - 1) * kAbstand.horizontal + kGroesse.w) / 2 : 0;
      return { x: breite / 2 - fHalbe - kGroesse.w / 2 - abstand, y: hoehe * 0.90, winkel: 0 };
    }
    case 'NORD': {
      const fHalbe = kartenAnzahl > 0 ? ((kartenAnzahl - 1) * kAbstand.horizontal + kGroesse.w) / 2 : 0;
      return { x: breite / 2 + fHalbe + kGroesse.w / 2 + abstand, y: hoehe * 0.10, winkel: 0 };
    }
    case 'WEST': {
      const fanOben = layout.WEST.kartenY - kGroesse.h / 2;
      return { x: layout.WEST.kartenX, y: fanOben - abstand, winkel: 90 };
    }
    case 'OST': {
      const fanUnten = layout.OST.kartenY + (kartenAnzahl > 0 ? (kartenAnzahl - 1) * kAbstand.vertikal : 0) + kGroesse.h / 2;
      return { x: layout.OST.kartenX, y: fanUnten + 50, winkel: 90 };
    }
  }
}
