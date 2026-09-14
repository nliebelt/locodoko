// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AppZustand
} from '../store/AppStore';
import type {
  KarteAntwort,
  LaufendesSpielAntwort,
  PartieStandAntwort,
  SpielerImSpielAntwort,
  TischAntwort,
} from '../modelle/SpielverwaltungDto';


function richteLocalStorageEin(initialeWerte: Record<string, string> = {}): Storage {
  const speicher = new Map(Object.entries(initialeWerte));
  return {
    get length() { return speicher.size; },
    clear(): void { speicher.clear(); },
    getItem(schluessel: string): string | null { return speicher.get(schluessel) ?? null; },
    key(index: number): string | null { return Array.from(speicher.keys())[index] ?? null; },
    removeItem(schluessel: string): void { speicher.delete(schluessel); },
    setItem(schluessel: string, wert: string): void { speicher.set(schluessel, wert); }
  };
}

const appStoreHarness = vi.hoisted(() => {
  let zustand: unknown;
  let listener: ((wert: unknown) => void) | undefined;
  let eventListener: ((e: unknown) => void | Promise<void>) | undefined;
  let sonderpunkteListener: ((sp: any) => void) | undefined;

  return {
    setZustand(z: unknown) { zustand = structuredClone(z); },
    sendeZustand() { listener?.(structuredClone(zustand)); },
    async sendeEvent(e: unknown) { await eventListener?.(e); },
    sendeSonderpunkte(sp: any) { sonderpunkteListener?.(sp); },
    store: {
      abonniere: vi.fn((cb: (z: unknown) => void) => { listener = cb; cb(structuredClone(zustand)); return vi.fn(); }),
      abonniereEvents: vi.fn((cb: (e: unknown) => void | Promise<void>) => { eventListener = cb; return vi.fn(); }),
      abonniereSonderpunkte: vi.fn((cb: (sp: any) => void) => { sonderpunkteListener = cb; return vi.fn(); }),
      snapshot: vi.fn(() => structuredClone(zustand)),
      spieleKarte: vi.fn(),
      sageAnsageAn: vi.fn(),
      meldeVorbehalt: vi.fn(),
      beantworteArmut: vi.fn(),
      starteNeuePartie: vi.fn(),
      quittiereMeldung: vi.fn(),
      setzeQueueFort: vi.fn(),
      pausiereQueue: vi.fn()
    }
  };
});

function erstelleTweenApi() {
  return { add: vi.fn((k: any) => {
    const z = Array.isArray(k.targets) ? k.targets : [k.targets];
    ['x', 'y', 'alpha', 'val'].forEach(p => { if (typeof k[p] === 'number') z.forEach((o: any) => { if (o) o[p] = k[p]; }); });
    if (k.onUpdate) k.onUpdate(); if (k.onComplete) k.onComplete();
    return { stop: vi.fn(), remove: vi.fn() };
  }), killTweensOf: vi.fn() };
}

vi.mock('../anwendung', () => ({ appStore: appStoreHarness.store }));

class FakeGameObject {
  x=0; y=0; alpha=1; active=true; visible=true; name=''; tint?: number; scene: any = { input: { enabled: true }, tweens: erstelleTweenApi() };
  setDepth() { return this; }
  setAlpha(a: number) { this.alpha = a; return this; }
  setTint(t: number) { this.tint = t; return this; }
  setName(n: string) { this.name = n; return this; }
  setOrigin() { return this; }
  setPosition(x: number, y: number) { this.x = x; this.y = y; return this; }
  setInteractive() { return this; }
  setVisible(v: boolean) { this.visible = v; return this; }
  on() { return this; }
  emit() { return this; }
  destroy() { this.active = false; return this; }
  setText() { return this; }
  setScale() { return this; }
  setDisplaySize() { return this; }
  setSize() { return this; }
  setAngle() { return this; }
  clear() { return this; }
  fillStyle() { return this; }
  fillRect() { return this; }
  fillRoundedRect() { return this; }
  strokeRoundedRect() { return this; }
  lineStyle() { return this; }
  lineBetween() { return this; }
  setMask() { return this; }
  setStrokeStyle() { return this; }
  onpointerdown() { (this as any)._pointerDownHandler?.(); }
}

