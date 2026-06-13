/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';

// ---------------------------------------------------------------------------
// appStore Mock (vor Import von TischAnimationOrchestrator)
// ---------------------------------------------------------------------------
const mockSpielKarte = vi.hoisted(() => vi.fn());
const mockSnapshot = vi.hoisted(() => vi.fn(() => ({ aktuellerTisch: null, spieler: null })));
vi.mock('../anwendung', () => ({
  appStore: { spieleKarte: mockSpielKarte, snapshot: mockSnapshot },
}));

import { TischAnimationOrchestrator } from './TischAnimationOrchestrator';
import { SPIELER_POSITION, PARTEI } from '../modelle/TischAnsichtModell';

// ---------------------------------------------------------------------------
// Hilfs-Factories
// ---------------------------------------------------------------------------
function neueKartenobjektFake() {
  return {
    setDepth: vi.fn().mockReturnThis(),
    setAngle: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
    bildObjekt: null as any,
  };
}

function baueAnimationenFake() {
  return {
    animiereKarteAusspielen: vi.fn().mockResolvedValue(undefined),
    animiereStichEinziehen: vi.fn().mockResolvedValue(undefined),
    animiereKartenAusteilen: vi.fn().mockResolvedValue(undefined),
    animiereAnsageBanner: vi.fn().mockResolvedValue(undefined),
    animiereGewinnerFlash: vi.fn().mockResolvedValue(undefined),
    animiereSoloAnkuendigung: vi.fn().mockResolvedValue(undefined),
    animiereSoloAnkündigungBanner: vi.fn().mockResolvedValue(undefined),
    reiheEin: vi.fn().mockImplementation(async (fn: () => Promise<void>) => fn()),
    animationLaeuft: false,
    setzeGeschwindigkeitsfaktor: vi.fn(),
  };
}

function baueSzene() {
  const animationen = baueAnimationenFake();
  const kartenRenderer = {
    erstelleKartenansicht: vi.fn().mockImplementation(() => neueKartenobjektFake()),
    handKartenobjekte: new Map<string, any>(),
    persistenteEigeneKarten: new Set<string>(),
  };
  const szene: any = {
    scale: { gameSize: { width: 1280, height: 720 } },
    animationen,
    kartenRenderer,
    wartendeKartenId: null as string | null,
    stichEinziehenAktiv: false,
    austeilenAktiv: true,
    tischEbene: { add: vi.fn() },
    add: {
      rectangle: vi.fn().mockReturnValue({
        setDepth: vi.fn().mockReturnThis(),
        setAlpha: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      }),
    },
    triggerRender: vi.fn(),
    erstelleModell: vi.fn(),
    letztesModell: null as any,
    letzterZustand: null as any,
    renderTisch: vi.fn(),
  };
  return { szene, animationen, kartenRenderer };
}

