// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AppZustand
} from '../store/AppStore';
import type {
  KarteAntwort,
  LaufendesSpielAntwort,
  PartieStandAntwort,
  SpielerImSpielAntwort,
  TischAntwort
} from '../modelle/SpielverwaltungDto';

type Handler = () => void;

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
  let zustand: any;
  let listener: ((wert: any) => void) | undefined;
  let eventListener: ((e: any) => void) | undefined;
  return {
    setZustand(z: any) { zustand = structuredClone(z); },
    sendeZustand() { listener?.(structuredClone(zustand)); },
    sendeEvent(e: any) { eventListener?.(e); },
    store: {
      abonnieren: vi.fn((cb: any) => { listener = cb; cb(structuredClone(zustand)); return vi.fn(); }),
      abonniereEvents: vi.fn((cb: any) => { eventListener = cb; return vi.fn(); }),
      abonniereSonderpunkte: vi.fn(() => vi.fn()),
      snapshot: vi.fn(() => structuredClone(zustand)),
      spieleKarte: vi.fn(),
      sageAnsageAn: vi.fn(),
      meldeVorbehalt: vi.fn(),
      beantworteArmut: vi.fn(),
      starteNeuePartie: vi.fn()
    }
  };
});

vi.mock('../anwendung', () => ({ appStore: appStoreHarness.store }));

class FakeGameObject {
  readonly typ: string;
  x=0; y=0; textur?: string; text?: string; alpha=1; winkel=0; breite=0; hoehe=0; interactive=false; zerstort=false; tint?: number;
  private readonly handler = new Map<string, Handler[]>();
  get texture() { return { key: this.textur }; }
  constructor(typ: string, opt: any = {}) { this.typ = typ; Object.assign(this, opt); }
  setDisplaySize(_w: number, _h: number) { return this; }
  setAngle(w: number) { this.winkel = w; return this; }
  setAlpha(a: number) { this.alpha = a; return this; }
  setTint(t: number) { this.tint = t; return this; }
  setOrigin() { return this; }
  setDepth() { return this; }
  setPosition(x: number, y: number) { this.x = x; this.y = y; return this; }
  setSize(w: number, h: number) { this.breite = w; this.hoehe = h; return this; }
  setTexture(t: string) { this.textur = t; return this; }
  setInteractive() { this.interactive = true; return this; }
  on(e: string, h: Handler) { const el = this.handler.get(e) ?? []; el.push(h); this.handler.set(e, el); return this; }
  emit(e: string) { (this.handler.get(e) ?? []).forEach(h => h()); }
  destroy() { this.zerstort = true; return this; }
  setText(t: string) { this.text = t; return this; }
  setScale() { return this; }
  fillStyle() { return this; }
  fillRect() { return this; }
  fillRoundedRect() { return this; }
  strokeRoundedRect() { return this; }
  lineStyle() { return this; }
  clear() { return this; }
  setStrokeStyle() { return this; }
}

class FakeContainer extends FakeGameObject {
  readonly kinder: any[] = [];
  constructor() { super('container'); }
  add(k: any) { this.kinder.push(k); return this; }
}

vi.mock('phaser', () => ({
  default: {
    Scene: class { add: any; scale: any; scene: any; tweens: any; time: any; textures: any; game: any; },
    GameObjects: { Container: FakeContainer, Image: class extends FakeGameObject { constructor(_:any,x:number,y:number,t:string) { super('image',{x,y,textur:t}); } }, TileSprite: class extends FakeGameObject { constructor(_:any,x:number,y:number,w:number,h:number,t:string) { super('tileSprite',{x,y,breite:w,hoehe:h,textur:t}); } }, Text: class extends FakeGameObject { constructor(_:any,x:number,y:number,t:string) { super('text',{x,y,text:t}); } }, Rectangle: class extends FakeGameObject { constructor(_:any,x:number,y:number,w:number,h:number) { super('rectangle',{x,y,breite:w,hoehe:h}); } }, Graphics: class extends FakeGameObject { constructor() { super('graphics'); } }, GameObject: FakeGameObject },
    Scale: { Events: { RESIZE: 'resize' } }
  }
}));

const { TischSzene } = await import('./TischSzene');

