import { describe, expect, it } from 'vitest';
import {
  berechneSpielerankuendigungstext,
  bestimmeBezugsPositionAusTisch,
  bestimmeBezugsPositionAusPartie,
  bestimmeArmutAktion
} from './TischAnsichtMapper';
import { istTrumpfFuerSpieltyp, sortiereSichtbareHandkarten } from './TischKartenSortierung';
import type { KarteAntwort, LaufendesSpielAntwort, TischAntwort } from './SpielverwaltungDto';

function karte(farbe: KarteAntwort['farbe'], wert: KarteAntwort['wert'], idx = 1): KarteAntwort {
  return { id: `${farbe}-${wert}-${idx}`, farbe, wert, exemplarIndex: idx };
}

const minimalTisch: TischAntwort = {
  id: 'tisch-1',
  einladungsCode: 'ABCD',
  zugangsmodus: 'OFFEN',
  name: 'Test',
  status: 'WARTEND',
  erstelltVonSpielerId: 'spieler-1',
  partieId: null,
  konfiguration: {} as never,
  spieler: [
    { spielerId: 'spieler-1', name: 'Anna', istKi: false },
    { spielerId: 'spieler-2', name: 'Ben', istKi: false },
    { spielerId: 'spieler-3', name: 'Clara', istKi: false },
    { spielerId: 'spieler-4', name: 'Dirk', istKi: false }
  ]
};

describe('istTrumpfFuerSpieltyp', () => {
  it('SOLO_DAME: nur Damen sind Trumpf', () => {
    expect(istTrumpfFuerSpieltyp(karte('PIK', 'DAME'), 'SOLO_DAME')).toBe(true);
    expect(istTrumpfFuerSpieltyp(karte('KREUZ', 'BUBE'), 'SOLO_DAME')).toBe(false);
    expect(istTrumpfFuerSpieltyp(karte('KARO', 'AS'), 'SOLO_DAME')).toBe(false);
  });

  it('SOLO_BUBE: nur Buben sind Trumpf', () => {
    expect(istTrumpfFuerSpieltyp(karte('HERZ', 'BUBE'), 'SOLO_BUBE')).toBe(true);
    expect(istTrumpfFuerSpieltyp(karte('HERZ', 'DAME'), 'SOLO_BUBE')).toBe(false);
  });

  it('SOLO_FLEISCHLOS: keine Karte ist Trumpf', () => {
    expect(istTrumpfFuerSpieltyp(karte('KREUZ', 'DAME'), 'SOLO_FLEISCHLOS')).toBe(false);
    expect(istTrumpfFuerSpieltyp(karte('KARO', 'NEUN'), 'SOLO_FLEISCHLOS')).toBe(false);
  });

  it('SOLO_TRUMPF_HERZ: Damen, Buben und Herz sind Trumpf', () => {
    expect(istTrumpfFuerSpieltyp(karte('KARO', 'DAME'), 'SOLO_TRUMPF_HERZ')).toBe(true);
    expect(istTrumpfFuerSpieltyp(karte('PIK', 'BUBE'), 'SOLO_TRUMPF_HERZ')).toBe(true);
    expect(istTrumpfFuerSpieltyp(karte('HERZ', 'KOENIG'), 'SOLO_TRUMPF_HERZ')).toBe(true);
    expect(istTrumpfFuerSpieltyp(karte('KREUZ', 'AS'), 'SOLO_TRUMPF_HERZ')).toBe(false);
    // Herz-Zehn ist Trumpf (Farbtrumpf), KEINE Dulle
    expect(istTrumpfFuerSpieltyp(karte('HERZ', 'ZEHN'), 'SOLO_TRUMPF_HERZ')).toBe(true);
  });

  it('SOLO_TRUMPF_PIK: Damen, Buben und Pik sind Trumpf', () => {
    expect(istTrumpfFuerSpieltyp(karte('PIK', 'AS'), 'SOLO_TRUMPF_PIK')).toBe(true);
    expect(istTrumpfFuerSpieltyp(karte('HERZ', 'ZEHN'), 'SOLO_TRUMPF_PIK')).toBe(false);
    expect(istTrumpfFuerSpieltyp(karte('KARO', 'BUBE'), 'SOLO_TRUMPF_PIK')).toBe(true);
  });

  it('SOLO_TRUMPF_KREUZ: Damen, Buben und Kreuz sind Trumpf', () => {
    expect(istTrumpfFuerSpieltyp(karte('KREUZ', 'KOENIG'), 'SOLO_TRUMPF_KREUZ')).toBe(true);
    expect(istTrumpfFuerSpieltyp(karte('PIK', 'AS'), 'SOLO_TRUMPF_KREUZ')).toBe(false);
  });

  it('NORMALSPIEL/HOCHZEIT/ARMUT: Damen, Buben, Karo und Herz-Zehn sind Trumpf', () => {
    expect(istTrumpfFuerSpieltyp(karte('KARO', 'NEUN'), 'NORMALSPIEL')).toBe(true);
    expect(istTrumpfFuerSpieltyp(karte('HERZ', 'ZEHN'), 'NORMALSPIEL')).toBe(true);
    expect(istTrumpfFuerSpieltyp(karte('HERZ', 'KOENIG'), 'NORMALSPIEL')).toBe(false);
    expect(istTrumpfFuerSpieltyp(karte('KARO', 'AS'), 'HOCHZEIT')).toBe(true);
    expect(istTrumpfFuerSpieltyp(karte('PIK', 'AS'), 'ARMUT')).toBe(false);
  });

  it('SOLO_TRUMPF: verhält sich wie Normalspiel', () => {
    expect(istTrumpfFuerSpieltyp(karte('KARO', 'KOENIG'), 'SOLO_TRUMPF')).toBe(true);
    expect(istTrumpfFuerSpieltyp(karte('PIK', 'KOENIG'), 'SOLO_TRUMPF')).toBe(false);
  });
});