// ---------------------------------------------------------------------------
// animiereGegnerKarte
// ---------------------------------------------------------------------------
describe('animiereGegnerKarte', () => {
  it('(1) erstellt Karte, animiert und zerstört sie', async () => {
    const { szene, animationen, kartenRenderer } = baueSzene();
    const o = new TischAnimationOrchestrator(szene);
    await o.animiereGegnerKarte(SPIELER_POSITION.NORD, 300);
    expect(kartenRenderer.erstelleKartenansicht).toHaveBeenCalled();
    expect(animationen.animiereKarteAusspielen).toHaveBeenCalled();
    // erstellte Karte muss in finally zerstört worden sein
    const karte = kartenRenderer.erstelleKartenansicht.mock.results[0].value;
    expect(karte.destroy).toHaveBeenCalled();
  });

  it('(2) setzt wartendeKartenId=null in finally', async () => {
    const { szene } = baueSzene();
    szene.wartendeKartenId = 'irgendwas';
    const o = new TischAnimationOrchestrator(szene);
    await o.animiereGegnerKarte(SPIELER_POSITION.WEST);
    expect(szene.wartendeKartenId).toBeNull();
  });

  it('(3) zerstört Karte auch wenn Animation einen Fehler wirft', async () => {
    const { szene, animationen, kartenRenderer } = baueSzene();
    animationen.animiereKarteAusspielen.mockRejectedValue(new Error('Animationsfehler'));
    const o = new TischAnimationOrchestrator(szene);
    await expect(o.animiereGegnerKarte(SPIELER_POSITION.SUED)).rejects.toThrow('Animationsfehler');
    const karte = kartenRenderer.erstelleKartenansicht.mock.results[0].value;
    expect(karte.destroy).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// spieleKarteMitAnimation
// ---------------------------------------------------------------------------
describe('spieleKarteMitAnimation', () => {
  it('(4) kein-Op wenn wartendeKartenId bereits gesetzt', async () => {
    const { szene, animationen } = baueSzene();
    szene.wartendeKartenId = 'blockedId';
    const o = new TischAnimationOrchestrator(szene);
    await o.spieleKarteMitAnimation('neueId');
    expect(animationen.reiheEin).not.toHaveBeenCalled();
    expect(mockSpielKarte).not.toHaveBeenCalled();
  });

  it('(5) kein-Op wenn animationLaeuft=true', async () => {
    const { szene, animationen } = baueSzene();
    animationen.animationLaeuft = true;
    const o = new TischAnimationOrchestrator(szene);
    await o.spieleKarteMitAnimation('xyz');
    expect(animationen.reiheEin).not.toHaveBeenCalled();
  });

  it('(6) ruft appStore.spieleKarte direkt wenn Karte nicht im handKartenobjekte', async () => {
    const { szene } = baueSzene();
    const o = new TischAnimationOrchestrator(szene);
    await o.spieleKarteMitAnimation('unbekannteId');
    expect(mockSpielKarte).toHaveBeenCalledWith('unbekannteId');
  });

  it('(7) animiert Karte wenn im handKartenobjekte gefunden', async () => {
    const { szene, animationen, kartenRenderer } = baueSzene();
    const mockKarte = { wurzel: { destroy: vi.fn() } } as any;
    kartenRenderer.handKartenobjekte.set('karteAbc', mockKarte);
    const o = new TischAnimationOrchestrator(szene);
    await o.spieleKarteMitAnimation('karteAbc');
    expect(mockSpielKarte).toHaveBeenCalledWith('karteAbc');
    expect(animationen.reiheEin).toHaveBeenCalled();
    expect(szene.wartendeKartenId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// starteAusteilen
// ---------------------------------------------------------------------------
describe('starteAusteilen', () => {
  function baueSpielerModell() {
    return {
      spieler: [
        { position: SPIELER_POSITION.SUED, istGeber: true,  istSelbst: true,  sichtbareHandkarten: [{ id:'k1',name:'',wert:0,trumpf:false,sorte:'' }, { id:'k2',name:'',wert:0,trumpf:false,sorte:'' }, { id:'k3',name:'',wert:0,trumpf:false,sorte:'' }], verbleibendeKarten: 3 },
        { position: SPIELER_POSITION.WEST, istGeber: false, istSelbst: false, sichtbareHandkarten: [], verbleibendeKarten: 3 },
        { position: SPIELER_POSITION.NORD, istGeber: false, istSelbst: false, sichtbareHandkarten: [], verbleibendeKarten: 3 },
        { position: SPIELER_POSITION.OST,  istGeber: false, istSelbst: false, sichtbareHandkarten: [], verbleibendeKarten: 3 },
      ],
      letzteAbgeschlosseneStiche: [],
      letztesSpielergebnis: null,
      spieltyp: 'NORMAL',
    } as any;
  }

  it('(8) ruft animiereKartenAusteilen auf', async () => {
    const { szene, animationen } = baueSzene();
    const modell = baueSpielerModell();
    const zustand = {} as any;
    const o = new TischAnimationOrchestrator(szene);
    await o.starteAusteilen(modell, zustand);
    expect(animationen.animiereKartenAusteilen).toHaveBeenCalled();
  });

  it('(9) setzt austeilenAktiv=false in finally und ruft renderTisch', async () => {
    const { szene } = baueSzene();
    szene.austeilenAktiv = true;
    const modell = baueSpielerModell();
    const zustand = { aktuellerTisch: null, spieler: null } as any;
    const o = new TischAnimationOrchestrator(szene);
    await o.starteAusteilen(modell, zustand);
    expect(szene.austeilenAktiv).toBe(false);
    expect(szene.renderTisch).toHaveBeenCalled();
  });

  it('(10) zerstört alle erstellten Karten in finally', async () => {
    const { szene, kartenRenderer } = baueSzene();
    const modell = baueSpielerModell();
    const o = new TischAnimationOrchestrator(szene);
    await o.starteAusteilen(modell, {} as any);
    // Jede erstellte Karte muss destroyed worden sein
    const allResults = kartenRenderer.erstelleKartenansicht.mock.results;
    expect(allResults.length).toBeGreaterThan(0);
    allResults.forEach(r => expect(r.value.destroy).toHaveBeenCalled());
  });

  it('(11) zerstört Karten in finally auch bei Animationsfehler', async () => {
    const { szene, animationen, kartenRenderer } = baueSzene();
    animationen.animiereKartenAusteilen.mockRejectedValue(new Error('deal fail'));
    const modell = baueSpielerModell();
    const o = new TischAnimationOrchestrator(szene);
    await expect(o.starteAusteilen(modell, {} as any)).rejects.toThrow('deal fail');
    kartenRenderer.erstelleKartenansicht.mock.results.forEach(r => expect(r.value.destroy).toHaveBeenCalled());
    expect(szene.austeilenAktiv).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// starteAnsageBannerAnimationen
// ---------------------------------------------------------------------------
describe('starteAnsageBannerAnimationen', () => {
  it('(12) tut nichts wenn kein letztesModell', async () => {
    const { szene, animationen } = baueSzene();
    szene.letztesModell = null;
    const o = new TischAnimationOrchestrator(szene);
    await o.starteAnsageBannerAnimationen(['RE'] as any);
    expect(animationen.animiereAnsageBanner).not.toHaveBeenCalled();
  });

  it('(13) animiert RE-Ansage mit goldener Farbe', async () => {
    const { szene, animationen } = baueSzene();
    szene.letztesModell = { spieler: [] };
    const o = new TischAnimationOrchestrator(szene);
    await o.starteAnsageBannerAnimationen([PARTEI.RE] as any);
    expect(animationen.animiereAnsageBanner).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      undefined,
      '#ffd166',
    );
  });

  it('(14) animiert KONTRA-Ansage mit blauer Farbe', async () => {
    const { szene, animationen } = baueSzene();
    szene.letztesModell = { spieler: [] };
    const o = new TischAnimationOrchestrator(szene);
    await o.starteAnsageBannerAnimationen([PARTEI.KONTRA] as any);
    expect(animationen.animiereAnsageBanner).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      undefined,
      '#90caf9',
    );
  });

  it('(15) animiert alle Ansagen sequenziell', async () => {
    const { szene, animationen } = baueSzene();
    szene.letztesModell = { spieler: [] };
    const o = new TischAnimationOrchestrator(szene);
    await o.starteAnsageBannerAnimationen([PARTEI.RE, PARTEI.KONTRA] as any);
    expect(animationen.animiereAnsageBanner).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// zeigeGewinnerFlash
// ---------------------------------------------------------------------------
describe('zeigeGewinnerFlash', () => {
  it('(16) tut nichts ohne letztesSpielergebnis', async () => {
    const { szene, animationen } = baueSzene();
    const modell = { letztesSpielergebnis: null, spieler: [] } as any;
    const o = new TischAnimationOrchestrator(szene);
    await o.zeigeGewinnerFlash(modell);
    expect(animationen.animiereGewinnerFlash).not.toHaveBeenCalled();
  });

  it('(17) ruft animiereGewinnerFlash mit RE-Daten und goldener Farbe', async () => {
    const { szene, animationen } = baueSzene();
    const modell = {
      letztesSpielergebnis: { siegerPartei: PARTEI.RE, spielwert: 4 },
      spieler: [
        { partei: PARTEI.RE,     name: 'Alice' },
        { partei: PARTEI.KONTRA, name: 'Bob' },
      ],
    } as any;
    const o = new TischAnimationOrchestrator(szene);
    await o.zeigeGewinnerFlash(modell);
    expect(animationen.animiereGewinnerFlash).toHaveBeenCalledWith(
      'RE gewinnt!',
      'Alice',
      '+4 Punkte',
      '#ffd166',
      expect.any(Object),
    );
  });

  it('(18) ruft animiereGewinnerFlash mit KONTRA-Daten und blauer Farbe', async () => {
    const { szene, animationen } = baueSzene();
    const modell = {
      letztesSpielergebnis: { siegerPartei: PARTEI.KONTRA, spielwert: 2 },
      spieler: [{ partei: PARTEI.KONTRA, name: 'Bob' }, { partei: PARTEI.RE, name: 'Alice' }],
    } as any;
    const o = new TischAnimationOrchestrator(szene);
    await o.zeigeGewinnerFlash(modell);
    expect(animationen.animiereGewinnerFlash).toHaveBeenCalledWith(
      'KONTRA gewinnt!',
      'Bob',
      '+2 Punkte',
      '#90caf9',
      expect.any(Object),
    );
  });
});

// ---------------------------------------------------------------------------
// zeigeSpielankuendigung
// ---------------------------------------------------------------------------
describe('zeigeSpielankuendigung', () => {
  it('(19) delegiert an animiereSoloAnkuendigung mit Meldung + Bildschirmmitte', async () => {
    const { szene, animationen } = baueSzene();
    const o = new TischAnimationOrchestrator(szene);
    await o.zeigeSpielankuendigung('Pik-Solo!');
    expect(animationen.animiereSoloAnkuendigung).toHaveBeenCalledWith(
      'Pik-Solo!',
      { x: 640, y: 360 }, // 1280/2, 720/2
    );
  });
});