function karte(id: string, farbe: string, wert: string): KarteAntwort { return { id, farbe, wert, exemplarIndex: 1 }; }
function baueSpieler(pos: any, name: string, opt: any = {}): SpielerImSpielAntwort { return { position: pos, spielerId: opt.spielerId ?? `sp-${pos}`, name, anzeigeName: name, avatarFarbe: null, istKi: pos !== 'SUED', istKiUebernommen: false, istSelbst: pos === 'SUED', istGeber: false, istAmZug: false, verbleibendeKarten: opt.verbleibendeKarten ?? 0, gewonneneStiche: 0, partei: null, sichtbareHandkarten: opt.sichtbareHandkarten ?? null }; }
function baueLaufendesSpiel(opt: any = {}): LaufendesSpielAntwort { return { spielNummer: 1, spieltyp: 'NORMALSPIEL', phase: 'STICHPHASE', geber: 'WEST', aktuellerSpieler: 'SUED', spieler: opt.spieler ?? [baueSpieler('SUED', 'Anna', { verbleibendeKarten: 2, sichtbareHandkarten: [karte('H1', 'HERZ', 'ZEHN'), karte('K1', 'KREUZ', 'AS')] }), baueSpieler('WEST', 'Ben'), baueSpieler('NORD', 'Clara'), baueSpieler('OST', 'Dirk')], spielbareKarten: opt.spielbareKarten ?? [karte('H1', 'HERZ', 'ZEHN')], aktuelleStichmitte: [], ansageHistorie: [], moeglicheAnsagen: [], moeglicheVorbehalte: [], deklarierteVorbehalte: [], bockrundenZaehler: 0, hochzeitGeklaert: false, schweinchenAktiv: false, schweinchenGemeldetVon: null, ...opt }; }
function bauePartieStand(lauf: any): PartieStandAntwort { return { partieId: 'p1', version: 1, status: 'LAUFEND', anzahlSpiele: 8, gespielteSpiele: 0, gesamtpunktestand: { SUED: 0, WEST: 0, NORD: 0, OST: 0 }, laufendesSpiel: lauf }; }
function baueTisch(): TischAntwort { return { id: 't1', name: 'T1', einladungsCode: 'C1', status: 'IM_SPIEL', zugangsmodus: 'OFFEN', erstelltVonSpielerId: 'sp-SUED', partieId: 'p1', konfiguration: { ohneNeunen: false, anzahlSpiele: 8, tischhintergrund: 'FILZ_GRUEN', hochzeitErlaubt: true, armutErlaubt: true, damensoloErlaubt: true, bubensoloErlaubt: true, fleischlosErlaubt: true, trumpfsoloErlaubt: true, zweiteDulleSticht: true, fuchsGefangenAktiv: true, karlchenAktiv: true, doppelkopfAktiv: true, mindestkartenReKontra: 11, mindestkartenKeine90: 10, mindestkartenKeine60: 9, mindestkartenKeine30: 8, mindestkartenSchwarz: 7, bockrundenAktiv: false, schweinchenAktiv: false, dreissigAugenPflichtAktiv: false, schmeissenAktiv: false, herzDurchgegangenNurHoch: false, kiSchwierigkeit: 'STANDARD' }, spieler: [{ spielerId: 'sp-SUED', name: 'Anna', istKi: false }, { spielerId: 'sp-WEST', name: 'Ben', istKi: true }, { spielerId: 'sp-NORD', name: 'Clara', istKi: true }, { spielerId: 'sp-OST', name: 'Dirk', istKi: true }] }; }
function baueZustand(opt: any = {}): AppZustand { return { initialisiert: true, wirdGeladen: false, authentifiziert: true, bereich: 'TISCH', verbindung: 'verbunden', debugModus: false, spieler: { spielerId: 'sp-SUED', name: 'Anna', istKi: false }, tische: [], aktuellerTisch: baueTisch(), partieStand: bauePartieStand(baueLaufendesSpiel()), meldung: null, ...opt }; }

function erstelleTweenApi() {
  return { add: vi.fn((k: any) => {
    const z = Array.isArray(k.targets) ? k.targets : [k.targets];
    ['x', 'y', 'alpha', 'val'].forEach(p => { if (typeof k[p] === 'number') z.forEach((o: any) => { if (o) o[p] = k[p]; }); });
    if (k.onUpdate) k.onUpdate(); if (k.onComplete) k.onComplete();
    return { stop: vi.fn() };
  }) };
}