describe('sortiereSichtbareHandkarten', () => {
  it('trennt Trümpfe von Fehlfarben und sortiert innerhalb', () => {
    const hand = [
      karte('KREUZ', 'AS'),
      karte('KARO', 'NEUN'),
      karte('HERZ', 'ZEHN'),
      karte('PIK', 'AS')
    ];
    const sortiert = sortiereSichtbareHandkarten(hand, 'NORMALSPIEL', false);
    // Karo-Neun (Trumpf), Herz-Zehn (Dulle, höchster Trumpf ohne Schweinchen) vor Fehlfarben
    expect(sortiert[0].id).toBe('HERZ-ZEHN-1'); // Dulle, Rang 13
    expect(sortiert[1].id).toBe('KARO-NEUN-1'); // Trumpf, Rang 1
    // Fehlfarben: PIK-AS (fehlFarb 2) vor KREUZ-AS (fehlFarb 1)? Kreuz=1, Pik=2, so Kreuz zuerst
    expect(sortiert[2].id).toBe('KREUZ-AS-1');
    expect(sortiert[3].id).toBe('PIK-AS-1');
  });

  it('leeres Array bleibt leer', () => {
    expect(sortiereSichtbareHandkarten([], 'NORMALSPIEL', false)).toEqual([]);
  });

  it('verändert das Original-Array nicht', () => {
    const hand = [karte('KREUZ', 'AS'), karte('KARO', 'NEUN')];
    const original = [...hand];
    sortiereSichtbareHandkarten(hand, 'NORMALSPIEL', false);
    expect(hand).toEqual(original);
  });
});

describe('berechneSpielerankuendigungstext', () => {
  it('gibt null zurück bei null', () => {
    expect(berechneSpielerankuendigungstext(null)).toBeNull();
  });

  it('gibt null zurück für NORMALSPIEL', () => {
    expect(berechneSpielerankuendigungstext({ spieltyp: 'NORMALSPIEL', spieler: [] } as unknown as LaufendesSpielAntwort)).toBeNull();
  });

  it('gibt "X spielt Damensolo" zurück wenn RE-Spieler vorhanden', () => {
    const spiel = {
      spieltyp: 'SOLO_DAME',
      spieler: [{ name: 'Anna', partei: 'RE' }, { name: 'Ben', partei: 'KONTRA' }]
    } as unknown as LaufendesSpielAntwort;
    expect(berechneSpielerankuendigungstext(spiel)).toBe('Anna spielt Damensolo');
  });

  it('gibt "X spielt Bubensolo" zurück', () => {
    const spiel = {
      spieltyp: 'SOLO_BUBE',
      spieler: [{ name: 'Clara', partei: 'RE' }]
    } as unknown as LaufendesSpielAntwort;
    expect(berechneSpielerankuendigungstext(spiel)).toBe('Clara spielt Bubensolo');
  });

  it('gibt nur den Label zurück wenn kein RE-Spieler gefunden', () => {
    const spiel = {
      spieltyp: 'ARMUT',
      spieler: [{ name: 'Dirk', partei: 'KONTRA' }]
    } as unknown as LaufendesSpielAntwort;
    expect(berechneSpielerankuendigungstext(spiel)).toBe('Armut');
  });

  it('fällt bei unbekanntem Spieltyp auf den Spieltyp-String zurück', () => {
    const spiel = {
      spieltyp: 'UNBEKANNT',
      spieler: []
    } as unknown as LaufendesSpielAntwort;
    expect(berechneSpielerankuendigungstext(spiel)).toBe('UNBEKANNT');
  });

  it('gibt Herzsolo, Piksolo, Kreuzsolo, Karosolo und Fleischlos korrekt aus', () => {
    const make = (spieltyp: string) => ({ spieltyp, spieler: [{ name: 'X', partei: 'RE' }] } as unknown as LaufendesSpielAntwort);
    expect(berechneSpielerankuendigungstext(make('SOLO_TRUMPF_HERZ'))).toBe('X spielt Herzsolo');
    expect(berechneSpielerankuendigungstext(make('SOLO_TRUMPF_PIK'))).toBe('X spielt Piksolo');
    expect(berechneSpielerankuendigungstext(make('SOLO_TRUMPF_KREUZ'))).toBe('X spielt Kreuzsolo');
    expect(berechneSpielerankuendigungstext(make('SOLO_TRUMPF'))).toBe('X spielt Karosolo');
    expect(berechneSpielerankuendigungstext(make('SOLO_FLEISCHLOS'))).toBe('X spielt Fleischlos');
    expect(berechneSpielerankuendigungstext(make('HOCHZEIT'))).toBe('X spielt Hochzeit');
  });
});