class FakeContainer extends FakeGameObject {
  readonly kinder: any[] = [];
  add(k: any) { 
    if (Array.isArray(k)) this.kinder.push(...k);
    else this.kinder.push(k);
    return this;
  }
}

vi.mock('../ui/PhaserModal', () => ({
  PhaserModal: class {
    add = vi.fn();
    setDepth = vi.fn().mockReturnThis();
    destroy = vi.fn();
    getContentContainer = vi.fn(() => ({ add: vi.fn() }));
  }
}));

vi.mock('./PhaserButton', () => ({
  PhaserButton: class {
    setName = vi.fn().mockReturnThis();
    add = vi.fn();
    destroy = vi.fn();
  }
}));

vi.mock('phaser', () => ({
  default: {
    Scene: class { scale: any = { width: 1280, height: 720 };
      add: any;
      
      scene: any;
      tweens: any;
      time: any;
      textures: any;
      game: any;
      make = {
        graphics: () => new FakeGameObject(),
        text: (_opt: any) => new FakeGameObject(),
        container: () => new FakeContainer()
      };
    },
    GameObjects: { 
      Container: FakeContainer, 
      Image: class extends FakeGameObject {}, 
      TileSprite: class extends FakeGameObject {}, 
      Text: class extends FakeGameObject {}, 
      Rectangle: class extends FakeGameObject {}, 
      Graphics: class extends FakeGameObject {}, 
      GameObject: FakeGameObject 
    },
    Scale: { Events: { RESIZE: 'resize' } },
    Math: { Easing: { Cubic: { Out: 'Cubic.Out' } } },
    Display: { Masks: { GeometryMask: class { constructor() {} } } }
  }
}));

const { TischSzene } = await import('./TischSzene');

function karte(id: string, farbe: string, wert: string): KarteAntwort { return { id, farbe, wert, exemplarIndex: 1 }; }
function baueSpieler(pos: any, name: string, opt: any = {}): SpielerImSpielAntwort { return { position: pos, spielerId: opt.spielerId ?? ('sp-' + pos), name, anzeigeName: name, avatarFarbe: null, istKi: pos !== 'SUED', istKiUebernommen: false, istSelbst: pos === 'SUED', istGeber: false, istAmZug: false, verbleibendeKarten: opt.verbleibendeKarten ?? 0, gewonneneStiche: 0, partei: null, sichtbareHandkarten: opt.sichtbareHandkarten ?? null }; }
function baueLaufendesSpiel(opt: any = {}): LaufendesSpielAntwort { return { spielNummer: 1, spieltyp: 'NORMALSPIEL', phase: 'STICHPHASE', geber: 'WEST', aktuellerSpieler: 'SUED', spieler: opt.spieler ?? [baueSpieler('SUED', 'Anna', { verbleibendeKarten: 2, sichtbareHandkarten: [karte('H1', 'HERZ', 'ZEHN'), karte('K1', 'KREUZ', 'AS')] }), baueSpieler('WEST', 'Ben'), baueSpieler('NORD', 'Clara'), baueSpieler('OST', 'Dirk')], spielbareKarten: opt.spielbareKarten ?? [karte('H1', 'HERZ', 'ZEHN')], aktuelleStichmitte: [], ansageHistorie: [], moeglicheAnsagen: [], moeglicheVorbehalte: [], deklarierteVorbehalte: [], bockrundenZaehler: 0, hochzeitGeklaert: false, schweinchenAktiv: false, schweinchenGemeldetVon: null, ...opt }; }
function bauePartieStand(lauf: any): PartieStandAntwort { return { partieId: 'p1', version: 1, status: 'LAUFEND', anzahlSpiele: 8, gespielteSpiele: 0, gesamtpunktestand: { SUED: 0, WEST: 0, NORD: 0, OST: 0 }, laufendesSpiel: lauf }; }
function baueTisch(opt: any = {}): TischAntwort { return { id: 't1', name: 'T1', einladungsCode: 'C1', status: 'IM_SPIEL', zugangsmodus: 'OFFEN', erstelltVonSpielerId: 'sp-SUED', partieId: 'p1', konfiguration: { ohneNeunen: false, anzahlSpiele: 8, tischhintergrund: 'FILZ_GRUEN', hochzeitErlaubt: true, armutErlaubt: true, damensoloErlaubt: true, bubensoloErlaubt: true, fleischlosErlaubt: true, trumpfsoloErlaubt: true, zweiteDulleSticht: true, fuchsGefangenAktiv: true, karlchenAktiv: true, doppelkopfAktiv: true, mindestkartenReKontra: 11, mindestkartenKeine90: 10, mindestkartenKeine60: 9, mindestkartenKeine30: 8, mindestkartenSchwarz: 7, bockrundenAktiv: false, schweinchenAktiv: false, dreissigAugenPflichtAktiv: false, schmeissenAktiv: false, herzDurchgegangenNurHoch: false, kiSchwierigkeit: 'STANDARD' }, spieler: opt.spieler ?? [{ spielerId: 'sp-SUED', name: 'Anna', istKi: false }, { spielerId: 'sp-WEST', name: 'Ben', istKi: true }, { spielerId: 'sp-NORD', name: 'Clara', istKi: true }, { spielerId: 'sp-OST', name: 'Dirk', istKi: true }] }; }
function baueZustand(opt: any = {}): AppZustand { return { initialisiert: true, wirdGeladen: false, authentifiziert: true, bereich: 'TISCH' as const, verbindung: 'verbunden' as const, debugModus: false, spieler: { spielerId: 'sp-SUED', name: 'Anna', istKi: false }, tische: [], aktuellerTisch: baueTisch(), partieStand: bauePartieStand(baueLaufendesSpiel()), meldung: null, uiKonfiguration: { kiVerzoegerungMs: 800 }, countdownSekunden: null, spielProtokollEintraege: [], ...opt }; }