let aktiveSzene: any | undefined;

function baueSzene(z: any) {
  document.body.innerHTML = '<div id="ui-root"></div>';
  appStoreHarness.setZustand(z);
  const s = new (TischSzene as any)();
  aktiveSzene = s;
  const t = erstelleTweenApi();
  Object.assign(s, { add: { existing: (o:any)=>o, tileSprite: (_x:any,_y:any,w:any,h:any,t:any)=>new FakeGameObject('tileSprite',{x:_x,y:_y,breite:w,hoehe:h,textur:t}), container: (_x:any,_y:any)=>new FakeContainer(), graphics: ()=>new FakeGameObject('graphics'), ellipse: (_x:any,_y:any,w:any,h:any)=>new FakeGameObject('ellipse',{x:_x,y:_y,breite:w,hoehe:h}), text: (_x:any,_y:any,t:any)=>new FakeGameObject('text',{x:_x,y:_y,text:t}), circle: (_x:any,_y:any)=>new FakeGameObject('circle',{x:_x,y:_y}), rectangle: (_x:any,_y:any,w:any,h:any)=>new FakeGameObject('rectangle',{x:_x,y:_y,breite:w,hoehe:h}), image: (_x:any,_y:any,t:any)=>new FakeGameObject('image',{x:_x,y:_y,textur:t}) }, scale: { gameSize: { width: 1280, height: 720 }, on: vi.fn(), off: vi.fn() }, scene: { start: vi.fn() }, tweens: t, time: { addEvent: ()=>({remove:()=>{}}) }, textures: { exists: ()=>true, addCanvas: ()=>{} }, game: { loop: { sleep: vi.fn(), wake: vi.fn() } } });
  s.create();
  return { s, t };
}

beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); Object.defineProperty(globalThis, 'localStorage', { value: richteLocalStorageEin(), configurable: true, writable: true }); });
afterEach(() => { aktiveSzene?.shutdown(); aktiveSzene = undefined; vi.useRealTimers(); });

