import { describe, expect, it } from 'vitest';
import type { TischKonfigurationDto } from '../modelle/SpielverwaltungDto';
import {
  erstelleStandardTischAnsicht, erstelleTischAnsichtAusStatus,
  vorbehaltZuSpieltypFuerSortierung, istHervorgehobeneKarteImVorbehalt, sortiereKartenFuerVorbehalt
} from './TischAnsichtModell';
import type { KarteAntwort } from './SpielverwaltungDto';

const standardKonfiguration: TischKonfigurationDto = {
  ohneNeunen: false,
  anzahlSpiele: 8,
  tischhintergrund: 'FILZ_GRUEN',
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
  mindestkartenSchwarz: 7,
  bockrundenAktiv: false,
  schweinchenAktiv: false,
  dreissigAugenPflichtAktiv: false,
  schmeissenAktiv: false,
  herzDurchgegangenNurHoch: false,
  kiSchwierigkeit: 'STANDARD' as const
};

describe('erstelleStandardTischAnsicht', () => {
  it('positioniert den Menschen im Sueden und drei KI-Spieler an den anderen Plaetzen', () => {
    const modell = erstelleStandardTischAnsicht('Spieler Sued');

    expect(modell.debugModus).toBe(false);
    expect(modell.tischhintergrund).toBe('OVAL_2');
    expect(modell.spieler).toHaveLength(4);
    expect(modell.spieler[0]).toMatchObject({ position: 'SUED', name: 'Spieler Sued', istMensch: true, istSelbst: true });
    expect(modell.spieler.slice(1).map((spieler) => spieler.position)).toEqual(['WEST', 'NORD', 'OST']);
    expect(modell.spieler.slice(1).every((spieler) => !spieler.istMensch)).toBe(true);
  });

  it('legt fuer alle Spieler die Kartenanzahl des Normalspiels an', () => {
    const modell = erstelleStandardTischAnsicht('Spieler Sued');

    expect(modell.spieler.map((spieler) => spieler.verbleibendeKarten)).toEqual([12, 12, 12, 12]);
  });
});