describe('bestimmeBezugsPositionAusTisch', () => {
  it('gibt SUED zurück wenn spielerId null ist', () => {
    expect(bestimmeBezugsPositionAusTisch(null, minimalTisch)).toBe('SUED');
  });

  it('gibt SUED zurück wenn spielerId nicht am Tisch sitzt', () => {
    expect(bestimmeBezugsPositionAusTisch('unbekannt', minimalTisch)).toBe('SUED');
  });

  it('gibt die korrekte Position für jeden Index zurück', () => {
    expect(bestimmeBezugsPositionAusTisch('spieler-1', minimalTisch)).toBe('SUED');
    expect(bestimmeBezugsPositionAusTisch('spieler-2', minimalTisch)).toBe('WEST');
    expect(bestimmeBezugsPositionAusTisch('spieler-3', minimalTisch)).toBe('NORD');
    expect(bestimmeBezugsPositionAusTisch('spieler-4', minimalTisch)).toBe('OST');
  });
});

describe('bestimmeBezugsPositionAusPartie', () => {
  it('bevorzugt die Position aus dem laufenden Spiel (istSelbst)', () => {
    const spiel = {
      spieler: [
        { position: 'WEST', spielerId: 'spieler-2', istSelbst: true }
      ]
    } as unknown as LaufendesSpielAntwort;
    expect(bestimmeBezugsPositionAusPartie(spiel, 'spieler-2', minimalTisch)).toBe('WEST');
  });

  it('fällt auf Tisch-Position zurück wenn kein Spieler istSelbst und spielerId null', () => {
    const spiel = { spieler: [] } as unknown as LaufendesSpielAntwort;
    expect(bestimmeBezugsPositionAusPartie(spiel, null, minimalTisch)).toBe('SUED');
  });
});

describe('bestimmeArmutAktion', () => {
  const spielerOhneSelbst = (position: 'SUED' | 'WEST') => [
    { position: 'SUED', istSelbst: position === 'SUED', verbleibendeKarten: 9, sichtbareHandkarten: [], absolutePosition: 'SUED', name: 'Anna' },
    { position: 'WEST', istSelbst: position === 'WEST', verbleibendeKarten: 12, sichtbareHandkarten: [], absolutePosition: 'WEST', name: 'Ben' },
    { position: 'NORD', istSelbst: false, verbleibendeKarten: 12, sichtbareHandkarten: [], absolutePosition: 'NORD', name: 'Clara' },
    { position: 'OST', istSelbst: false, verbleibendeKarten: 12, sichtbareHandkarten: [], absolutePosition: 'OST', name: 'Dirk' }
  ] as never;

  const armutSpiel = (aktuellerSpieler: string, armutSpielerPosition: string | null) => ({
    spieltyp: 'ARMUT',
    phase: 'ARMUT_TAUSCH',
    aktuellerSpieler,
    armutSpielerPosition,
    spieler: []
  } as unknown as LaufendesSpielAntwort);

  it('gibt null zurück wenn Phase nicht ARMUT_TAUSCH', () => {
    const spiel = { ...armutSpiel('SUED', 'SUED'), phase: 'VORBEHALT_ANSAGE' } as unknown as LaufendesSpielAntwort;
    expect(bestimmeArmutAktion(spiel, spielerOhneSelbst('SUED'), 'SUED')).toBeNull();
  });

  it('gibt null zurück wenn aktuellerSpieler nicht SUED (aus eigener Sicht)', () => {
    expect(bestimmeArmutAktion(armutSpiel('WEST', 'SUED'), spielerOhneSelbst('SUED'), 'SUED')).toBeNull();
  });

  it('gibt null zurück wenn armutSpielerPosition fehlt', () => {
    expect(bestimmeArmutAktion(armutSpiel('SUED', null), spielerOhneSelbst('SUED'), 'SUED')).toBeNull();
  });
});
