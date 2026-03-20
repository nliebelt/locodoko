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

  it('verwendet laufendesSpiel fuer echte Tischinformationen und zeigt nur die eigene Hand offen an', () => {
    const modell = erstelleTischAnsichtAusStatus('spieler-1', {
      id: 'tisch-1',
      name: 'Abendrunde',
      status: 'IM_SPIEL',
      erstelltVonSpielerId: 'spieler-1',
      partieId: 'partie-1',
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
        { spielerId: 'spieler-2', name: 'Ben', istKi: true },
        { spielerId: 'spieler-3', name: 'Clara', istKi: true },
        { spielerId: 'spieler-4', name: 'Dirk', istKi: true }
      ]
    }, {
      partieId: 'partie-1',
      status: 'LAUFEND',
      anzahlSpiele: 8,
      gespielteSpiele: 0,
      gesamtpunktestand: { SUED: 0, WEST: 0, NORD: 0, OST: 0 },
      laufendesSpiel: {
        spielNummer: 1,
        spieltyp: 'NORMALSPIEL',
        phase: 'VORBEHALT_ANSAGE',
        geber: 'SUED',
        aktuellerSpieler: 'WEST',
        spielbareKarten: [],
        moeglicheAnsagen: [],
        moeglicheVorbehalte: ['GESUND', 'SOLO_TRUMPF'],
        spieler: [
          {
            position: 'SUED',
            spielerId: 'spieler-1',
            name: 'Anna',
            istKi: false,
            istSelbst: true,
            istGeber: true,
            istAmZug: false,
            verbleibendeKarten: 12,
            gewonneneStiche: 0,
            partei: null,
            sichtbareHandkarten: [{ id: 'HERZ-AS-1', farbe: 'HERZ', wert: 'AS', exemplarIndex: 1 }]
          },
          {
            position: 'WEST',
            spielerId: 'spieler-2',
            name: 'Ben',
            istKi: true,
            istSelbst: false,
            istGeber: false,
            istAmZug: true,
            verbleibendeKarten: 12,
            gewonneneStiche: 0,
            partei: null,
            sichtbareHandkarten: null
          },
          {
            position: 'NORD',
            spielerId: 'spieler-3',
            name: 'Clara',
            istKi: true,
            istSelbst: false,
            istGeber: false,
            istAmZug: false,
            verbleibendeKarten: 12,
            gewonneneStiche: 0,
            partei: null,
            sichtbareHandkarten: null
          },
          {
            position: 'OST',
            spielerId: 'spieler-4',
            name: 'Dirk',
            istKi: true,
            istSelbst: false,
            istGeber: false,
            istAmZug: false,
            verbleibendeKarten: 12,
            gewonneneStiche: 0,
            partei: null,
            sichtbareHandkarten: null
          }
        ]
      }
    });

    expect(modell.untertitel).toContain('NORMALSPIEL');
    expect(modell.aktuellerSpieler).toBe('WEST');
    expect(modell.moeglicheVorbehalte).toEqual(['GESUND', 'SOLO_TRUMPF']);
    expect(modell.moeglicheAnsagen).toEqual([]);
    expect(modell.spieler[0].sichtbareHandkarten).toHaveLength(1);
    expect(modell.spieler[1].sichtbareHandkarten).toEqual([]);
    expect(modell.spieler[1].statusText).toBe('Am Zug');
  });

  it('sortiert sichtbare Handkarten nach Trumpf- und Fehlrang und reicht den Debug-Modus durch', () => {
    const modell = erstelleTischAnsichtAusStatus('spieler-1', {
      id: 'tisch-1',
      name: 'Abendrunde',
      status: 'IM_SPIEL',
      erstelltVonSpielerId: 'spieler-1',
      partieId: 'partie-1',
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
        { spielerId: 'spieler-2', name: 'Ben', istKi: true },
        { spielerId: 'spieler-3', name: 'Clara', istKi: true },
        { spielerId: 'spieler-4', name: 'Dirk', istKi: true }
      ]
    }, {
      partieId: 'partie-1',
      status: 'LAUFEND',
      anzahlSpiele: 8,
      gespielteSpiele: 0,
      gesamtpunktestand: { SUED: 0, WEST: 0, NORD: 0, OST: 0 },
      laufendesSpiel: {
        spielNummer: 1,
        spieltyp: 'NORMALSPIEL',
        phase: 'STICHPHASE',
        geber: 'SUED',
        aktuellerSpieler: 'SUED',
        spielbareKarten: [{ id: 'HERZ-ZEHN-1', farbe: 'HERZ', wert: 'ZEHN', exemplarIndex: 1 }],
        moeglicheAnsagen: ['RE'],
        moeglicheVorbehalte: [],
        spieler: [
          {
            position: 'SUED',
            spielerId: 'spieler-1',
            name: 'Anna',
            istKi: false,
            istSelbst: true,
            istGeber: true,
            istAmZug: true,
            verbleibendeKarten: 3,
            gewonneneStiche: 1,
            partei: 'RE',
            sichtbareHandkarten: [
              { id: 'KREUZ-AS-1', farbe: 'KREUZ', wert: 'AS', exemplarIndex: 1 },
              { id: 'HERZ-ZEHN-1', farbe: 'HERZ', wert: 'ZEHN', exemplarIndex: 1 },
              { id: 'KARO-KOENIG-1', farbe: 'KARO', wert: 'KOENIG', exemplarIndex: 1 }
            ]
          },
          {
            position: 'WEST',
            spielerId: 'spieler-2',
            name: 'Ben',
            istKi: true,
            istSelbst: false,
            istGeber: false,
            istAmZug: false,
            verbleibendeKarten: 3,
            gewonneneStiche: 0,
            partei: 'KONTRA',
            sichtbareHandkarten: null
          },
          {
            position: 'NORD',
            spielerId: 'spieler-3',
            name: 'Clara',
            istKi: true,
            istSelbst: false,
            istGeber: false,
            istAmZug: false,
            verbleibendeKarten: 3,
            gewonneneStiche: 0,
            partei: null,
            sichtbareHandkarten: null
          },
          {
            position: 'OST',
            spielerId: 'spieler-4',
            name: 'Dirk',
            istKi: true,
            istSelbst: false,
            istGeber: false,
            istAmZug: false,
            verbleibendeKarten: 3,
            gewonneneStiche: 0,
            partei: null,
            sichtbareHandkarten: null
          }
        ]
      }
    }, true);

    expect(modell.debugModus).toBe(true);
    expect(modell.moeglicheAnsagen).toEqual(['RE']);
    expect(modell.spieler[0].partei).toBe('RE');
    expect(modell.spieler[0].istGeber).toBe(true);
    expect(modell.spieler[0].sichtbareHandkarten.map((karte) => karte.id)).toEqual([
      'HERZ-ZEHN-1',
      'KARO-KOENIG-1',
      'KREUZ-AS-1'
    ]);
  });
});