describe('erstelleTischAnsichtAusStatus', () => {
  it('ordnet den aktuellen Spieler nach Sued und fuellt freie Plaetze auf', () => {
    const modell = erstelleTischAnsichtAusStatus('spieler-2', {
      id: 'tisch-1',
      einladungsCode: 'TEST1234',
      zugangsmodus: 'OFFEN',
      name: 'Abendrunde',
      status: 'WARTEND',
      erstelltVonSpielerId: 'spieler-1',
      partieId: null,
      konfiguration: standardKonfiguration,
      spieler: [
        { spielerId: 'spieler-1', name: 'Anna', istKi: false },
        { spielerId: 'spieler-2', name: 'Ben', istKi: false },
        { spielerId: 'spieler-3', name: 'Clara', istKi: true }
      ]
    }, null);

    expect(modell.titel).toBe('Abendrunde');
    expect(modell.spieler.map((spieler) => spieler.position)).toEqual(['SUED', 'WEST', 'NORD', 'OST']);
    expect(modell.spieler[0]).toMatchObject({ name: 'Ben', statusText: 'Du', absolutePosition: 'WEST' });
    expect(modell.spieler[1]).toMatchObject({ name: 'Clara', absolutePosition: 'NORD' });
    expect(modell.spieler[2]).toMatchObject({ name: 'Freier Platz', statusText: 'Offen' });
    expect(modell.spieler[3]).toMatchObject({ name: 'Anna', istErsteller: true, absolutePosition: 'SUED' });
  });

  it('verwendet laufendesSpiel fuer echte Tischinformationen und zeigt nur die eigene Hand offen an', () => {
    const modell = erstelleTischAnsichtAusStatus('spieler-1', {
      id: 'tisch-1',
      einladungsCode: 'TEST1234',
      zugangsmodus: 'OFFEN',
      name: 'Abendrunde',
      status: 'IM_SPIEL',
      erstelltVonSpielerId: 'spieler-1',
      partieId: 'partie-1',
      konfiguration: standardKonfiguration,
      spieler: [
        { spielerId: 'spieler-1', name: 'Anna', istKi: false },
        { spielerId: 'spieler-2', name: 'Ben', istKi: true },
        { spielerId: 'spieler-3', name: 'Clara', istKi: true },
        { spielerId: 'spieler-4', name: 'Dirk', istKi: true }
      ]
    }, {
      partieId: 'partie-1',
      version: 1,
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
        aktuelleStichmitte: [],
        ansageHistorie: [],
        moeglicheAnsagen: [],
        moeglicheVorbehalte: ['GESUND', 'SOLO_TRUMPF'],
        deklarierteVorbehalte: [],
        bockrundenZaehler: 0,
        hochzeitGeklaert: false,
        schweinchenAktiv: false,
        schweinchenGemeldetVon: null,
        spieler: [
          {
            position: 'SUED',
            spielerId: 'spieler-1',
            name: 'Anna',
            anzeigeName: 'Anna',
            avatarFarbe: null,
            istKi: false,
            istKiUebernommen: false,
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
            anzeigeName: 'Ben',
            avatarFarbe: null,
            istKi: true,
            istKiUebernommen: false,
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
            anzeigeName: 'Clara',
            avatarFarbe: null,
            istKi: true,
            istKiUebernommen: false,
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
            anzeigeName: 'Dirk',
            avatarFarbe: null,
            istKi: true,
            istKiUebernommen: false,
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
    expect(modell.tischhintergrund).toBe('FILZ_GRUEN');
    expect(modell.aktuellerSpieler).toBe('WEST');
    expect(modell.moeglicheVorbehalte).toEqual(['GESUND', 'SOLO_TRUMPF']);
    expect(modell.moeglicheAnsagen).toEqual([]);
    expect(modell.spieler[0].sichtbareHandkarten).toHaveLength(1);
    expect(modell.spieler[1].sichtbareHandkarten).toEqual([]);
    expect(modell.spieler[1].statusText).toBe('Am Zug');
    expect(modell.gesamtpunktestand.map((eintrag) => eintrag.punkte)).toEqual([0, 0, 0, 0]);
  });

  it('sortiert sichtbare Handkarten nach Trumpf- und Fehlrang und reicht den Debug-Modus durch', () => {
    const modell = erstelleTischAnsichtAusStatus('spieler-1', {
      id: 'tisch-1',
      einladungsCode: 'TEST1234',
      zugangsmodus: 'OFFEN',
      name: 'Abendrunde',
      status: 'IM_SPIEL',
      erstelltVonSpielerId: 'spieler-1',
      partieId: 'partie-1',
      konfiguration: standardKonfiguration,
      spieler: [
        { spielerId: 'spieler-1', name: 'Anna', istKi: false },
        { spielerId: 'spieler-2', name: 'Ben', istKi: true },
        { spielerId: 'spieler-3', name: 'Clara', istKi: true },
        { spielerId: 'spieler-4', name: 'Dirk', istKi: true }
      ]
    }, {
      partieId: 'partie-1',
      version: 1,
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
        aktuelleStichmitte: [],
        ansageHistorie: [{ spielerPosition: 'WEST', ansage: 'RE' }],
        moeglicheAnsagen: ['RE'],
        moeglicheVorbehalte: [],
        deklarierteVorbehalte: [],
        bockrundenZaehler: 0,
        hochzeitGeklaert: false,
        schweinchenAktiv: false,
        schweinchenGemeldetVon: null,
        spieler: [
          {
            position: 'SUED',
            spielerId: 'spieler-1',
            name: 'Anna',
            anzeigeName: 'Anna',
            avatarFarbe: null,
            istKi: false,
            istKiUebernommen: false,
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
            anzeigeName: 'Ben',
            avatarFarbe: null,
            istKi: true,
            istKiUebernommen: false,
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
            anzeigeName: 'Clara',
            avatarFarbe: null,
            istKi: true,
            istKiUebernommen: false,
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
            anzeigeName: 'Dirk',
            avatarFarbe: null,
            istKi: true,
            istKiUebernommen: false,
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
    expect(modell.ansageHistorie).toEqual([{ position: 'WEST', name: 'Ben', ansage: 'RE' }]);
  });

  it('rotiert Spieler, Stichmitte und Historie auf die Sicht des eigenen Spielers', () => {
    const modell = erstelleTischAnsichtAusStatus('spieler-2', {
      id: 'tisch-7',
      einladungsCode: 'TEST1234',
      zugangsmodus: 'OFFEN',
      name: 'Rotation',
      status: 'IM_SPIEL',
      erstelltVonSpielerId: 'spieler-1',
      partieId: 'partie-7',
      konfiguration: standardKonfiguration,
      spieler: [
        { spielerId: 'spieler-1', name: 'Anna', istKi: false },
        { spielerId: 'spieler-2', name: 'Ben', istKi: false },
        { spielerId: 'spieler-3', name: 'Clara', istKi: false },
        { spielerId: 'spieler-4', name: 'Dirk', istKi: false }
      ]
    }, {
      partieId: 'partie-7',
      version: 1,
      status: 'LAUFEND',
      anzahlSpiele: 8,
      gespielteSpiele: 0,
      gesamtpunktestand: { SUED: 4, WEST: 8, NORD: -4, OST: -8 },
      laufendesSpiel: {
        spielNummer: 1,
        spieltyp: 'NORMALSPIEL',
        phase: 'STICHPHASE',
        geber: 'SUED',
        aktuellerSpieler: 'NORD',
        spielbareKarten: [],
        aktuelleStichmitte: [
          { spielerPosition: 'WEST', karte: { id: 'KREUZ-DAME-1', farbe: 'KREUZ', wert: 'DAME', exemplarIndex: 1 }, reihenfolge: 0 },
          { spielerPosition: 'NORD', karte: { id: 'HERZ-AS-1', farbe: 'HERZ', wert: 'AS', exemplarIndex: 1 }, reihenfolge: 1 }
        ],
        ansageHistorie: [{ spielerPosition: 'OST', ansage: 'KONTRA' }],
        moeglicheAnsagen: [],
        moeglicheVorbehalte: [],
        deklarierteVorbehalte: [],
        bockrundenZaehler: 0,
        hochzeitGeklaert: false,
        schweinchenAktiv: false,
        schweinchenGemeldetVon: null,
        spieler: [
          { position: 'SUED', spielerId: 'spieler-1', name: 'Anna', anzeigeName: 'Anna', avatarFarbe: null, istKi: false, istKiUebernommen: false, istSelbst: false, istGeber: true, istAmZug: false, verbleibendeKarten: 10, gewonneneStiche: 0, partei: null, sichtbareHandkarten: null },
          { position: 'WEST', spielerId: 'spieler-2', name: 'Ben', anzeigeName: 'Ben', avatarFarbe: null, istKi: false, istKiUebernommen: false, istSelbst: true, istGeber: false, istAmZug: false, verbleibendeKarten: 10, gewonneneStiche: 1, partei: 'RE', sichtbareHandkarten: [{ id: 'KARO-AS-1', farbe: 'KARO', wert: 'AS', exemplarIndex: 1 }] },
          { position: 'NORD', spielerId: 'spieler-3', name: 'Clara', anzeigeName: 'Clara', avatarFarbe: null, istKi: false, istKiUebernommen: false, istSelbst: false, istGeber: false, istAmZug: true, verbleibendeKarten: 10, gewonneneStiche: 0, partei: null, sichtbareHandkarten: null },
          { position: 'OST', spielerId: 'spieler-4', name: 'Dirk', anzeigeName: 'Dirk', avatarFarbe: null, istKi: false, istKiUebernommen: false, istSelbst: false, istGeber: false, istAmZug: false, verbleibendeKarten: 10, gewonneneStiche: 0, partei: null, sichtbareHandkarten: null }
        ]
      }
    });

    expect(modell.spieler[0]).toMatchObject({ name: 'Ben', absolutePosition: 'WEST', istSelbst: true });
    expect(modell.spieler[1]).toMatchObject({ name: 'Clara', absolutePosition: 'NORD' });
    expect(modell.aktuellerSpieler).toBe('WEST');
    expect(modell.aktuelleStichmitte).toEqual([
      { position: 'SUED', name: 'Ben', karte: { id: 'KREUZ-DAME-1', farbe: 'KREUZ', wert: 'DAME', exemplarIndex: 1 }, reihenfolge: 0 },
      { position: 'WEST', name: 'Clara', karte: { id: 'HERZ-AS-1', farbe: 'HERZ', wert: 'AS', exemplarIndex: 1 }, reihenfolge: 1 }
    ]);
    expect(modell.ansageHistorie).toEqual([{ position: 'NORD', name: 'Dirk', ansage: 'KONTRA' }]);
    expect(modell.gesamtpunktestand.map((eintrag) => `${eintrag.name}:${eintrag.punkte}`)).toEqual(['Ben:8', 'Clara:-4', 'Dirk:-8', 'Anna:4']);
  });

  it('mappt letztes Spielergebnis und abgeschlossene Stiche fuer Ergebnis- und Replay-UI', () => {
    const modell = erstelleTischAnsichtAusStatus('spieler-2', {
      id: 'tisch-8',
      einladungsCode: 'TEST1234',
      zugangsmodus: 'OFFEN',
      name: 'Ergebnisrunde',
      status: 'IM_SPIEL',
      erstelltVonSpielerId: 'spieler-1',
      partieId: 'partie-8',
      konfiguration: standardKonfiguration,
      spieler: [
        { spielerId: 'spieler-1', name: 'Anna', istKi: false },
        { spielerId: 'spieler-2', name: 'Ben', istKi: false },
        { spielerId: 'spieler-3', name: 'Clara', istKi: false },
        { spielerId: 'spieler-4', name: 'Dirk', istKi: false }
      ]
    }, {
      partieId: 'partie-8',
      version: 1,
      status: 'LAUFEND',
      anzahlSpiele: 8,
      gespielteSpiele: 1,
      gesamtpunktestand: { SUED: 3, WEST: 3, NORD: -3, OST: -3 },
      letztesSpielergebnis: {
        spielNummer: 1,
        spieltyp: 'NORMALSPIEL',
        siegerPartei: 'RE',
        spielwert: 3,
        grundwert: 1,
        absagePunkte: 0,
        gegenDieAltenPunkte: 0,
        soloMultiplikator: 1,
        augenProPartei: { RE: 151, KONTRA: 89 },
        spielpunkteProSpieler: { SUED: 3, WEST: 3, NORD: -3, OST: -3 },
        sonderpunkteProPartei: {
          RE: [{ art: 'DOPPELKOPF', taeter: 'SUED', opfer: null }],
          KONTRA: [{ art: 'FUCHS_GEFANGEN', taeter: 'NORD', opfer: 'SUED' }]
        },
        punkteAufschluesselung: []
      },
      letzteAbgeschlosseneStiche: [
        {
          spielNummer: 1,
          stichNummer: 12,
          aufspielerPosition: 'OST',
          gewinnerPosition: 'WEST',
          augen: 28,
          gespielteKarten: [
            { spielerPosition: 'OST', karte: { id: 'HERZ-AS-1', farbe: 'HERZ', wert: 'AS', exemplarIndex: 1 }, reihenfolge: 0 },
            { spielerPosition: 'SUED', karte: { id: 'KREUZ-AS-1', farbe: 'KREUZ', wert: 'AS', exemplarIndex: 1 }, reihenfolge: 1 },
            { spielerPosition: 'WEST', karte: { id: 'KARO-ZEHN-1', farbe: 'KARO', wert: 'ZEHN', exemplarIndex: 1 }, reihenfolge: 2 },
            { spielerPosition: 'NORD', karte: { id: 'PIK-AS-1', farbe: 'PIK', wert: 'AS', exemplarIndex: 1 }, reihenfolge: 3 }
          ]
        }
      ],
      laufendesSpiel: null
    });

    expect(modell.letztesSpielergebnis).toMatchObject({
      spielNummer: 1,
      siegerPartei: 'RE',
      augenRe: 151,
      augenKontra: 89,
      sonderpunkteRe: [{ art: 'DOPPELKOPF', taeter: 'SUED', opfer: null }],
      sonderpunkteKontra: [{ art: 'FUCHS_GEFANGEN', taeter: 'NORD', opfer: 'SUED' }]
    });
    expect(modell.letztesSpielergebnis?.spielpunkte.map((eintrag) => `${eintrag.name}:${eintrag.punkte}`))
      .toEqual(['Ben:3', 'Clara:-3', 'Dirk:-3', 'Anna:3']);
    expect(modell.letzteAbgeschlosseneStiche).toEqual([
      {
        spielNummer: 1,
        stichNummer: 12,
        aufspielerPosition: 'NORD',
        gewinnerPosition: 'SUED',
        gewinnerName: 'Ben',
        augen: 28,
        gespielteKarten: [
          { position: 'NORD', name: 'Dirk', karte: { id: 'HERZ-AS-1', farbe: 'HERZ', wert: 'AS', exemplarIndex: 1 }, reihenfolge: 0 },
          { position: 'OST', name: 'Anna', karte: { id: 'KREUZ-AS-1', farbe: 'KREUZ', wert: 'AS', exemplarIndex: 1 }, reihenfolge: 1 },
          { position: 'SUED', name: 'Ben', karte: { id: 'KARO-ZEHN-1', farbe: 'KARO', wert: 'ZEHN', exemplarIndex: 1 }, reihenfolge: 2 },
          { position: 'WEST', name: 'Clara', karte: { id: 'PIK-AS-1', farbe: 'PIK', wert: 'AS', exemplarIndex: 1 }, reihenfolge: 3 }
        ]
      }
    ]);
  });

  it('leitet in der Armutphase Angebots- und Antwortzustand fuer die UI ab', () => {
    const angebotModell = erstelleTischAnsichtAusStatus('spieler-1', {
      id: 'tisch-9',
      einladungsCode: 'TEST1234',
      zugangsmodus: 'OFFEN',
      name: 'Armut',
      status: 'IM_SPIEL',
      erstelltVonSpielerId: 'spieler-1',
      partieId: 'partie-9',
      konfiguration: standardKonfiguration,
      spieler: [
        { spielerId: 'spieler-1', name: 'Anna', istKi: false },
        { spielerId: 'spieler-2', name: 'Ben', istKi: true },
        { spielerId: 'spieler-3', name: 'Clara', istKi: true },
        { spielerId: 'spieler-4', name: 'Dirk', istKi: true }
      ]
    }, {
      partieId: 'partie-9',
      version: 1,
      status: 'LAUFEND',
      anzahlSpiele: 8,
      gespielteSpiele: 0,
      gesamtpunktestand: { SUED: 0, WEST: 0, NORD: 0, OST: 0 },
      laufendesSpiel: {
        spielNummer: 1,
        spieltyp: 'ARMUT',
        phase: 'ARMUT_TAUSCH',
        geber: 'SUED',
        aktuellerSpieler: 'SUED',
        spielbareKarten: [],
        aktuelleStichmitte: [],
        ansageHistorie: [],
        moeglicheAnsagen: [],
        moeglicheVorbehalte: [],
        deklarierteVorbehalte: [],
        bockrundenZaehler: 0,
        hochzeitGeklaert: false,
        schweinchenAktiv: false,
        schweinchenGemeldetVon: null,
        armutSpielerPosition: 'SUED',
        spieler: [
          { position: 'SUED', spielerId: 'spieler-1', name: 'Anna', anzeigeName: 'Anna', avatarFarbe: null, istKi: false, istKiUebernommen: false, istSelbst: true, istGeber: true, istAmZug: true, verbleibendeKarten: 12, gewonneneStiche: 0, partei: null, sichtbareHandkarten: [{ id: 'HERZ-ZEHN-1', farbe: 'HERZ', wert: 'ZEHN', exemplarIndex: 1 }, { id: 'KARO-KOENIG-1', farbe: 'KARO', wert: 'KOENIG', exemplarIndex: 1 }, { id: 'KREUZ-AS-1', farbe: 'KREUZ', wert: 'AS', exemplarIndex: 1 }] },
          { position: 'WEST', spielerId: 'spieler-2', name: 'Ben', anzeigeName: 'Ben', avatarFarbe: null, istKi: true, istKiUebernommen: false, istSelbst: false, istGeber: false, istAmZug: false, verbleibendeKarten: 12, gewonneneStiche: 0, partei: null, sichtbareHandkarten: null },
          { position: 'NORD', spielerId: 'spieler-3', name: 'Clara', anzeigeName: 'Clara', avatarFarbe: null, istKi: true, istKiUebernommen: false, istSelbst: false, istGeber: false, istAmZug: false, verbleibendeKarten: 12, gewonneneStiche: 0, partei: null, sichtbareHandkarten: null },
          { position: 'OST', spielerId: 'spieler-4', name: 'Dirk', anzeigeName: 'Dirk', avatarFarbe: null, istKi: true, istKiUebernommen: false, istSelbst: false, istGeber: false, istAmZug: false, verbleibendeKarten: 12, gewonneneStiche: 0, partei: null, sichtbareHandkarten: null }
        ]
      }
    });

    expect(angebotModell.armutAktion).toEqual({
      modus: 'ANBIETEN',
      kartenAnzahl: 2,
      armutSpielerPosition: 'SUED',
      armutSpielerName: 'Anna'
    });

    const antwortModell = erstelleTischAnsichtAusStatus('spieler-2', {
      id: 'tisch-10',
      einladungsCode: 'TEST1234',
      zugangsmodus: 'OFFEN',
      name: 'Armut',
      status: 'IM_SPIEL',
      erstelltVonSpielerId: 'spieler-1',
      partieId: 'partie-10',
      konfiguration: standardKonfiguration,
      spieler: [
        { spielerId: 'spieler-1', name: 'Anna', istKi: false },
        { spielerId: 'spieler-2', name: 'Ben', istKi: false },
        { spielerId: 'spieler-3', name: 'Clara', istKi: true },
        { spielerId: 'spieler-4', name: 'Dirk', istKi: true }
      ]
    }, {
      partieId: 'partie-10',
      version: 1,
      status: 'LAUFEND',
      anzahlSpiele: 8,
      gespielteSpiele: 0,
      gesamtpunktestand: { SUED: 0, WEST: 0, NORD: 0, OST: 0 },
      laufendesSpiel: {
        spielNummer: 1,
        spieltyp: 'ARMUT',
        phase: 'ARMUT_TAUSCH',
        geber: 'SUED',
        aktuellerSpieler: 'WEST',
        spielbareKarten: [],
        aktuelleStichmitte: [],
        ansageHistorie: [],
        moeglicheAnsagen: [],
        moeglicheVorbehalte: [],
        deklarierteVorbehalte: [],
        bockrundenZaehler: 0,
        hochzeitGeklaert: false,
        schweinchenAktiv: false,
        schweinchenGemeldetVon: null,
        armutSpielerPosition: 'SUED',
        spieler: [
          { position: 'SUED', spielerId: 'spieler-1', name: 'Anna', anzeigeName: 'Anna', avatarFarbe: null, istKi: false, istKiUebernommen: false, istSelbst: false, istGeber: true, istAmZug: false, verbleibendeKarten: 9, gewonneneStiche: 0, partei: null, sichtbareHandkarten: null },
          { position: 'WEST', spielerId: 'spieler-2', name: 'Ben', anzeigeName: 'Ben', avatarFarbe: null, istKi: false, istKiUebernommen: false, istSelbst: true, istGeber: false, istAmZug: true, verbleibendeKarten: 12, gewonneneStiche: 0, partei: null, sichtbareHandkarten: [{ id: 'KREUZ-AS-1', farbe: 'KREUZ', wert: 'AS', exemplarIndex: 1 }] },
          { position: 'NORD', spielerId: 'spieler-3', name: 'Clara', anzeigeName: 'Clara', avatarFarbe: null, istKi: true, istKiUebernommen: false, istSelbst: false, istGeber: false, istAmZug: false, verbleibendeKarten: 12, gewonneneStiche: 0, partei: null, sichtbareHandkarten: null },
          { position: 'OST', spielerId: 'spieler-4', name: 'Dirk', anzeigeName: 'Dirk', avatarFarbe: null, istKi: true, istKiUebernommen: false, istSelbst: false, istGeber: false, istAmZug: false, verbleibendeKarten: 12, gewonneneStiche: 0, partei: null, sichtbareHandkarten: null }
        ]
      }
    });

    expect(antwortModell.armutAktion).toEqual({
      modus: 'ANTWORTEN',
      kartenAnzahl: 3,
      armutSpielerPosition: 'OST',
      armutSpielerName: 'Anna'
    });
  });

  it('sortiert Farbsolo-Handkarten korrekt: Damen > Buben > Farbtrümpfe > Fehlfarben, Herz-10 keine Dulle', () => {
    // Warum wichtig: Im Farbsolo gibt es keine Dulle — Herz-Zehn ist normaler Farbtrumpf (Rang 3),
    // nicht höchster Trumpf. Dieser Test verhindert, dass normaleTrumpfRang() fälschlich verwendet wird.
    const baueModell = (spieltyp: 'SOLO_TRUMPF_HERZ' | 'SOLO_TRUMPF_PIK' | 'SOLO_TRUMPF_KREUZ', handkarten: { id: string; farbe: 'KREUZ' | 'PIK' | 'HERZ' | 'KARO'; wert: 'AS' | 'ZEHN' | 'KOENIG' | 'DAME' | 'BUBE' | 'NEUN'; }[]) =>
      erstelleTischAnsichtAusStatus('spieler-1', {
        id: 'tisch-x', einladungsCode: 'ABCD', zugangsmodus: 'OFFEN', name: 'Test', status: 'IM_SPIEL',
        erstelltVonSpielerId: 'spieler-1', partieId: 'partie-x', konfiguration: standardKonfiguration,
        spieler: [
          { spielerId: 'spieler-1', name: 'Anna', istKi: false },
          { spielerId: 'spieler-2', name: 'Ben', istKi: true },
          { spielerId: 'spieler-3', name: 'Clara', istKi: true },
          { spielerId: 'spieler-4', name: 'Dirk', istKi: true }
        ]
      }, {
        partieId: 'partie-x', version: 1, status: 'LAUFEND', anzahlSpiele: 8, gespielteSpiele: 0,
        gesamtpunktestand: { SUED: 0, WEST: 0, NORD: 0, OST: 0 },
        laufendesSpiel: {
          spielNummer: 1, spieltyp, phase: 'STICHPHASE', geber: 'SUED', aktuellerSpieler: 'SUED',
          spielbareKarten: [], aktuelleStichmitte: [], ansageHistorie: [], moeglicheAnsagen: [],
          moeglicheVorbehalte: [], deklarierteVorbehalte: [], bockrundenZaehler: 0,
          hochzeitGeklaert: false, schweinchenAktiv: false, schweinchenGemeldetVon: null,
          spieler: [
            { position: 'SUED', spielerId: 'spieler-1', name: 'Anna', anzeigeName: 'Anna', avatarFarbe: null,
              istKi: false, istKiUebernommen: false, istSelbst: true, istGeber: true, istAmZug: true,
              verbleibendeKarten: handkarten.length, gewonneneStiche: 0, partei: 'RE',
              sichtbareHandkarten: handkarten.map((k) => ({ ...k, exemplarIndex: 1 })) },
            { position: 'WEST', spielerId: 'spieler-2', name: 'Ben', anzeigeName: 'Ben', avatarFarbe: null,
              istKi: true, istKiUebernommen: false, istSelbst: false, istGeber: false, istAmZug: false,
              verbleibendeKarten: 3, gewonneneStiche: 0, partei: 'KONTRA', sichtbareHandkarten: null },
            { position: 'NORD', spielerId: 'spieler-3', name: 'Clara', anzeigeName: 'Clara', avatarFarbe: null,
              istKi: true, istKiUebernommen: false, istSelbst: false, istGeber: false, istAmZug: false,
              verbleibendeKarten: 3, gewonneneStiche: 0, partei: null, sichtbareHandkarten: null },
            { position: 'OST', spielerId: 'spieler-4', name: 'Dirk', anzeigeName: 'Dirk', avatarFarbe: null,
              istKi: true, istKiUebernommen: false, istSelbst: false, istGeber: false, istAmZug: false,
              verbleibendeKarten: 3, gewonneneStiche: 0, partei: null, sichtbareHandkarten: null }
          ]
        }
      }, false);

    // Herzsolo: Kreuz-Dame (rank 12) > Herz-As (Farbtrumpf, rank 4) > Herz-Zehn (Farbtrumpf, rank 3, KEINE Dulle!) > Kreuz-As (Fehlfarbe)
    const herzModell = baueModell('SOLO_TRUMPF_HERZ', [
      { id: 'KREUZ-AS-1', farbe: 'KREUZ', wert: 'AS' },
      { id: 'HERZ-ZEHN-1', farbe: 'HERZ', wert: 'ZEHN' },
      { id: 'HERZ-AS-1', farbe: 'HERZ', wert: 'AS' },
      { id: 'KREUZ-DAME-1', farbe: 'KREUZ', wert: 'DAME' }
    ]);
    expect(herzModell.spieler[0].sichtbareHandkarten.map((k) => k.id)).toEqual([
      'KREUZ-DAME-1', // höchster Trumpf (Dame, rank 12)
      'HERZ-AS-1',   // Farbtrumpf Ass (rank 4)
      'HERZ-ZEHN-1', // Farbtrumpf Zehn (rank 3), KEINE Dulle
      'KREUZ-AS-1'   // Fehlfarbe
    ]);

    // Piksolo: Herz-Zehn ist Fehlfarbe (keine Dulle), Karo-As ist Fehlfarbe
    const pikModell = baueModell('SOLO_TRUMPF_PIK', [
      { id: 'KARO-AS-1', farbe: 'KARO', wert: 'AS' },
      { id: 'HERZ-ZEHN-1', farbe: 'HERZ', wert: 'ZEHN' },
      { id: 'KREUZ-DAME-1', farbe: 'KREUZ', wert: 'DAME' },
      { id: 'PIK-NEUN-1', farbe: 'PIK', wert: 'NEUN' }
    ]);
    expect(pikModell.spieler[0].sichtbareHandkarten.map((k) => k.id)).toEqual([
      'KREUZ-DAME-1', // höchster Trumpf (Dame, rank 12)
      'PIK-NEUN-1',  // Farbtrumpf Neun (rank 1)
      'HERZ-ZEHN-1', // Fehlfarbe Herz (fehlFarbRang 3) — KEINE Dulle im Farbsolo
      'KARO-AS-1'    // Fehlfarbe Karo (fehlFarbRang 4)
    ]);

    // Kreuzsolo: Kreuz-Koenig ist Farbtrumpf, Herz-Zehn ist Fehlfarbe
    const kreuzModell = baueModell('SOLO_TRUMPF_KREUZ', [
      { id: 'HERZ-ZEHN-1', farbe: 'HERZ', wert: 'ZEHN' },
      { id: 'KARO-DAME-1', farbe: 'KARO', wert: 'DAME' },
      { id: 'KREUZ-KOENIG-1', farbe: 'KREUZ', wert: 'KOENIG' }
    ]);
    expect(kreuzModell.spieler[0].sichtbareHandkarten.map((k) => k.id)).toEqual([
      'KARO-DAME-1',     // Trumpf (Dame, rank 9)
      'KREUZ-KOENIG-1',  // Farbtrumpf König (rank 2)
      'HERZ-ZEHN-1'      // Fehlfarbe — KEINE Dulle im Farbsolo
    ]);
  });

  it('sortiert Handkarten bei aktivem Schweinchen: Karo-As-2 > Karo-As-1 > Dulle > andere Trümpfe', () => {
    // Warum wichtig: Bei Schweinchen erhalten beide Karo-Asse Rang 14/15 und stehen damit
    // oberhalb der Dulle (Rang 13). normaleTrumpfRang() muss exemplarIndex berücksichtigen.
    const modell = erstelleTischAnsichtAusStatus('spieler-1', {
      id: 'tisch-x', einladungsCode: 'ABCD', zugangsmodus: 'OFFEN', name: 'Test', status: 'IM_SPIEL',
      erstelltVonSpielerId: 'spieler-1', partieId: 'partie-x',
      konfiguration: { ...standardKonfiguration, schweinchenAktiv: true },
      spieler: [
        { spielerId: 'spieler-1', name: 'Anna', istKi: false },
        { spielerId: 'spieler-2', name: 'Ben', istKi: true },
        { spielerId: 'spieler-3', name: 'Clara', istKi: true },
        { spielerId: 'spieler-4', name: 'Dirk', istKi: true }
      ]
    }, {
      partieId: 'partie-x', version: 1, status: 'LAUFEND', anzahlSpiele: 8, gespielteSpiele: 0,
      gesamtpunktestand: { SUED: 0, WEST: 0, NORD: 0, OST: 0 },
      laufendesSpiel: {
        spielNummer: 1, spieltyp: 'NORMALSPIEL', phase: 'STICHPHASE',
        geber: 'SUED', aktuellerSpieler: 'SUED',
        spielbareKarten: [], aktuelleStichmitte: [], ansageHistorie: [],
        moeglicheAnsagen: [], moeglicheVorbehalte: [], deklarierteVorbehalte: [],
        bockrundenZaehler: 0, hochzeitGeklaert: false, schweinchenAktiv: true, schweinchenGemeldetVon: null,
        spieler: [
          { position: 'SUED', spielerId: 'spieler-1', name: 'Anna', anzeigeName: 'Anna', avatarFarbe: null,
            istKi: false, istKiUebernommen: false, istSelbst: true, istGeber: true, istAmZug: true,
            verbleibendeKarten: 4, gewonneneStiche: 0, partei: 'RE',
            sichtbareHandkarten: [
              { id: 'KREUZ-DAME-1', farbe: 'KREUZ', wert: 'DAME', exemplarIndex: 1 },
              { id: 'HERZ-ZEHN-1', farbe: 'HERZ', wert: 'ZEHN', exemplarIndex: 1 },
              { id: 'KARO-AS-2', farbe: 'KARO', wert: 'AS', exemplarIndex: 2 },
              { id: 'KARO-AS-1', farbe: 'KARO', wert: 'AS', exemplarIndex: 1 }
            ]
          },
          { position: 'WEST', spielerId: 'spieler-2', name: 'Ben', anzeigeName: 'Ben', avatarFarbe: null,
            istKi: true, istKiUebernommen: false, istSelbst: false, istGeber: false, istAmZug: false,
            verbleibendeKarten: 4, gewonneneStiche: 0, partei: null, sichtbareHandkarten: null },
          { position: 'NORD', spielerId: 'spieler-3', name: 'Clara', anzeigeName: 'Clara', avatarFarbe: null,
            istKi: true, istKiUebernommen: false, istSelbst: false, istGeber: false, istAmZug: false,
            verbleibendeKarten: 4, gewonneneStiche: 0, partei: null, sichtbareHandkarten: null },
          { position: 'OST', spielerId: 'spieler-4', name: 'Dirk', anzeigeName: 'Dirk', avatarFarbe: null,
            istKi: true, istKiUebernommen: false, istSelbst: false, istGeber: false, istAmZug: false,
            verbleibendeKarten: 4, gewonneneStiche: 0, partei: null, sichtbareHandkarten: null }
        ]
      }
    });

    const eigenerSpieler = modell.spieler.find((s) => s.istSelbst)!;
    expect(eigenerSpieler.sichtbareHandkarten.map((k) => k.id)).toEqual([
      'KARO-AS-2',    // zweites Schweinchen (Rang 15) — höchster Trumpf
      'KARO-AS-1',    // erstes Schweinchen (Rang 14)
      'HERZ-ZEHN-1',  // Dulle (Rang 13)
      'KREUZ-DAME-1'  // Kreuz-Dame (Rang 12)
    ]);
  });
});

function karte(farbe: KarteAntwort['farbe'], wert: KarteAntwort['wert'], idx = 1): KarteAntwort {
  return { id: `${farbe}-${wert}-${idx}`, farbe, wert, exemplarIndex: idx, bildId: '' };
}

describe('vorbehaltZuSpieltypFuerSortierung', () => {
  it('gibt NORMALSPIEL für GESUND, HOCHZEIT, ARMUT, SCHMEISSEN zurück', () => {
    expect(vorbehaltZuSpieltypFuerSortierung('GESUND')).toBe('NORMALSPIEL');
    expect(vorbehaltZuSpieltypFuerSortierung('HOCHZEIT')).toBe('NORMALSPIEL');
    expect(vorbehaltZuSpieltypFuerSortierung('ARMUT')).toBe('NORMALSPIEL');
    expect(vorbehaltZuSpieltypFuerSortierung('SCHMEISSEN')).toBe('NORMALSPIEL');
  });

  it('gibt den passenden Spieltyp für Solo-Vorbehalte zurück', () => {
    expect(vorbehaltZuSpieltypFuerSortierung('SOLO_DAME')).toBe('SOLO_DAME');
    expect(vorbehaltZuSpieltypFuerSortierung('SOLO_BUBE')).toBe('SOLO_BUBE');
    expect(vorbehaltZuSpieltypFuerSortierung('SOLO_FLEISCHLOS')).toBe('SOLO_FLEISCHLOS');
    expect(vorbehaltZuSpieltypFuerSortierung('SOLO_TRUMPF')).toBe('SOLO_TRUMPF');
    expect(vorbehaltZuSpieltypFuerSortierung('SOLO_TRUMPF_HERZ')).toBe('SOLO_TRUMPF_HERZ');
    expect(vorbehaltZuSpieltypFuerSortierung('SOLO_TRUMPF_PIK')).toBe('SOLO_TRUMPF_PIK');
    expect(vorbehaltZuSpieltypFuerSortierung('SOLO_TRUMPF_KREUZ')).toBe('SOLO_TRUMPF_KREUZ');
  });
});

describe('istHervorgehobeneKarteImVorbehalt', () => {
  it('hebt bei HOCHZEIT nur Kreuz-Damen hervor', () => {
    expect(istHervorgehobeneKarteImVorbehalt(karte('KREUZ', 'DAME'), 'HOCHZEIT')).toBe(true);
    expect(istHervorgehobeneKarteImVorbehalt(karte('PIK', 'DAME'), 'HOCHZEIT')).toBe(false);
    expect(istHervorgehobeneKarteImVorbehalt(karte('KREUZ', 'AS'), 'HOCHZEIT')).toBe(false);
  });

  it('hebt bei SOLO_DAME alle Damen hervor', () => {
    expect(istHervorgehobeneKarteImVorbehalt(karte('KREUZ', 'DAME'), 'SOLO_DAME')).toBe(true);
    expect(istHervorgehobeneKarteImVorbehalt(karte('HERZ', 'DAME'), 'SOLO_DAME')).toBe(true);
    expect(istHervorgehobeneKarteImVorbehalt(karte('KREUZ', 'BUBE'), 'SOLO_DAME')).toBe(false);
  });

  it('hebt bei SOLO_BUBE alle Buben hervor', () => {
    expect(istHervorgehobeneKarteImVorbehalt(karte('KREUZ', 'BUBE'), 'SOLO_BUBE')).toBe(true);
    expect(istHervorgehobeneKarteImVorbehalt(karte('KREUZ', 'DAME'), 'SOLO_BUBE')).toBe(false);
  });

  it('hebt bei SOLO_FLEISCHLOS und SCHMEISSEN keine Karte hervor', () => {
    expect(istHervorgehobeneKarteImVorbehalt(karte('KREUZ', 'DAME'), 'SOLO_FLEISCHLOS')).toBe(false);
    expect(istHervorgehobeneKarteImVorbehalt(karte('KARO', 'AS'), 'SCHMEISSEN')).toBe(false);
  });

  it('hebt bei GESUND alle Normalspiel-Trümpfe hervor', () => {
    expect(istHervorgehobeneKarteImVorbehalt(karte('KREUZ', 'DAME'), 'GESUND')).toBe(true);
    expect(istHervorgehobeneKarteImVorbehalt(karte('KARO', 'AS'), 'GESUND')).toBe(true);
    expect(istHervorgehobeneKarteImVorbehalt(karte('HERZ', 'ZEHN'), 'GESUND')).toBe(true);
    expect(istHervorgehobeneKarteImVorbehalt(karte('KREUZ', 'AS'), 'GESUND')).toBe(false);
  });
});

describe('sortiereKartenFuerVorbehalt', () => {
  it('sortiert Karten für SOLO_DAME: Damen zuerst', () => {
    const hand = [karte('KREUZ', 'AS'), karte('PIK', 'DAME'), karte('HERZ', 'BUBE'), karte('KREUZ', 'DAME')];
    const sortiert = sortiereKartenFuerVorbehalt(hand, 'SOLO_DAME');
    expect(sortiert[0].wert).toBe('DAME');
    expect(sortiert[1].wert).toBe('DAME');
  });

  it('sortiert Karten für SOLO_FLEISCHLOS: keine Trümpfe, alle Fehlfarben gleichberechtigt', () => {
    const hand = [karte('KREUZ', 'DAME'), karte('HERZ', 'AS'), karte('PIK', 'AS'), karte('KARO', 'KOENIG')];
    const sortiert = sortiereKartenFuerVorbehalt(hand, 'SOLO_FLEISCHLOS');
    // Im Fleischlos sind alle Karten Fehlfarbe — Sortierung nach Farb- und Wertrang
    expect(sortiert).toHaveLength(4);
  });

  it('verändert das Original-Array nicht', () => {
    const hand = [karte('KREUZ', 'AS'), karte('PIK', 'DAME')];
    const original = [...hand];
    sortiereKartenFuerVorbehalt(hand, 'SOLO_DAME');
    expect(hand.map((k) => k.id)).toEqual(original.map((k) => k.id));
  });
});