let aktiveSzene: any | undefined;

function findeButtonMitTestid(container: any, testid: string): any {
  if (!container) return null;
  if (container.name === testid) return container;
  const kinder: any[] = container.kinder ?? container.list ?? [];
  for (const kind of kinder) {
    const gefunden = findeButtonMitTestid(kind, testid);
    if (gefunden) return gefunden;
  }
  return null;
}

function baueSzene(z: any) {
  document.body.innerHTML = '<div id="ui-root"></div>';
  appStoreHarness.setZustand(z);
  const s = new (TischSzene as any)();
  aktiveSzene = s;
  const t = erstelleTweenApi();
  const fakeParticles = () => ({ setDepth: () => fakeParticles(), explode: vi.fn(), destroy: vi.fn(), active: false });
  const fakeAnimationen = {
    reiheEin: async (fn: () => Promise<unknown>) => { await fn(); return []; },
    abbrechen: vi.fn(),
    animiereRundenauswertung: vi.fn().mockResolvedValue([]),
    animiereAusteilung: vi.fn().mockResolvedValue(undefined),
    animiereGespielteKarte: vi.fn().mockResolvedValue(undefined),
    animiereKarteAusspielen: vi.fn().mockResolvedValue(undefined),
    animiereStichgewinner: vi.fn().mockResolvedValue(undefined),
    animiereGewinnerFlash: vi.fn().mockResolvedValue(undefined),
    animiereAnsageBanner: vi.fn().mockResolvedValue(undefined),
    animiereStichEinziehen: vi.fn().mockResolvedValue(undefined),
    animiereBockrunde: vi.fn().mockResolvedValue(undefined),
    setzeGeschwindigkeitsfaktor: vi.fn(),
    get animationLaeuft() { return false; }
  };
  const sTime = { 
    addEvent: () => ({ remove: () => {} }), 
    delayedCall: vi.fn((_ms, callback) => {
      callback();
      return { remove: () => {} };
    })
  };
  Object.assign(s, { add: { existing: (o:any)=>o, tileSprite: (_x:any,_y:any,_w:any,_h:any,_t:any)=>new FakeGameObject(), container: (_x:any,_y:any)=>new FakeContainer(), graphics: ()=>new FakeGameObject(), ellipse: (_x:any,_y:any,_w:any,_h:any)=>new FakeGameObject(), text: (_x:any,_y:any,_t:any)=>new FakeGameObject(), circle: (_x:any,_y:any)=>new FakeGameObject(), rectangle: (_x:any,_y:any,_w:any,_h:any)=>new FakeGameObject(), image: (_x:any,_y:any,_t:any)=>new FakeGameObject(), particles: fakeParticles }, input: { on: vi.fn(), off: vi.fn() }, scale: { gameSize: { width: 1280, height: 720 }, on: vi.fn(), off: vi.fn() }, scene: { start: vi.fn() }, tweens: t, time: sTime, textures: { exists: ()=>true, addCanvas: ()=>{} }, game: { loop: { sleep: vi.fn(), wake: vi.fn() } }, cameras: { main: { shake: vi.fn(), flash: vi.fn() } } });
  s.create();
  s['animationen'] = fakeAnimationen;
  return { s, t };
}

beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers();
  Object.defineProperty(globalThis, 'localStorage', { value: richteLocalStorageEin(), configurable: true, writable: true });
  (window as any).__locodoko = { _rundenEndeModalGezeigt: 0 };
});
afterEach(() => { aktiveSzene?.shutdown(); aktiveSzene = undefined; vi.useRealTimers(); delete (window as any).__locodoko; });

describe('TischSzene', () => {
  it('rendert Karten und reagiert auf Klick', async () => {
    const { s } = baueSzene(baueZustand());
    const eigeneKarten = Array.from((s['kartenRenderer']['persistenteEigeneKarten'] as Map<string, any>).values());
    expect(eigeneKarten.length).toBeGreaterThan(0);
    (eigeneKarten[0] as any)._pointerDownHandler = () => appStoreHarness.store.spieleKarte('K1');
    eigeneKarten[0].onpointerdown();
    await vi.runAllTimersAsync();
    expect(appStoreHarness.store.spieleKarte).toHaveBeenCalled();
  });

  it('zeigt Rundenende-Modal', async () => {
    const { s } = baueSzene(baueZustand({ partieStand: bauePartieStand(baueLaufendesSpiel()) }));
    const neuerStand = { ...bauePartieStand(null), letztesSpielergebnis: { spielNummer: 42, spieltyp: 'NORMALSPIEL' as const, siegerPartei: 'RE' as const, spielwert: 1, grundwert: 1, absagePunkte: 0, gegenDieAltenPunkte: 0, soloMultiplikator: 1, augenProPartei: { RE: 130, KONTRA: 110 }, sonderpunkteProPartei: { RE: [], KONTRA: [] }, spielpunkteProSpieler: { SUED: 1, WEST: -1, NORD: 1, OST: -1 }, punkteAufschluesselung: [{ typ: 'GRUNDWERT', label: 'Grundwert', punkte: 1 }], spielpunkte: [], gesamtstand: [] } };
    appStoreHarness.setZustand(baueZustand({ partieStand: neuerStand }));
    (s as any)._letzterGezeigterSpielBeendet = null;
    void appStoreHarness.sendeEvent({ ereignisTyp: 'SPIEL_BEENDET', partieStand: neuerStand, timestamp: new Date().toISOString() });
    await vi.runAllTimersAsync();
    const bridge = (window as { __locodoko?: { _rundenEndeModalGezeigt?: number } }).__locodoko;
    expect(bridge?._rundenEndeModalGezeigt).toBeGreaterThan(0);
  });

  it('spielt Karte per Tastatur', async () => {
    baueSzene(baueZustand({ partieStand: bauePartieStand(baueLaufendesSpiel({ spielbareKarten: [karte('H1','H','Z'), karte('K1','K','A')] })) }));
    await vi.runAllTimersAsync();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await vi.runAllTimersAsync();
    expect(appStoreHarness.store.spieleKarte).toHaveBeenCalledWith('K1');
  });

  it('lehnt Armut ab', () => {
    baueSzene(baueZustand({ partieStand: bauePartieStand(baueLaufendesSpiel({ spieltyp: 'ARMUT', phase: 'ARMUT_TAUSCH', armutSpielerPosition: 'WEST', spieler: [baueSpieler('SUED','A',{verbleibendeKarten:12}), baueSpieler('WEST','B',{verbleibendeKarten:9}), baueSpieler('NORD','C'), baueSpieler('OST','D')] })) }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true }));
    expect(appStoreHarness.store.beantworteArmut).toHaveBeenCalledWith(false, []);
  });

  it('zeigt Ansage-Flash bei ANSAGE_ERFOLGT', async () => {
    const { s } = baueSzene(baueZustand());
    const flashSpy = vi.spyOn((s as any).animationen, 'animiereAnsageBanner');
    const ereignis = { ereignisTyp: 'ANSAGE_ERFOLGT', partieStand: { laufendesSpiel: { spieler: [], ansageHistorie: [{ spielerPosition: 'WEST', ansage: 'RE' }] } } };
    await (s as any).ereignisHandler.verarbeitePartieEreignis(ereignis);
    expect(flashSpy).toHaveBeenCalled();
  });

  it('renderArmutBereich zeigt Buttons bei ANBIETEN', () => {
    const { s } = baueSzene(baueZustand({ partieStand: bauePartieStand(baueLaufendesSpiel({ spieltyp: 'ARMUT', phase: 'ARMUT_TAUSCH', armutSpielerPosition: 'SUED', aktuellerSpieler: 'SUED' })) }));
    expect(findeButtonMitTestid((s as any).tischEbene, 'btn-armut-anbieten')).not.toBeNull();
  });

  it('aktualisiert Hintergrund', () => {
    const { s } = baueSzene(baueZustand());
    (s as any).aktualisiereHintergrund('OVAL_1', 1280, 720);
    (s as any).aktualisiereHintergrund('FILZ_GRUEN', 1280, 720);
  });

  it('zeigeRundenEndeModal erstellt das Modal', async () => {
    const { s } = baueSzene(baueZustand());
    const m = (s as any).erstelleModell(baueZustand({ partieStand: { letztesSpielergebnis: { spielNummer: 1, siegerPartei: 'RE', augenProPartei: { RE: 130, KONTRA: 110 }, sonderpunkteProPartei: { RE: [], KONTRA: [] }, punkteAufschluesselung: [], spielpunkteProSpieler: { SUED: 1, WEST: 1, NORD: -1, OST: -1 }, spielpunkte: [], gesamtstand: [] } } as any }));
    await (s as any).rundenEndeController.zeigeRundenEndeModal(m);
    expect((s as any).rundenEndeController.phaserRundenEndeModal).toBeDefined();
  });
  it('verarbeitePartieEreignis cover branches', async () => {
    const { s } = baueSzene(baueZustand());
    const stand = bauePartieStand(baueLaufendesSpiel());
    
    await (s as any).ereignisHandler.verarbeitePartieEreignis({ ereignisTyp: 'KARTE_GESPIELT', spielerPosition: 'WEST', karte: karte('K1','K','A'), partieStand: stand });
    await (s as any).ereignisHandler.verarbeitePartieEreignis({ ereignisTyp: 'STICH_ABGESCHLOSSEN', gewinnerPosition: 'NORD', augen: 10, neueSonderpunkte: [{ typ: 'DOPPELKOPF', gewinner: 'NORD' }], partieStand: stand });
    await (s as any).ereignisHandler.verarbeitePartieEreignis({ ereignisTyp: 'ANSAGE_ERFOLGT', partieStand: { ...stand, laufendesSpiel: { ...stand.laufendesSpiel, ansageHistorie: [{ spielerPosition: 'SUED', ansage: 'RE' }] } } });
    await (s as any).ereignisHandler.verarbeitePartieEreignis({ ereignisTyp: 'VORBEHALT_GEWAEHLT', spielerPosition: 'WEST', vorbehalt: 'GESUND', partieStand: stand });
    await (s as any).ereignisHandler.verarbeitePartieEreignis({ ereignisTyp: 'AKTION_ABGELEHNT', fehlerCode: 'NICHT_AM_ZUG', partieId: 'p1', version: 1, timestamp: '' });
  });

  it('aufraeumen stoppt Timer und Animationen', () => {
    const { s } = baueSzene(baueZustand());
    (s as any).aufraeumen();
    expect((s as any).animationen).toBeUndefined();
  });
});
