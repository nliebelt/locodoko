import { describe, expect, it } from 'vitest';
import { erstelleStandardTischAnsicht, erstelleTischAnsichtAusStatus } from './TischAnsichtModell';

describe('erstelleStandardTischAnsicht', () => {
  it('positioniert den Menschen im Sueden und drei KI-Spieler an den anderen Plaetzen', () => {
    const modell = erstelleStandardTischAnsicht('Spieler Süd');

    expect(modell.debugModus).toBe(false);
    expect(modell.spieler).toHaveLength(4);
    expect(modell.spieler[0]).toMatchObject({ position: 'SUED', name: 'Spieler Süd', istMensch: true });
    expect(modell.spieler.slice(1).map((spieler) => spieler.position)).toEqual(['WEST', 'NORD', 'OST']);
    expect(modell.spieler.slice(1).every((spieler) => !spieler.istMensch)).toBe(true);
  });

  it('legt fuer alle Spieler die Kartenanzahl des Normalspiels an', () => {
    const modell = erstelleStandardTischAnsicht('Spieler Süd');

    expect(modell.spieler.map((spieler) => spieler.verbleibendeKarten)).toEqual([12, 12, 12, 12]);
  });
});

describe('erstelleTischAnsichtAusStatus', () => {
  it('ordnet den aktuellen Spieler nach Sued und fuellt freie Plaetze auf', () => {
    const modell = erstelleTischAnsichtAusStatus('spieler-2', {
      id: 'tisch-1',
      name: 'Abendrunde',
      status: 'WARTEND',
      erstelltVonSpielerId: 'spieler-1',
      partieId: null,
      konfiguration: {
        ohneNeunen: false,
        anzahlSpiele: 8,
        hochzeitErlaubt: true,
        armutErlaubt: true,
        damensoloErlaubt: true,
        bubensoloErlaubt: true,
        fleischlosErlaubt: true,
        trumpfsoloErlaubt: true,
        zweiteDulleSticht: true,
        fuchsGefangenAktiv: true,
        karlchenAktiv: true,
        doppelkopfAktiv: true,
        mindestkartenReKontra: 11,
        mindestkartenKeine90: 10,
        mindestkartenKeine60: 9,
        mindestkartenKeine30: 8,
        mindestkartenSchwarz: 7
      },
      spieler: [
        { spielerId: 'spieler-1', name: 'Anna', istKi: false },
        { spielerId: 'spieler-2', name: 'Ben', istKi: false },
        { spielerId: 'spieler-3', name: 'Clara', istKi: true }
      ]
    }, null);

    expect(modell.titel).toBe('Abendrunde');
    expect(modell.spieler.map((spieler) => spieler.position)).toEqual(['SUED', 'WEST', 'NORD', 'OST']);
    expect(modell.spieler[0]).toMatchObject({ name: 'Ben', statusText: 'Du' });
    expect(modell.spieler[1].name).toBe('Clara');
    expect(modell.spieler[2]).toMatchObject({ name: 'Anna', istErsteller: true });
    expect(modell.spieler[3]).toMatchObject({ name: 'Freier Platz', statusText: 'Offen' });
  });
});
