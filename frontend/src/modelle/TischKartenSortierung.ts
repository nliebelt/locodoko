import type { KarteAntwort, LaufendesSpielAntwort } from '../modelle/SpielverwaltungDto';

/** Prueft ob eine Karte im angegebenen Spieltyp als Trumpf gilt. */
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

export function sortiereSichtbareHandkarten(
  handkarten: KarteAntwort[],
  spieltyp: LaufendesSpielAntwort['spieltyp'] | null,
  schweinchenAktiv: boolean
): KarteAntwort[] {
  return [...handkarten].sort((links, rechts) => vergleicheKarten(links, rechts, spieltyp, schweinchenAktiv));
}

export function vergleicheKarten(
  links: KarteAntwort,
  rechts: KarteAntwort,
  spieltyp: LaufendesSpielAntwort['spieltyp'] | null,
  schweinchenAktiv: boolean
): number {
  const linksTrumpf = istTrumpfFuerSpieltyp(links, spieltyp);
  const rechtsTrumpf = istTrumpfFuerSpieltyp(rechts, spieltyp);
  if (linksTrumpf !== rechtsTrumpf) {
    return linksTrumpf ? -1 : 1;
  }
  if (linksTrumpf && rechtsTrumpf) {
    const rangDifferenz = trumpfRang(rechts, spieltyp, schweinchenAktiv) - trumpfRang(links, spieltyp, schweinchenAktiv);
    return rangDifferenz !== 0 ? rangDifferenz : links.id.localeCompare(rechts.id);
  }
  const farbenDifferenz = fehlFarbRang(links.farbe) - fehlFarbRang(rechts.farbe);
  if (farbenDifferenz !== 0) {
    return farbenDifferenz;
  }
  const wertDifferenz = fehlWertRang(rechts.wert) - fehlWertRang(links.wert);
  return wertDifferenz !== 0 ? wertDifferenz : links.id.localeCompare(rechts.id);
}

function trumpfRang(karte: KarteAntwort, spieltyp: LaufendesSpielAntwort['spieltyp'] | null, schweinchenAktiv: boolean): number {
  if (spieltyp === 'SOLO_DAME' || spieltyp === 'SOLO_BUBE') {
    return soloTrumpfRang(karte.farbe);
  }
  if (spieltyp === 'SOLO_TRUMPF_HERZ') return farbsoloTrumpfRang(karte, 'HERZ');
  if (spieltyp === 'SOLO_TRUMPF_PIK') return farbsoloTrumpfRang(karte, 'PIK');
  if (spieltyp === 'SOLO_TRUMPF_KREUZ') return farbsoloTrumpfRang(karte, 'KREUZ');
  return normaleTrumpfRang(karte, schweinchenAktiv);
}

// Trumpfrang im Farbsolo: Damen (Kreuz > Pik > Herz > Karo) > Buben > Farbtrümpfe (Ass > Zehn > König > Neun)
function farbsoloTrumpfRang(karte: KarteAntwort, trumpfFarbe: KarteAntwort['farbe']): number {
  if (karte.wert === 'DAME') {
    return ({ KREUZ: 12, PIK: 11, HERZ: 10, KARO: 9 } as Record<KarteAntwort['farbe'], number>)[karte.farbe] ?? 0;
  }
  if (karte.wert === 'BUBE') {
    return ({ KREUZ: 8, PIK: 7, HERZ: 6, KARO: 5 } as Record<KarteAntwort['farbe'], number>)[karte.farbe] ?? 0;
  }
  if (karte.farbe === trumpfFarbe) {
    return ({ AS: 4, ZEHN: 3, KOENIG: 2, NEUN: 1 } as Record<KarteAntwort['wert'], number>)[karte.wert] ?? 0;
  }
  return 0;
}

function soloTrumpfRang(farbe: KarteAntwort['farbe']): number {
  return ({
    KARO: 1,
    HERZ: 2,
    PIK: 3,
    KREUZ: 4
  } as Record<KarteAntwort['farbe'], number>)[farbe] ?? 0;
}

function normaleTrumpfRang(karte: KarteAntwort, schweinchenAktiv: boolean): number {
  if (schweinchenAktiv && karte.farbe === 'KARO' && karte.wert === 'AS') {
    return karte.exemplarIndex === 1 ? 14 : 15;
  }
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
