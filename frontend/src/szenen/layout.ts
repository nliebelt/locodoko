/**
 * Zustandslose Layout- und Positionsberechnungen fuer die Tischdarstellung.
 * Alle Funktionen sind reine Utility-Funktionen ohne Seiteneffekte.
 *
 * <p>Hinweis (DISCO-Entscheidung S126): Mobile wird nur im Querformat unterstuetzt
 * (Orientierungssperre, siehe layout.css/#orientierung-hinweis). Die {@code isPortrait}-Zweige
 * bleiben bewusst als Fallback fuer Nicht-Touch-Hochformat-Fenster erhalten (z.B. schmal
 * gezogenes Desktop-Browserfenster) und sind durch layout.test.ts abgedeckt; auf echten
 * Touch-Geraeten greift praktisch nur der Landscape-Zweig.</p>
 */
import type { SpielerPosition } from '../modelle/TischAnsichtModell';
import { SPIELER_POSITION } from '../modelle/TischAnsichtModell';

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
  const versatzY = Math.round(hoehe * 0.07);
  const versatzX = Math.round(breite * 0.045);
  return {
    SUED: { x: mitteX,           y: mitteY + versatzY, winkel: -2 },
    WEST: { x: mitteX - versatzX, y: mitteY,            winkel: 87 },
    NORD: { x: mitteX,           y: mitteY - versatzY, winkel: 1 },
    OST:  { x: mitteX + versatzX, y: mitteY,            winkel: -92 }
  };
}



export function berechneKartenGroesse(breite: number): { w: number; h: number } {
  const fraction = breite < 800 ? 0.14 : 0.086;
  const w = Math.round(Math.min(110, breite * fraction));
  return { w, h: Math.round(w * (165 / 110)) };
}

export function berechneKartenAbstand(breite: number, hoehe: number): { horizontal: number; vertikal: number } {
  const isPortrait = hoehe > breite;
  return {
    horizontal: Math.max(isPortrait ? 44 : 22, Math.round(breite * (isPortrait ? 0.06 : 0.022))),
    vertikal: Math.max(isPortrait ? 22 : 12, Math.round(hoehe * (isPortrait ? 0.02 : 0.022)))
  };
}

export function berechneLayout(breite: number, hoehe: number): TischLayout {
  const isPortrait = hoehe > breite;
  if (isPortrait) {
    return {
      SUED: { x: breite * 0.5, y: hoehe * 0.82, kartenX: breite * 0.15, kartenY: hoehe * 0.85, kartenWinkel: 0 },
      WEST: { x: breite * 0.15, y: hoehe * 0.5, kartenX: breite * 0.12, kartenY: hoehe * 0.40, kartenWinkel: 90 },
      NORD: { x: breite * 0.5, y: hoehe * 0.18, kartenX: breite * 0.15, kartenY: hoehe * 0.18, kartenWinkel: 0 },
      OST: { x: breite * 0.85, y: hoehe * 0.5, kartenX: breite * 0.88, kartenY: hoehe * 0.40, kartenWinkel: 90 }
    };
  }
  return {
    SUED: { x: breite * 0.5, y: hoehe * 0.82, kartenX: breite * 0.28, kartenY: hoehe * 0.85, kartenWinkel: 0 },
    WEST: { x: breite * 0.12, y: hoehe * 0.5, kartenX: breite * 0.10, kartenY: hoehe * 0.40, kartenWinkel: 90 },
    NORD: { x: breite * 0.5, y: hoehe * 0.18, kartenX: breite * 0.28, kartenY: hoehe * 0.18, kartenWinkel: 0 },
    OST: { x: breite * 0.88, y: hoehe * 0.5, kartenX: breite * 0.90, kartenY: hoehe * 0.40, kartenWinkel: 90 }
  };
}

// Landscape NORD oben-MITTE (nicht oben-rechts): verhindert Kollision mit OST-Nameplate (0.90/0.15)
// und Überlappung mit NORD-Kartenfächer (oben-links, kartenX≈0.28).
const NAMEPLATE_REL_POS: Record<SpielerPosition, { portrait: { x: number; y: number }; landscape: { x: number; y: number } }> = {
  NORD: { portrait: { x: 0.85, y: 0.18 }, landscape: { x: 0.50, y: 0.12 } },
  SUED: { portrait: { x: 0.85, y: 0.85 }, landscape: { x: 0.76, y: 0.85 } },
  WEST: { portrait: { x: 0.20, y: 0.75 }, landscape: { x: 0.10, y: 0.85 } },
  OST:  { portrait: { x: 0.80, y: 0.25 }, landscape: { x: 0.90, y: 0.15 } },
};

export function nameplatePositionFuer(
  spielerPosition: SpielerPosition,
  breite: number,
  hoehe: number
): { x: number; y: number } {
  const modus = hoehe > breite ? 'portrait' : 'landscape';
  const rel = NAMEPLATE_REL_POS[spielerPosition][modus];
  return { x: breite * rel.x, y: hoehe * rel.y };
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
    case SPIELER_POSITION.SUED: {
      const fHalbe = kartenAnzahl > 0 ? ((kartenAnzahl - 1) * kAbstand.horizontal + kGroesse.w) / 2 : 0;
      return { x: breite / 2 - fHalbe - kGroesse.w / 2 - abstand, y: hoehe * 0.90, winkel: 0 };
    }
    case SPIELER_POSITION.NORD: {
      const fHalbe = kartenAnzahl > 0 ? ((kartenAnzahl - 1) * kAbstand.horizontal + kGroesse.w) / 2 : 0;
      return { x: breite / 2 + fHalbe + kGroesse.w / 2 + abstand, y: hoehe * 0.10, winkel: 0 };
    }
    case SPIELER_POSITION.WEST: {
      const fanOben = layout.WEST.kartenY - kGroesse.h / 2;
      return { x: layout.WEST.kartenX, y: fanOben - abstand, winkel: 90 };
    }
    case SPIELER_POSITION.OST: {
      const fanUnten = layout.OST.kartenY + (kartenAnzahl > 0 ? (kartenAnzahl - 1) * kAbstand.vertikal : 0) + kGroesse.h / 2;
      return { x: layout.OST.kartenX, y: fanUnten + 50, winkel: 90 };
    }
  }
}