describe('TischSzene', () => {
  it('rendert Karten und reagiert auf Klick', async () => {
    const { s } = baueSzene(baueZustand());
    // Eigene Karten (SUED) leben seit der Reconciliation in persistenteEigeneKarten, nicht in tischEbene.
    const eigeneKarten = Array.from((s['persistenteEigeneKarten'] as Map<string, any>).values());
    expect(eigeneKarten.length).toBeGreaterThan(0);
    eigeneKarten[0].emit('pointerdown');
    await vi.runAllTimersAsync();
    expect(appStoreHarness.store.spieleKarte).toHaveBeenCalled();
  });

  it('zeigt Rundenende-Modal', async () => {
    baueSzene(baueZustand({ partieStand: bauePartieStand(null) }));
    const neuerStand = {
      ...bauePartieStand(null),
      letztesSpielergebnis: {
        spielNummer: 1,
        spieltyp: 'NORMALSPIEL' as const,
        siegerPartei: 'RE' as const,
        spielwert: 1,
        grundwert: 1,
        absagePunkte: 0,
        gegenDieAltenPunkte: 0,
        soloMultiplikator: 1,
        augenProPartei: { RE: 130, KONTRA: 110 },
        spielpunkteProSpieler: { SUED: 1, WEST: -1, NORD: 1, OST: -1 },
        sonderpunkteProPartei: { RE: [], KONTRA: [] }
      }
    };
    appStoreHarness.setZustand(baueZustand({ partieStand: neuerStand }));
    appStoreHarness.sendeZustand();
    appStoreHarness.sendeEvent({ ereignisTyp: 'SPIEL_BEENDET', partieStand: neuerStand, timestamp: new Date().toISOString() });
    await vi.runAllTimersAsync();
    const modal = document.querySelector('.ui-rundenauswertung-overlay') as HTMLElement;
    expect(modal).not.toBeNull();
    expect(modal.hidden).toBe(false);
  });

  it('spielt Karte per Tastatur', async () => {
    baueSzene(baueZustand({ partieStand: bauePartieStand(baueLaufendesSpiel({ spielbareKarten: [karte('H1','H','Z'), karte('K1','K','A')] })) }));
    await vi.runAllTimersAsync(); // Animationen abwarten
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await vi.runAllTimersAsync();
    expect(appStoreHarness.store.spieleKarte).toHaveBeenCalledWith('K1');
  });

  it('lehnt Armut ab', () => {
    baueSzene(baueZustand({ partieStand: bauePartieStand(baueLaufendesSpiel({ spieltyp: 'ARMUT', phase: 'ARMUT_TAUSCH', spieler: [baueSpieler('SUED','A',{verbleibendeKarten:12}), baueSpieler('WEST','B',{verbleibendeKarten:9})] })) }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true }));
    expect(appStoreHarness.store.beantworteArmut).toHaveBeenCalledWith(false, []);
  });

  it('zeigt Schweinchen-Banner mit korrektem Spielernamen aus absolutePosition', async () => {
    // Wichtig: e.spielerPosition ist absolute Backend-Position (WEST = Ben).
    // Ohne absolutePosition-Abgleich zeigt der Banner immer "Spieler: Schweinchen!".
    const { s } = baueSzene(baueZustand());
    const bannerSpy = vi.spyOn(s as any, 'zeigeSchweinchenBanner').mockResolvedValue(undefined);

    appStoreHarness.sendeEvent({
      ereignisTyp: 'SCHWEINCHEN_GEMELDET',
      spielerPosition: 'WEST',
      partieStand: { ...bauePartieStand(baueLaufendesSpiel()), version: 2 },
      version: 2,
      timestamp: new Date().toISOString()
    });
    await vi.runAllTimersAsync();

    expect(bannerSpy).toHaveBeenCalledWith('Ben: Schweinchen!');
  });

  it('zeigt Ansage-Buttons (DOM-Marker) wenn moeglicheAnsagen gesetzt sind', () => {
    // Wichtig: Sichert ab, dass der Spieler die Ansage-Optionen in der FAB sehen kann.
    baueSzene(baueZustand({
      partieStand: bauePartieStand(baueLaufendesSpiel({ moeglicheAnsagen: ['RE', 'KONTRA'] }))
    }));
    expect(document.querySelector('[data-testid="btn-ansage-re"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="btn-ansage-kontra"]')).not.toBeNull();
  });

  it('zeigt keine Ansage-Buttons wenn moeglicheAnsagen leer sind', () => {
    // Wichtig: Verhindert tote UI-Elemente wenn keine Ansage regelkonform moeglich ist.
    baueSzene(baueZustand({
      partieStand: bauePartieStand(baueLaufendesSpiel({ moeglicheAnsagen: [] }))
    }));
    expect(document.querySelector('[data-testid^="btn-ansage-"]')).toBeNull();
  });

  it('zeigt keine Ansage-Buttons wenn ein anderer Spieler am Zug ist', () => {
    // Wichtig: Verhindert, dass FAB-Buttons fuer fremde Spieler angezeigt werden.
    baueSzene(baueZustand({
      partieStand: bauePartieStand(baueLaufendesSpiel({ aktuellerSpieler: 'WEST', moeglicheAnsagen: ['RE'] }))
    }));
    expect(document.querySelector('[data-testid^="btn-ansage-"]')).toBeNull();
  });

  it('entfernt Ansage-Buttons wenn Zustand auf keine Ansagen wechselt', () => {
    // Wichtig: Nach einer Ansage oder Spielzugwechsel darf kein Geister-Button sichtbar bleiben.
    baueSzene(baueZustand({
      partieStand: bauePartieStand(baueLaufendesSpiel({ moeglicheAnsagen: ['RE'] }))
    }));
    expect(document.querySelector('[data-testid="btn-ansage-re"]')).not.toBeNull();

    appStoreHarness.setZustand(baueZustand({
      partieStand: bauePartieStand(baueLaufendesSpiel({ moeglicheAnsagen: [] }))
    }));
    appStoreHarness.sendeZustand();
    expect(document.querySelector('[data-testid="btn-ansage-re"]')).toBeNull();
  });

  it('R-Taste loest RE-Ansage aus', () => {
    // Wichtig: Tastatur-Shortcut fuer schnelles Re-Ansagen ohne Maus.
    baueSzene(baueZustand({
      partieStand: bauePartieStand(baueLaufendesSpiel({ moeglicheAnsagen: ['RE'] }))
    }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true }));
    expect(appStoreHarness.store.sageAnsageAn).toHaveBeenCalledWith('RE');
  });

  it('K-Taste loest KONTRA-Ansage aus', () => {
    // Wichtig: Tastatur-Shortcut fuer schnelles Kontra-Ansagen ohne Maus.
    baueSzene(baueZustand({
      partieStand: bauePartieStand(baueLaufendesSpiel({ moeglicheAnsagen: ['KONTRA'] }))
    }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', bubbles: true }));
    expect(appStoreHarness.store.sageAnsageAn).toHaveBeenCalledWith('KONTRA');
  });

  it('R-Taste loest keine Ansage aus wenn keine Ansagen verfuegbar sind', () => {
    // Wichtig: Shortcut darf nicht "blind" feuern wenn keine Ansage moeglich ist.
    baueSzene(baueZustand({
      partieStand: bauePartieStand(baueLaufendesSpiel({ moeglicheAnsagen: [] }))
    }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true }));
    expect(appStoreHarness.store.sageAnsageAn).not.toHaveBeenCalled();
  });

  it('I-Taste oeffnet Seitenlade', () => {
    // Wichtig: Tastatur-Shortcut muss Seitenlade zuverlaessig toggeln; sonst kein Zugang ohne Maus.
    const { s } = baueSzene(baueZustand());
    expect(s['seitenladeOffen']).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'I', bubbles: true }));
    expect(s['seitenladeOffen']).toBe(true);
  });

  it('Escape-Taste schliesst Seitenlade', () => {
    // Wichtig: Konsistentes Schliessen per Escape verhindert, dass die Seitenlade "haengen bleibt"
    // und Spieler keine offensichtliche Moeglichkeit haben, sie wieder zu schliessen.
    const { s } = baueSzene(baueZustand());
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'I', bubbles: true }));
    expect(s['seitenladeOffen']).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(s['seitenladeOffen']).toBe(false);
  });

  it('Seitenlade zeigt LETZTE STICHE wenn Stiche vorhanden', () => {
    // Wichtig: Kerninhalt der Seitenlade — Spieler muessen sehen koennen wer welchen Stich gewann.
    const { s } = baueSzene(baueZustand({
      partieStand: {
        ...bauePartieStand(baueLaufendesSpiel()),
        letzteAbgeschlosseneStiche: [
          { spielNummer: 1, stichNummer: 1, aufspielerPosition: 'SUED', gewinnerPosition: 'SUED', augen: 25, gespielteKarten: [] },
          { spielNummer: 1, stichNummer: 2, aufspielerPosition: 'WEST', gewinnerPosition: 'WEST', augen: 14, gespielteKarten: [] }
        ]
      }
    }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'I', bubbles: true }));
    const texte = (s['tischEbene'] as any).kinder
      .filter((k: any) => k.typ === 'text')
      .map((k: any) => k.text as string);
    expect(texte.some((t: string) => t === 'LETZTE STICHE')).toBe(true);
    expect(texte.some((t: string) => t.includes('25 Augen'))).toBe(true);
    expect(texte.some((t: string) => t.includes('14 Augen'))).toBe(true);
  });

  it('Seitenlade zeigt keinen LETZTE-STICHE-Abschnitt ohne Stiche', () => {
    // Wichtig: Verhindert leeren Abschnitts-Header wenn noch kein Stich gespielt wurde.
    const { s } = baueSzene(baueZustand({
      partieStand: { ...bauePartieStand(baueLaufendesSpiel()), letzteAbgeschlosseneStiche: [] }
    }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'I', bubbles: true }));
    const texte = (s['tischEbene'] as any).kinder
      .filter((k: any) => k.typ === 'text')
      .map((k: any) => k.text as string);
    expect(texte.some((t: string) => t === 'LETZTE STICHE')).toBe(false);
  });

  it('S-Taste oeffnet Einstellungs-Modal und rendert Inhalt', () => {
    // Wichtig: Ohne diesen Test koennte ein Refactoring den S-Shortcut oder den renderEinstellungsModal-Aufruf leise brechen.
    const { s } = baueSzene(baueZustand());
    expect(s['einstellungenOffen']).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'S', bubbles: true }));
    expect(s['einstellungenOffen']).toBe(true);
    const texte = (s['tischEbene'] as any).kinder
      .filter((k: any) => k.typ === 'text')
      .map((k: any) => k.text as string);
    expect(texte.some((t: string) => t === 'Einstellungen')).toBe(true);
    expect(texte.some((t: string) => t === 'Tischhintergrund')).toBe(true);
    expect(texte.some((t: string) => t === 'KI-Schwierigkeit')).toBe(true);
  });

  it('Escape-Taste schliesst Einstellungs-Modal', () => {
    // Wichtig: Ohne Escape-Unterstuetzung kann der Spieler das Modal nicht per Tastatur schliessen.
    const { s } = baueSzene(baueZustand());
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'S', bubbles: true }));
    expect(s['einstellungenOffen']).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(s['einstellungenOffen']).toBe(false);
    const texte = (s['tischEbene'] as any).kinder
      .filter((k: any) => k.typ === 'text')
      .map((k: any) => k.text as string);
    expect(texte.some((t: string) => t === 'Einstellungen')).toBe(false);
  });

  it('Backdrop-Klick schliesst Einstellungs-Modal', () => {
    // Wichtig: Standard-Modal-Verhalten; ohne diesen Test koennte der Backdrop-Handler unbemerkt entfernt werden.
    const { s } = baueSzene(baueZustand());
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'S', bubbles: true }));
    const kinder = (s['tischEbene'] as any).kinder;
    const backdrop = kinder.find((k: any) => k.typ === 'rectangle' && k.interactive && k.breite === 1280);
    expect(backdrop).toBeDefined();
    backdrop.emit('pointerdown');
    expect(s['einstellungenOffen']).toBe(false);
  });

  it('KI-Schwierigkeit Button deaktiviert fuer Nicht-Ersteller', () => {
    // Wichtig: Sicherheitsregel — nur Tischersteller darf KI-Einstellung aendern; sonst koennte jeder Mitspieler die KI verstellen.
    const fremdTisch = { ...baueTisch(), status: 'WARTEND' as const, erstelltVonSpielerId: 'jemand-anderes' };
    const { s } = baueSzene(baueZustand({ aktuellerTisch: fremdTisch }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'S', bubbles: true }));
    const kinder = (s['tischEbene'] as any).kinder;
    const kiTextIdx = kinder.findIndex((k: any) => k.typ === 'text' && k.text === 'STANDARD');
    expect(kiTextIdx).toBeGreaterThanOrEqual(0);
    expect(kinder[kiTextIdx - 1].interactive).toBe(false);
  });

  it('KI-Schwierigkeit Button aktiv fuer Ersteller im WARTEND-Status', () => {
    // Wichtig: Ersteller muss KI-Schwierigkeit konfigurieren koennen; ohne diesen Test koennte die Bedingung versehentlich immer deaktivieren.
    const eigenerTisch = { ...baueTisch(), status: 'WARTEND' as const, erstelltVonSpielerId: 'sp-SUED' };
    const { s } = baueSzene(baueZustand({ aktuellerTisch: eigenerTisch }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'S', bubbles: true }));
    const kinder = (s['tischEbene'] as any).kinder;
    const kiTextIdx = kinder.findIndex((k: any) => k.typ === 'text' && k.text === 'STANDARD');
    expect(kiTextIdx).toBeGreaterThanOrEqual(0);
    expect(kinder[kiTextIdx - 1].interactive).toBe(true);
  });

  it('Klick auf eigenen Stich-Stapel (SUED) zeigt Overlay', () => {
    // Wichtig: Grundverhalten — eigene Stiche koennen weiterhin umgedreht werden (Regression-Schutz fuer den Fix).
    const stich = { spielNummer: 1, stichNummer: 1, aufspielerPosition: 'SUED', gewinnerPosition: 'SUED', augen: 25, gespielteKarten: [{ karte: karte('H1', 'HERZ', 'ZEHN'), spielerPosition: 'SUED' }] };
    const spielerMitStich = { ...baueSpieler('SUED', 'Anna', { verbleibendeKarten: 0, sichtbareHandkarten: [] }), gewonneneStiche: 2 };
    const { s } = baueSzene(baueZustand({
      partieStand: { ...bauePartieStand(baueLaufendesSpiel({ spieler: [spielerMitStich, baueSpieler('WEST', 'Ben'), baueSpieler('NORD', 'Clara'), baueSpieler('OST', 'Dirk')] })), letzteAbgeschlosseneStiche: [stich] }
    }));
    expect(s['letzterStichOverlay']).toBeUndefined();
    const kinder = (s['tischEbene'] as any).kinder;
    // Stich-HitZone hat breite ≈ stapelW*1.3 ≈ 79 bei 1280px — Buttons haben ≥110px
    const hitZone = kinder.find((k: any) => k.typ === 'rectangle' && k.interactive === true && k.breite < 100);
    expect(hitZone).toBeDefined();
    hitZone.emit('pointerdown');
    expect(s['letzterStichOverlay']).toBeDefined();
  });

  it('Klick auf fremden Stich-Stapel (WEST) zeigt Overlay', () => {
    // Wichtig: Kernfix — alle Spieler duerfen den letzten Stich jedes anderen Spielers umdrehen, nicht nur den eigenen.
    const stichWest = { spielNummer: 1, stichNummer: 2, aufspielerPosition: 'WEST', gewinnerPosition: 'WEST', augen: 14, gespielteKarten: [{ karte: karte('K1', 'KREUZ', 'AS'), spielerPosition: 'WEST' }] };
    const westMitStich = { ...baueSpieler('WEST', 'Ben'), gewonneneStiche: 1 };
    const { s } = baueSzene(baueZustand({
      partieStand: { ...bauePartieStand(baueLaufendesSpiel({ spieler: [baueSpieler('SUED', 'Anna', { verbleibendeKarten: 0, sichtbareHandkarten: [] }), westMitStich, baueSpieler('NORD', 'Clara'), baueSpieler('OST', 'Dirk')] })), letzteAbgeschlosseneStiche: [stichWest] }
    }));
    expect(s['letzterStichOverlay']).toBeUndefined();
    const kinder = (s['tischEbene'] as any).kinder;
    // Stich-HitZone hat breite ≈ stapelW*1.3 ≈ 79 bei 1280px — Buttons haben ≥110px
    const hitZone = kinder.find((k: any) => k.typ === 'rectangle' && k.interactive === true && k.breite < 100);
    expect(hitZone).toBeDefined();
    hitZone.emit('pointerdown');
    expect(s['letzterStichOverlay']).toBeDefined();
  });

  it('Kein Klick-Handler wenn kein letzter Stich fuer Spieler vorhanden', () => {
    // Wichtig: Verhindert fehlerhafte Interaktivitaet auf Stich-Stapeln ohne zugehoerigen letzten Stich.
    const westOhneStich = { ...baueSpieler('WEST', 'Ben'), gewonneneStiche: 2 };
    const { s } = baueSzene(baueZustand({
      partieStand: { ...bauePartieStand(baueLaufendesSpiel({ spieler: [baueSpieler('SUED', 'Anna', { verbleibendeKarten: 0, sichtbareHandkarten: [] }), westOhneStich, baueSpieler('NORD', 'Clara'), baueSpieler('OST', 'Dirk')] })), letzteAbgeschlosseneStiche: [] }
    }));
    const kinder = (s['tischEbene'] as any).kinder;
    // Stich-HitZone hat breite ≈ stapelW*1.3 ≈ 79 bei 1280px — Buttons haben ≥110px
    const hitZones = kinder.filter((k: any) => k.typ === 'rectangle' && k.interactive === true && k.breite < 100);
    expect(hitZones.length).toBe(0);
  });

  it('Animationsgeschwindigkeit Button zykliert und speichert in localStorage', () => {
    // Wichtig: Persistenz der Animationsgeschwindigkeit ist Kernfunktion; ohne diesen Test koennte localStorage-Schreiben leise wegfallen.
    const { s } = baueSzene(baueZustand());
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'S', bubbles: true }));
    const kinder = (s['tischEbene'] as any).kinder;
    const geschwTextIdx = kinder.findIndex((k: any) => k.typ === 'text' && typeof k.text === 'string' && (k.text as string).startsWith('Geschw.:'));
    expect(geschwTextIdx).toBeGreaterThanOrEqual(0);
    const geschwBg = kinder[geschwTextIdx - 1];
    expect(geschwBg.interactive).toBe(true);
    geschwBg.emit('pointerdown');
    expect(localStorage.getItem('locodoko.animationsgeschwindigkeit')).toBe('2');
  });
});
