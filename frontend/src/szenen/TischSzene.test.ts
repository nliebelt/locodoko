// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TEXTUR_FILZ, TEXTUR_HOLZ_DUNKEL } from '../assets/AssetLoader';
import type {
  AppZustand
} from '../store/AppStore';
import type {
  AbgeschlossenerStichAntwort,
  KarteAntwort,
  LaufendesSpielAntwort,
  PartieStandAntwort,
  SpielerImSpielAntwort,
  TischKonfigurationDto,
  TischAntwort
} from '../modelle/SpielverwaltungDto';

type Handler = () => void;

function richteLocalStorageEin(initialeWerte: Record<string, string> = {}): Storage {
  const speicher = new Map(Object.entries(initialeWerte));
  return {
    get length() {
      return speicher.size;
    },
    clear(): void {
      speicher.clear();
    },
    getItem(schluessel: string): string | null {
      return speicher.get(schluessel) ?? null;
    },
    key(index: number): string | null {
      return Array.from(speicher.keys())[index] ?? null;
    },
    removeItem(schluessel: string): void {
      speicher.delete(schluessel);
    },
    setItem(schluessel: string, wert: string): void {
      speicher.set(schluessel, wert);
    }
  };
}

const appStoreHarness = vi.hoisted(() => {
  let zustand: unknown;
  let listener: ((wert: unknown) => void) | undefined;

  return {
    setZustand(neuerZustand: unknown): void {
      zustand = structuredClone(neuerZustand);
    },
    sendeZustand(): void {
      listener?.(structuredClone(zustand));
    },
    store: {
      abonnieren: vi.fn((callback: (wert: unknown) => void) => {
        listener = callback;
        callback(structuredClone(zustand));
        return vi.fn();
      }),
      snapshot: vi.fn(() => structuredClone(zustand)),
      spieleKarte: vi.fn(),
      sageAnsageAn: vi.fn(),
      meldeVorbehalt: vi.fn(),
      beantworteArmut: vi.fn(),
      aktualisiereAktuellenTischhintergrund: vi.fn(),
      toggleDebugModus: vi.fn(),
      verlasseAktuellenTisch: vi.fn(),
      starteAktuellenTisch: vi.fn(),
      starteNeuePartie: vi.fn()
    }
  };
});

vi.mock('../anwendung', () => ({
  appStore: appStoreHarness.store
}));

vi.mock('phaser', () => {
  class FakeContainerBasis {
    readonly typ = 'container';

    x: number;

    y: number;

    alpha = 1;

    winkel = 0;

    scaleX = 1;

    scaleY = 1;

    interactive = false;

    zerstort = false;

    textur?: string;

    tint?: number;

    readonly kinder: unknown[] = [];

    private readonly handler = new Map<string, Array<() => void>>();

    constructor(_szene?: unknown, x = 0, y = 0) {
      this.x = x;
      this.y = y;
    }

    add(kind: unknown): this {
      this.kinder.push(kind);
      return this;
    }

    setSize(): this {
      return this;
    }

    setAngle(winkel: number): this {
      this.winkel = winkel;
      return this;
    }

    setAlpha(alpha: number): this {
      this.alpha = alpha;
      return this;
    }

    setY(y: number): this {
      this.y = y;
      return this;
    }

    setInteractive(): this {
      this.interactive = true;
      return this;
    }

    on(ereignis: string, handler: () => void): this {
      const eintraege = this.handler.get(ereignis) ?? [];
      eintraege.push(handler);
      this.handler.set(ereignis, eintraege);
      return this;
    }

    emit(ereignis: string): void {
      (this.handler.get(ereignis) ?? []).forEach((handler) => handler());
    }

    destroy(): this {
      this.zerstort = true;
      this.kinder.forEach((kind) => {
        if (typeof kind === 'object' && kind !== null && 'destroy' in kind && typeof kind.destroy === 'function') {
          kind.destroy();
        }
      });
      return this;
    }
  }

  class FakeScene {
    add!: unknown;

    scale!: unknown;

    scene!: unknown;

    constructor() {}
  }

  return {
    default: {
      Scene: FakeScene,
      GameObjects: {
        Container: FakeContainerBasis
      },
      Scale: {
        Events: {
          RESIZE: 'resize'
        }
      }
    }
  };
});

const { TischSzene } = await import('./TischSzene');
type TischSzeneInstanz = InstanceType<typeof TischSzene>;

class FakeGameObject {
  readonly typ: string;

  x: number;

  y: number;

  textur?: string;

  text?: string;

  alpha = 1;

  winkel = 0;

  breite?: number;

  hoehe?: number;

  darstellungsBreite?: number;

  darstellungsHoehe?: number;

  interactive = false;

  zerstort = false;

  tint?: number;

  private readonly handler = new Map<string, Handler[]>();

  constructor(typ: string, optionen: Partial<FakeGameObject> = {}) {
    this.typ = typ;
    this.x = optionen.x ?? 0;
    this.y = optionen.y ?? 0;
    Object.assign(this, optionen);
  }

  setDisplaySize(breite: number, hoehe: number): this {
    this.darstellungsBreite = breite;
    this.darstellungsHoehe = hoehe;
    return this;
  }

  setAngle(winkel: number): this {
    this.winkel = winkel;
    return this;
  }

  setAlpha(alpha: number): this {
    this.alpha = alpha;
    return this;
  }

  setTint(tint: number): this {
    this.tint = tint;
    return this;
  }

  setOrigin(): this {
    return this;
  }

  setDepth(): this {
    return this;
  }

  setStrokeStyle(): this {
    return this;
  }

  fillStyle(): this {
    return this;
  }

  lineStyle(): this {
    return this;
  }

  fillRoundedRect(): this {
    return this;
  }

  strokeRoundedRect(): this {
    return this;
  }

  lineBetween(): this {
    return this;
  }

  clear(): this {
    return this;
  }

  setPosition(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }

  setSize(breite: number, hoehe: number): this {
    this.breite = breite;
    this.hoehe = hoehe;
    return this;
  }

  setY(y: number): this {
    this.y = y;
    return this;
  }

  setTexture(textur: string): this {
    this.textur = textur;
    return this;
  }

  setInteractive(): this {
    this.interactive = true;
    return this;
  }

  on(ereignis: string, handler: Handler): this {
    const eintraege = this.handler.get(ereignis) ?? [];
    eintraege.push(handler);
    this.handler.set(ereignis, eintraege);
    return this;
  }

  emit(ereignis: string): void {
    (this.handler.get(ereignis) ?? []).forEach((handler) => handler());
  }

  destroy(): this {
    this.zerstort = true;
    return this;
  }
}

class FakeContainer extends FakeGameObject {
  readonly kinder: FakeGameObject[] = [];

  constructor() {
    super('container');
  }

  add(kind: FakeGameObject): this {
    this.kinder.push(kind);
    return this;
  }

  destroy(rekursiv?: boolean): this {
    this.zerstort = true;
    if (rekursiv) {
      this.kinder.forEach((kind) => kind.destroy());
    }
    return this;
  }
}

interface SzenenTestHarness {
  szene: TischSzeneInstanz;
  skalierung: {
    gameSize: { width: number; height: number };
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
  };
  szenenManager: { start: ReturnType<typeof vi.fn> };
  tweens: ReturnType<typeof erstelleTweenApi>;
}

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
  kiSchwierigkeit: 'STANDARD' as const
};

function karte(id: string, farbe: string, wert: string, exemplarIndex = 1): KarteAntwort {
  return { id, farbe, wert, exemplarIndex };
}

function baueSpieler(
  position: SpielerImSpielAntwort['position'],
  name: string,
  optionen: Partial<SpielerImSpielAntwort> = {}
): SpielerImSpielAntwort {
  return {
    position,
    spielerId: optionen.spielerId ?? `spieler-${position.toLowerCase()}`,
    name,
    istKi: optionen.istKi ?? position !== 'SUED',
    istSelbst: optionen.istSelbst ?? position === 'SUED',
    istGeber: optionen.istGeber ?? false,
    istAmZug: optionen.istAmZug ?? false,
    verbleibendeKarten: optionen.verbleibendeKarten ?? 0,
    gewonneneStiche: optionen.gewonneneStiche ?? 0,
    partei: optionen.partei ?? null,
    sichtbareHandkarten: optionen.sichtbareHandkarten ?? null
  };
}

function baueLaufendesSpiel(optionen: Partial<LaufendesSpielAntwort> = {}): LaufendesSpielAntwort {
  const spieler = optionen.spieler ?? [
    baueSpieler('SUED', 'Anna', {
      spielerId: 'spieler-1',
      istKi: false,
      istSelbst: true,
      istAmZug: true,
      verbleibendeKarten: 2,
      sichtbareHandkarten: [
        karte('HERZ-ZEHN-1', 'HERZ', 'ZEHN'),
        karte('KREUZ-AS-1', 'KREUZ', 'AS')
      ]
    }),
    baueSpieler('WEST', 'Ben', { verbleibendeKarten: 0, sichtbareHandkarten: null }),
    baueSpieler('NORD', 'Clara', { verbleibendeKarten: 0, sichtbareHandkarten: null }),
    baueSpieler('OST', 'Dirk', { verbleibendeKarten: 0, sichtbareHandkarten: null })
  ];
  return {
    spielNummer: 1,
    spieltyp: 'NORMALSPIEL',
    phase: 'STICHPHASE',
    geber: 'WEST',
    aktuellerSpieler: 'SUED',
    spieler,
    spielbareKarten: [karte('HERZ-ZEHN-1', 'HERZ', 'ZEHN')],
    aktuelleStichmitte: [],
    ansageHistorie: [],
    moeglicheAnsagen: [],
    moeglicheVorbehalte: [],
    ...optionen
  };
}

function bauePartieStand(laufendesSpiel: LaufendesSpielAntwort | null): PartieStandAntwort {
  return {
    partieId: 'partie-1',
    status: 'LAUFEND',
    anzahlSpiele: 8,
    gespielteSpiele: 0,
    gesamtpunktestand: { SUED: 0, WEST: 0, NORD: 0, OST: 0 },
    laufendesSpiel
  };
}

function baueAbgeschlossenenStich(): AbgeschlossenerStichAntwort {
  return {
    spielNummer: 1,
    stichNummer: 1,
    aufspielerPosition: 'SUED',
    gewinnerPosition: 'WEST',
    augen: 28,
    gespielteKarten: [
      { spielerPosition: 'SUED', karte: karte('HERZ-ZEHN-1', 'HERZ', 'ZEHN'), reihenfolge: 0 },
      { spielerPosition: 'WEST', karte: karte('KREUZ-AS-1', 'KREUZ', 'AS'), reihenfolge: 1 },
      { spielerPosition: 'NORD', karte: karte('PIK-KOENIG-1', 'PIK', 'KOENIG'), reihenfolge: 2 },
      { spielerPosition: 'OST', karte: karte('KARO-BUBE-1', 'KARO', 'BUBE'), reihenfolge: 3 }
    ]
  };
}

function baueTisch(): TischAntwort {
  return {
    id: 'tisch-1',
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
  };
}

function baueZustand(optionen: Partial<AppZustand> = {}): AppZustand {
  return {
    initialisiert: true,
    wirdGeladen: false,
    bereich: 'TISCH',
    verbindung: 'verbunden',
    debugModus: false,
    spieler: { spielerId: 'spieler-1', name: 'Anna', istKi: false },
    tische: [],
    aktuellerTisch: baueTisch(),
    partieStand: bauePartieStand(baueLaufendesSpiel()),
    meldung: null,
    ...optionen
  };
}

function erstelleAddApi() {
  return {
    existing(): void {
      // In Tests wird das Objekt direkt von der Szene gehalten; kein weiteres Verhalten noetig.
    },
    tileSprite(x: number, y: number, breite: number, hoehe: number, textur: string): FakeGameObject {
      return new FakeGameObject('tileSprite', { x, y, breite, hoehe, textur });
    },
    container(): FakeContainer {
      return new FakeContainer();
    },
    graphics(): FakeGameObject {
      return new FakeGameObject('graphics');
    },
    ellipse(x: number, y: number, breite: number, hoehe: number): FakeGameObject {
      return new FakeGameObject('ellipse', { x, y, breite, hoehe });
    },
    text(x: number, y: number, text: string): FakeGameObject {
      return new FakeGameObject('text', { x, y, text });
    },
    circle(x: number, y: number): FakeGameObject {
      return new FakeGameObject('circle', { x, y });
    },
    rectangle(x: number, y: number): FakeGameObject {
      return new FakeGameObject('rectangle', { x, y });
    },
    image(x: number, y: number, textur: string): FakeGameObject {
      return new FakeGameObject('image', { x, y, textur });
    }
  };
}

function erstelleTweenApi() {
  const aufrufe: Array<Record<string, unknown>> = [];
  return {
    aufrufe,
    add: vi.fn((konfiguration: Record<string, unknown>) => {
      aufrufe.push(konfiguration);
      const ziele = Array.isArray(konfiguration.targets)
        ? konfiguration.targets as FakeGameObject[]
        : [konfiguration.targets as FakeGameObject];
      const zielX = typeof konfiguration.x === 'number' ? konfiguration.x : undefined;
      const zielY = typeof konfiguration.y === 'number' ? konfiguration.y : undefined;
      const zielAlpha = typeof konfiguration.alpha === 'number' ? konfiguration.alpha : undefined;
      if (zielX !== undefined) {
        ziele.forEach((ziel) => {
          ziel.x = zielX;
        });
      }
      if (zielY !== undefined) {
        ziele.forEach((ziel) => {
          ziel.y = zielY;
        });
      }
      if (zielAlpha !== undefined) {
        ziele.forEach((ziel) => {
          (ziel as FakeGameObject).alpha = zielAlpha;
        });
      }
      const onComplete = konfiguration.onComplete;
      if (typeof onComplete === 'function') {
        onComplete();
      }
      return {
        stop: vi.fn()
      };
    })
  };
}

function richteDomEin(): void {
  document.body.innerHTML = '<div id="ui-root"></div>';
}

function baueSzene(zustand: AppZustand, groesse = { width: 1280, height: 720 }): SzenenTestHarness {
  richteDomEin();
  appStoreHarness.setZustand(zustand);

  const szene = new TischSzene();
  const skalierung = {
    gameSize: { ...groesse },
    on: vi.fn(),
    off: vi.fn()
  };
  const szenenManager = {
    start: vi.fn()
  };
  const tweens = erstelleTweenApi();

  Object.assign(szene, {
    add: erstelleAddApi(),
    scale: skalierung,
    scene: szenenManager,
    tweens,
    textures: {
      exists: vi.fn(() => false),
      addCanvas: vi.fn()
    }
  });

  szene.create();

  return { szene, skalierung, szenenManager, tweens };
}

// Liefert die Handkarten-Ansichten des eigenen Spielers (SUED) aus der Tischebene.
// Erkennungsmerkmale: Kartenansicht-Typ, kartenspezifische Textur (karte-offen-*), Y-Position > 500.
function handkartenBilder(szene: TischSzeneInstanz): FakeGameObject[] {
  const ebene = szene['tischEbene'] as FakeContainer | undefined;
  return (ebene?.kinder ?? [])
    .filter((kind) => kind.typ === 'kartenansicht' && (kind.textur?.startsWith('karte-offen-') ?? false) && kind.y > 500)
    .sort((links, rechts) => links.x - rechts.x);
}

// Liefert alle Text-Objekte aus der Phaser-Tischebene (fuer Phaser-UI-Pruefungen).
function phaserTexte(szene: TischSzeneInstanz): FakeGameObject[] {
  const ebene = szene['tischEbene'] as FakeContainer | undefined;
  return (ebene?.kinder ?? []).filter((kind) => kind.typ === 'text');
}

// Prueft ob ein Phaser-Text mit dem exakten Inhalt in der Tischebene existiert.
function hatPhaserText(szene: TischSzeneInstanz, text: string): boolean {
  return phaserTexte(szene).some((kind) => kind.text === text);
}

// Liefert das interaktive Rechteck, das dem Phaser-Button mit dem gegebenen Label entspricht.
// Da erstellePhaserButton zuerst das Rechteck, dann den Text hinzufuegt, liegt das Rechteck
// am Index (buttonTextIndex - 1) in der Kinderliste.
function phaserButtonRectFuerLabel(szene: TischSzeneInstanz, label: string): FakeGameObject | undefined {
  const ebene = szene['tischEbene'] as FakeContainer | undefined;
  const kinder = ebene?.kinder ?? [];
  const textIndex = kinder.findIndex((kind) => kind.typ === 'text' && kind.text === label);
  if (textIndex < 1) {
    return undefined;
  }
  return kinder[textIndex - 1];
}

// Loest den pointerdown-Handler des Phaser-Buttons mit dem gegebenen Label aus.
function klickePhaserButton(szene: TischSzeneInstanz, label: string): void {
  const rect = phaserButtonRectFuerLabel(szene, label);
  if (!rect) {
    throw new Error(`Phaser-Button "${label}" wurde nicht gefunden.`);
  }
  rect.emit('pointerdown');
}


beforeEach(() => {
  vi.clearAllMocks();
  richteDomEin();
  Object.defineProperty(globalThis, 'localStorage', {
    value: richteLocalStorageEin(),
    configurable: true,
    writable: true
  });
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('TischSzene', () => {
  it('bricht mit klarer Fehlermeldung ab, wenn die UI-Wurzel fehlt', () => {
    document.body.innerHTML = '';
    appStoreHarness.setZustand(baueZustand());

    const szene = new TischSzene();
    Object.assign(szene, {
      add: erstelleAddApi(),
      scale: {
        gameSize: { width: 1280, height: 720 },
        on: vi.fn(),
        off: vi.fn()
      },
      scene: { start: vi.fn() }
    });

    expect(() => szene.create()).toThrow('Die UI-Wurzel #ui-root wurde nicht gefunden.');
  });

  it('rendert spielbare Karten interaktiv, dimmt unspielbare Karten und animiert den Klick zur Tischmitte', async () => {
    const { szene, tweens } = baueSzene(baueZustand());
    const bilder = handkartenBilder(szene);

    expect(bilder).toHaveLength(2);
    expect(bilder[0].interactive).toBe(true);
    expect(bilder[0].alpha).toBe(1);
    expect(bilder[1].interactive).toBe(false);
    expect(bilder[1].alpha).toBe(0.45);

    const startY = bilder[0].y;
    bilder[0].emit('pointerover');
    // Hover-Versatz: round(kgroesse.h * 0.08); bei 110x165px Zielgroesse: round(165 * 0.08) = 13
    expect(bilder[0].y).toBe(startY - 13);
    bilder[0].emit('pointerout');
    expect(bilder[0].y).toBe(startY);

    bilder[0].emit('pointerdown');
    expect(tweens.add).toHaveBeenCalledTimes(1);
    expect(tweens.aufrufe[0].duration).toBe(400);
    await Promise.resolve();
    await Promise.resolve();
    expect(appStoreHarness.store.spieleKarte).toHaveBeenCalledWith('HERZ-ZEHN-1');
  });

  it('zeigt serverseitig erlaubte Vorbehalte als Phaser-Buttons an und sendet die Auswahl zurueck', () => {
    const zustand = baueZustand({
      partieStand: bauePartieStand(baueLaufendesSpiel({
        phase: 'VORBEHALT_ANSAGE',
        spielbareKarten: [],
        moeglicheVorbehalte: ['GESUND', 'ARMUT']
      }))
    });

    const { szene } = baueSzene(zustand);

    // Vorbehalt-Dialog rendert als Phaser-Text (kein HTML-Modal mehr)
    expect(hatPhaserText(szene, 'Gesund')).toBe(true);
    expect(hatPhaserText(szene, 'Armut')).toBe(true);
    expect(hatPhaserText(szene, 'Bubensolo')).toBe(false);

    klickePhaserButton(szene, 'Armut');
    expect(appStoreHarness.store.meldeVorbehalt).toHaveBeenCalledWith('ARMUT');
  });

  it('zeigt den konfigurierten Tischhintergrund an und leitet Aenderungen an den Store weiter', () => {
    const { szene } = baueSzene(baueZustand({
      aktuellerTisch: {
        ...baueTisch(),
        status: 'WARTEND',
        konfiguration: {
          ...standardKonfiguration,
          tischhintergrund: 'HOLZ_DUNKEL'
        }
      },
      partieStand: null
    }));

    const hintergrund = szene['hintergrund'] as unknown as FakeGameObject;
    const select = document.querySelector('[data-tischhintergrund]');

    expect(hintergrund.textur).toBe(TEXTUR_HOLZ_DUNKEL);
    expect(select).toBeInstanceOf(HTMLSelectElement);
    expect((select as HTMLSelectElement).value).toBe('HOLZ_DUNKEL');

    (select as HTMLSelectElement).value = 'BLAU_GRAFIK';
    select?.dispatchEvent(new Event('change'));

    expect(appStoreHarness.store.aktualisiereAktuellenTischhintergrund).toHaveBeenCalledWith('BLAU_GRAFIK');
  });

  it('zeigt Fehler-Toasts und regelkonforme Ansage-Buttons als Phaser-Objekte an', () => {
    const zustand = baueZustand({
      partieStand: bauePartieStand(baueLaufendesSpiel({
        moeglicheAnsagen: ['RE']
      })),
      meldung: {
        typ: 'fehler',
        text: 'Ansagefenster ist bereits geschlossen.',
        fehlerCode: 'ANSAGE_UNGUELTIG'
      }
    });

    const { szene } = baueSzene(zustand);

    // Toast bleibt HTML
    const toast = document.querySelector('.ui-toast.ui-toast--error');
    expect(toast?.textContent).toContain('Ansagefenster ist bereits geschlossen.');

    // Ansage-Buttons sind jetzt Phaser-Objekte
    expect(hatPhaserText(szene, 'Re')).toBe(true);
    klickePhaserButton(szene, 'Re');
    expect(appStoreHarness.store.sageAnsageAn).toHaveBeenCalledWith('RE');
  });

  it('unterstuetzt den Armut-Auswahlfluss ueber Kartenklick und Bestaetigungsbutton', () => {
    const laufendesSpiel = baueLaufendesSpiel({
      phase: 'ARMUT_TAUSCH',
      spielbareKarten: [],
      spieler: [
        baueSpieler('SUED', 'Anna', {
          spielerId: 'spieler-1',
          istKi: false,
          istSelbst: true,
          istAmZug: true,
          verbleibendeKarten: 2,
          sichtbareHandkarten: [
            karte('KARO-KOENIG-1', 'KARO', 'KOENIG'),
            karte('KREUZ-AS-1', 'KREUZ', 'AS')
          ]
        }),
        baueSpieler('WEST', 'Ben', { verbleibendeKarten: 5, sichtbareHandkarten: null }),
        baueSpieler('NORD', 'Clara', { verbleibendeKarten: 5, sichtbareHandkarten: null }),
        baueSpieler('OST', 'Dirk', { verbleibendeKarten: 5, sichtbareHandkarten: null })
      ]
    });
    const { szene } = baueSzene(baueZustand({
      partieStand: bauePartieStand(laufendesSpiel)
    }));

    const ersteRunde = handkartenBilder(szene);
    expect(ersteRunde[0].interactive).toBe(true);
    expect(ersteRunde[1].interactive).toBe(false);

    ersteRunde[0].emit('pointerdown');

    const zweiteRunde = handkartenBilder(szene);
    expect(zweiteRunde[0].tint).toBe(0xffe082);

    klickePhaserButton(szene, 'Trumpfkarten anbieten');

    expect(appStoreHarness.store.beantworteArmut).toHaveBeenCalledWith(true, ['KARO-KOENIG-1']);
  });

  it('rendert bei Resize mit aktualisiertem Layout neu', () => {
    const { szene, skalierung } = baueSzene(baueZustand());
    const alterHintergrund = szene['hintergrund'] as unknown as FakeGameObject;
    const alterContainer = szene['tischEbene'] as unknown as FakeContainer;
    const erstesBildVorher = handkartenBilder(szene)[0];

    skalierung.gameSize.width = 1600;
    skalierung.gameSize.height = 900;
    szene['handleResize']();

    const neuerHintergrund = szene['hintergrund'] as unknown as FakeGameObject;
    const neuerContainer = szene['tischEbene'] as unknown as FakeContainer;
    const erstesBildNachher = handkartenBilder(szene)[0];

    expect(alterContainer.zerstort).toBe(true);
    expect(neuerContainer).not.toBe(alterContainer);
    expect(neuerHintergrund).toBe(alterHintergrund);
    expect(neuerHintergrund.textur).toBe(TEXTUR_FILZ);
    expect(neuerHintergrund.breite).toBe(1600);
    expect(neuerHintergrund.hoehe).toBe(900);
    expect(erstesBildNachher.x).toBeGreaterThan(erstesBildVorher.x);
  });

  it('animiert das Kartenausteilen wenn ein neues Spiel beginnt', async () => {
    // WARUM: Ohne diese Absicherung koennte die Austeilen-Animation heimlich wegbrechen oder
    // doppelt feuern, weil das Spielstart-Signal (neue spielNummer) subtil und asynchron ist.
    vi.useFakeTimers();
    // Szene startet ohne laufendes Spiel — Tisch ist im Wartezustand (WARTEND),
    // damit ermittleNeuesSpiel() einen echten Spielstart erkennt (nicht Reconnect).
    const zustandOhneSpiel = baueZustand({
      partieStand: bauePartieStand(null),
      aktuellerTisch: { ...baueTisch(), status: 'WARTEND' }
    });
    const { tweens } = baueSzene(zustandOhneSpiel);

    // Neues Spiel mit 2 Karten pro Spieler (4 Spieler = 8 Karten gesamt)
    const neuesSpiel = baueLaufendesSpiel({
      spielNummer: 1,
      phase: 'VORBEHALT_ANSAGE',
      spieler: [
        baueSpieler('SUED', 'Anna', {
          spielerId: 'spieler-1',
          istKi: false,
          istSelbst: true,
          verbleibendeKarten: 2,
          sichtbareHandkarten: [
            karte('HERZ-ZEHN-1', 'HERZ', 'ZEHN'),
            karte('KREUZ-AS-1', 'KREUZ', 'AS')
          ]
        }),
        baueSpieler('WEST', 'Ben', { verbleibendeKarten: 2, sichtbareHandkarten: null }),
        baueSpieler('NORD', 'Clara', { verbleibendeKarten: 2, sichtbareHandkarten: null }),
        baueSpieler('OST', 'Dirk', { verbleibendeKarten: 2, sichtbareHandkarten: null })
      ],
      spielbareKarten: []
    });
    appStoreHarness.setZustand(baueZustand({ partieStand: bauePartieStand(neuesSpiel) }));
    appStoreHarness.sendeZustand();

    // Animationen laufen asynchron – noch kein Tween synchron ausgeloest
    expect(tweens.add).toHaveBeenCalledTimes(0);

    await vi.runAllTimersAsync();

    // 4 Spieler * 2 Karten = 8 Tweens; jeder Tween bewegt eine Karte von der Mitte zur Hand
    expect(tweens.add).toHaveBeenCalledTimes(8);
    tweens.aufrufe.forEach((aufruf) => {
      expect(aufruf.duration).toBe(75);
    });
    vi.useRealTimers();
  });

  it('animiert einen abgeschlossenen Stich gesammelt zum Gewinner', async () => {
    vi.useFakeTimers();
    const laufendesSpielVorher = baueLaufendesSpiel({
      aktuelleStichmitte: baueAbgeschlossenenStich().gespielteKarten
    });
    const zustandVorher = baueZustand({
      partieStand: bauePartieStand(laufendesSpielVorher)
    });
    const { tweens } = baueSzene(zustandVorher);
    const laufendesSpielNachher = baueLaufendesSpiel({
      spieler: [
        baueSpieler('SUED', 'Anna', {
          spielerId: 'spieler-1',
          istKi: false,
          istSelbst: true,
          istAmZug: false,
          verbleibendeKarten: 1,
          sichtbareHandkarten: [karte('KREUZ-AS-2', 'KREUZ', 'AS')]
        }),
        baueSpieler('WEST', 'Ben', { istAmZug: true, verbleibendeKarten: 0, sichtbareHandkarten: null, gewonneneStiche: 1 }),
        baueSpieler('NORD', 'Clara', { verbleibendeKarten: 0, sichtbareHandkarten: null }),
        baueSpieler('OST', 'Dirk', { verbleibendeKarten: 0, sichtbareHandkarten: null })
      ],
      aktuelleStichmitte: []
    });
    appStoreHarness.setZustand(baueZustand({
      partieStand: {
        ...bauePartieStand(laufendesSpielNachher),
        letzteAbgeschlosseneStiche: [baueAbgeschlossenenStich()]
      }
    }));

    appStoreHarness.sendeZustand();
    expect(tweens.add).toHaveBeenCalledTimes(0);

    await vi.runAllTimersAsync();

    // Flash-Tween (alpha rein) + 4 Karten × 2 Tweens (tweenZu + tweenScale) + 3 Popup-Tweens + Flash-Tween (alpha raus) = 13
    expect(tweens.add).toHaveBeenCalledTimes(13);
    // Index 0 = Flash alpha-in (200ms); Index 1 = erster Karten-Move-Tween (600ms)
    expect(tweens.aufrufe[1].duration).toBe(600);
    vi.useRealTimers();
  });

  // WARUM: Das Sonderpunkt-Feedback ist der einzige sofortige visuelle Hinweis auf Fuchs/Karlchen/Doppelkopf
  // im Spielfluss; ohne diese Absicherung koennte das Feedback bei State-Updates heimlich wegfallen.
  it('zeigt ein Alpha-Tween-Feedback wenn ein neuer Sonderpunkt eintrifft', async () => {
    vi.useFakeTimers();
    const zustandOhneSonderpunkt = baueZustand({
      partieStand: bauePartieStand(null)
    });
    const { tweens } = baueSzene(zustandOhneSonderpunkt);

    // Neuer Zustand: Spielergebnis mit Fuchs-Gefangen-Sonderpunkt fuer Re
    appStoreHarness.setZustand(baueZustand({
      partieStand: {
        ...bauePartieStand(null),
        letztesSpielergebnis: {
          spielNummer: 1,
          spieltyp: 'NORMALSPIEL',
          siegerPartei: 'RE',
          spielwert: 1,
          augenProPartei: { RE: 130, KONTRA: 110 },
          spielpunkteProSpieler: { SUED: 1, WEST: -1, NORD: 1, OST: -1 },
          sonderpunkteProPartei: { RE: ['FUCHS_GEFANGEN'], KONTRA: [] }
        }
      }
    }));
    appStoreHarness.sendeZustand();

    // Fade-In Tween (alpha → 1) wurde synchron ausgeloest
    expect(tweens.add).toHaveBeenCalledTimes(1);
    expect(tweens.aufrufe[0].alpha).toBe(1);
    expect(tweens.aufrufe[0].duration).toBe(200);

    // Nach Ablauf der Sichtbarkeitszeit: Fade-Out Tween (alpha → 0)
    await vi.runAllTimersAsync();

    expect(tweens.add).toHaveBeenCalledTimes(2);
    expect(tweens.aufrufe[1].alpha).toBe(0);
    vi.useRealTimers();
  });

  // WARUM: Das Ansage-Banner ist der einzige sofortige visuelle Hinweis auf Re/Kontra;
  // ohne diese Absicherung koennte das Banner bei State-Updates heimlich wegfallen.
  it('zeigt ein Alpha-Tween-Banner wenn eine neue Ansage eintrifft', async () => {
    vi.useFakeTimers();
    const zustandOhneAnsage = baueZustand({
      partieStand: bauePartieStand(baueLaufendesSpiel({ ansageHistorie: [] }))
    });
    const { tweens } = baueSzene(zustandOhneAnsage);

    // Neuer Zustand: erste Ansage "Re" von Spieler SUED (Anna)
    appStoreHarness.setZustand(baueZustand({
      partieStand: bauePartieStand(baueLaufendesSpiel({
        ansageHistorie: [{ spielerPosition: 'SUED', ansage: 'RE' }]
      }))
    }));
    appStoreHarness.sendeZustand();

    // Fade-In Tween (alpha → 1) wurde synchron ausgeloest
    expect(tweens.add).toHaveBeenCalledTimes(1);
    expect(tweens.aufrufe[0].alpha).toBe(1);
    expect(tweens.aufrufe[0].duration).toBe(300);

    // Nach Ablauf der Sichtbarkeitszeit: Fade-Out Tween (alpha → 0)
    await vi.runAllTimersAsync();

    expect(tweens.add).toHaveBeenCalledTimes(2);
    expect(tweens.aufrufe[1].alpha).toBe(0);
    vi.useRealTimers();
  });

  // WARUM: Das Rundenende-Modal ist der primäre Mechanismus um Spielergebnisse nach Rundenende
  // prominent darzustellen; ohne diese Absicherung koennte das Modal bei State-Updates
  // heimlich wegfallen und der Spieler das Ergebnis nicht sehen.
  it('zeigt das Rundenende-Modal wenn ein neues Spielergebnis eintrifft', () => {
    const zustandOhneErgebnis = baueZustand({
      partieStand: bauePartieStand(null)
    });
    baueSzene(zustandOhneErgebnis);

    const modal = document.querySelector('.ui-modal-backdrop') as HTMLElement;
    expect(modal).toBeTruthy();
    expect(modal.hidden).toBe(true);

    appStoreHarness.setZustand(baueZustand({
      partieStand: {
        ...bauePartieStand(null),
        letztesSpielergebnis: {
          spielNummer: 1,
          spieltyp: 'NORMALSPIEL',
          siegerPartei: 'RE',
          spielwert: 1,
          augenProPartei: { RE: 130, KONTRA: 110 },
          spielpunkteProSpieler: { SUED: 1, WEST: -1, NORD: 1, OST: -1 },
          sonderpunkteProPartei: { RE: ['FUCHS_GEFANGEN'], KONTRA: [] }
        }
      }
    }));
    appStoreHarness.sendeZustand();

    expect(modal.hidden).toBe(false);
    expect(modal.querySelector('h2')?.textContent).toBe('NORMALSPIEL · Spiel 1 von 8');
    expect(modal.querySelector('strong')?.textContent).toBe('RE gewinnt  (+1 Punkte)');
  });

  // WARUM: Der Schliessen-Button ist das einzige Mittel fuer den Spieler, das Modal zu
  // schliessen und weiterzuspielen; faellt er weg, blockiert das Modal den Spielfluss dauerhaft.
  it('schliesst das Rundenende-Modal wenn OK geklickt wird', () => {
    const zustandOhneErgebnis = baueZustand({ partieStand: bauePartieStand(null) });
    baueSzene(zustandOhneErgebnis);

    appStoreHarness.setZustand(baueZustand({
      partieStand: {
        ...bauePartieStand(null),
        letztesSpielergebnis: {
          spielNummer: 1,
          spieltyp: 'NORMALSPIEL',
          siegerPartei: 'KONTRA',
          spielwert: 2,
          augenProPartei: { RE: 100, KONTRA: 140 },
          spielpunkteProSpieler: { SUED: -2, WEST: 2, NORD: -2, OST: 2 },
          sonderpunkteProPartei: { RE: [], KONTRA: ['KARLCHEN'] }
        }
      }
    }));
    appStoreHarness.sendeZustand();

    const modal = document.querySelector('.ui-modal-backdrop') as HTMLElement;
    expect(modal.hidden).toBe(false);

    const okButton = modal.querySelector('button') as HTMLButtonElement;
    okButton.click();

    expect(modal.hidden).toBe(true);
  });

  // WARUM: Spec (frontend-rundenauswertung.md) schreibt vor dass Escape das Rundenende-Modal
  // NICHT schliessen darf — nur der Weiter-Button oder Enter. Dies verhindert versehentliches
  // Schliessen waehrend der Spieler das Ergebnis liest.
  it('schliesst das Rundenende-Modal NICHT bei Escape-Taste (nur Weiter-Button/Enter)', () => {
    baueSzene(baueZustand({ partieStand: bauePartieStand(null) }));

    appStoreHarness.setZustand(baueZustand({
      partieStand: {
        ...bauePartieStand(null),
        letztesSpielergebnis: {
          spielNummer: 1,
          spieltyp: 'NORMALSPIEL',
          siegerPartei: 'RE',
          spielwert: 1,
          augenProPartei: { RE: 130, KONTRA: 110 },
          spielpunkteProSpieler: { SUED: 1, WEST: -1, NORD: 1, OST: -1 },
          sonderpunkteProPartei: { RE: [], KONTRA: [] }
        }
      }
    }));
    appStoreHarness.sendeZustand();

    const modal = document.querySelector('.ui-modal-backdrop') as HTMLElement;
    expect(modal.hidden).toBe(false);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    // Escape darf das Modal NICHT schliessen
    expect(modal.hidden).toBe(false);
  });

  // WARUM: Backdrop-Klick ist ein gaengiges UX-Muster fuer modale Dialoge;
  // Klick auf den Dialog-Inhalt selbst darf das Modal dagegen nicht schliessen.
  it('schliesst das Rundenende-Modal bei Klick auf den Backdrop aber nicht auf den Inhalt', () => {
    baueSzene(baueZustand({ partieStand: bauePartieStand(null) }));

    appStoreHarness.setZustand(baueZustand({
      partieStand: {
        ...bauePartieStand(null),
        letztesSpielergebnis: {
          spielNummer: 2,
          spieltyp: 'NORMALSPIEL',
          siegerPartei: 'KONTRA',
          spielwert: 1,
          augenProPartei: { RE: 110, KONTRA: 130 },
          spielpunkteProSpieler: { SUED: -1, WEST: 1, NORD: -1, OST: 1 },
          sonderpunkteProPartei: { RE: [], KONTRA: [] }
        }
      }
    }));
    appStoreHarness.sendeZustand();

    const modal = document.querySelector('.ui-modal-backdrop') as HTMLElement;
    expect(modal.hidden).toBe(false);

    // Klick auf Dialog-Inhalt: Modal bleibt offen
    const dialogInhalt = modal.querySelector('.ui-modal') as HTMLElement;
    dialogInhalt.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(modal.hidden).toBe(false);

    // Klick direkt auf Backdrop: Modal schliesst
    modal.dispatchEvent(new MouseEvent('click', { bubbles: false }));
    expect(modal.hidden).toBe(true);
  });

  // WARUM: Das Partie-Ende-Modal ist der einzige Hinweis fuer den Spieler, dass die gesamte
  // Partie abgeschlossen ist; ohne diese Absicherung koennte das Modal wegfallen und Spieler
  // wuerdten nach dem letzten Spiel vor einem leeren Tisch sitzen ohne Feedback oder Neustart.
  it('zeigt das Partie-Ende-Modal statt des Rundenende-Modals wenn partieBeendet true ist', () => {
    const zustandOhneErgebnis = baueZustand({
      partieStand: bauePartieStand(null)
    });
    baueSzene(zustandOhneErgebnis);

    const modals = document.querySelectorAll('.ui-modal-backdrop');
    expect(modals.length).toBe(2);
    const rundenEndeModal = modals[0] as HTMLElement;
    const partieEndeModal = modals[1] as HTMLElement;
    expect(rundenEndeModal.hidden).toBe(true);
    expect(partieEndeModal.hidden).toBe(true);

    appStoreHarness.setZustand(baueZustand({
      partieStand: {
        ...bauePartieStand(null),
        status: 'BEENDET',
        gespielteSpiele: 8,
        letztesSpielergebnis: {
          spielNummer: 8,
          spieltyp: 'NORMALSPIEL',
          siegerPartei: 'RE',
          spielwert: 1,
          augenProPartei: { RE: 130, KONTRA: 110 },
          spielpunkteProSpieler: { SUED: 1, WEST: -1, NORD: 1, OST: -1 },
          sonderpunkteProPartei: { RE: [], KONTRA: [] }
        }
      }
    }));
    appStoreHarness.sendeZustand();

    expect(rundenEndeModal.hidden).toBe(true);
    expect(partieEndeModal.hidden).toBe(false);
    expect(partieEndeModal.querySelector('h2')?.textContent).toBe('Partie beendet!');
    expect(partieEndeModal.querySelector('.ui-hint')?.textContent).toContain('Neue Partie startet in');
  });

  // WARUM: Der Countdown-Mechanismus stellt sicher, dass das Spiel automatisch neustartet,
  // ohne dass alle Spieler manuell klicken muessen. Der Test sichert ab, dass starteNeuePartie()
  // nach Ablauf des Countdowns aufgerufen wird — sonst haengt das Spiel nach jeder Partie.
  it('ruft starteNeuePartie nach Countdown-Ablauf auf', async () => {
    vi.useFakeTimers();
    try {
      const zustandOhneErgebnis = baueZustand({ partieStand: bauePartieStand(null) });
      baueSzene(zustandOhneErgebnis);

      appStoreHarness.setZustand(baueZustand({
        partieStand: {
          ...bauePartieStand(null),
          status: 'BEENDET',
          letztesSpielergebnis: {
            spielNummer: 8,
            spieltyp: 'NORMALSPIEL',
            siegerPartei: 'KONTRA',
            spielwert: 2,
            augenProPartei: { RE: 100, KONTRA: 140 },
            spielpunkteProSpieler: { SUED: -2, WEST: 2, NORD: -2, OST: 2 },
            sonderpunkteProPartei: { RE: [], KONTRA: [] }
          }
        }
      }));
      appStoreHarness.sendeZustand();

      expect(appStoreHarness.store.starteNeuePartie).not.toHaveBeenCalled();

      // Countdown-Intervall 10x à 1 Sekunde ablaufen lassen
      await vi.advanceTimersByTimeAsync(10_000);

      expect(appStoreHarness.store.starteNeuePartie).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  // WARUM: Das Modal darf nicht erneut erscheinen wenn derselbe Spielstand nochmal eintrifft
  // (z.B. durch Snapshot-Refresh); nur ein neues spielNummer darf es ausloesen.
  it('zeigt das Rundenende-Modal nicht erneut fuer dasselbe Spielergebnis', () => {
    const spielergebnis = {
      spielNummer: 1,
      spieltyp: 'NORMALSPIEL' as const,
      siegerPartei: 'RE' as const,
      spielwert: 1,
      augenProPartei: { RE: 130, KONTRA: 110 },
      spielpunkteProSpieler: { SUED: 1, WEST: -1, NORD: 1, OST: -1 },
      sonderpunkteProPartei: { RE: [], KONTRA: [] }
    };
    const zustandMitErgebnis = baueZustand({
      partieStand: { ...bauePartieStand(null), letztesSpielergebnis: spielergebnis }
    });
    baueSzene(zustandMitErgebnis);

    const modal = document.querySelector('.ui-modal-backdrop') as HTMLElement;
    // Modal beim ersten Update sichtbar
    expect(modal.hidden).toBe(false);
    // Schliessen
    const okButton = modal.querySelector('button') as HTMLButtonElement;
    okButton.click();
    expect(modal.hidden).toBe(true);

    // Nochmal denselben Zustand senden — kein erneutes Modal
    appStoreHarness.sendeZustand();
    expect(modal.hidden).toBe(true);
  });

  // WARUM: Ansage-Buttons sind der einzige Weg um Re/Kontra zu melden;
  // fehlen sie, verliert der Spieler moegliche Punkte.
  it('zeigt Ansage-Buttons als Phaser-Objekte wenn Ansagen moeglich sind', () => {
    const zustand = baueZustand({
      partieStand: bauePartieStand(baueLaufendesSpiel({
        moeglicheAnsagen: ['RE', 'KEINE_90']
      }))
    });

    const { szene } = baueSzene(zustand);

    expect(hatPhaserText(szene, 'Re')).toBe(true);
    expect(hatPhaserText(szene, 'Keine 90')).toBe(true);

    klickePhaserButton(szene, 'Re');
    expect(appStoreHarness.store.sageAnsageAn).toHaveBeenCalledWith('RE');
  });

  // WARUM: Wenn keine Ansagen moeglich sind, duerfen auch keine Ansage-Buttons sichtbar sein —
  // sonst verwirrt es den Spieler oder loest versehentliche Aktionen aus.
  it('zeigt keine Ansage-Buttons wenn keine Ansagen moeglich sind', () => {
    const zustand = baueZustand({
      partieStand: bauePartieStand(baueLaufendesSpiel({
        moeglicheAnsagen: []
      }))
    });

    const { szene } = baueSzene(zustand);

    expect(hatPhaserText(szene, 'Re')).toBe(false);
    expect(hatPhaserText(szene, 'Keine 90')).toBe(false);
  });

  // WARUM: Der Vorbehalt-Dialog muss alle Optionen zeigen damit der Spieler seinen
  // Vorbehalt melden kann — fehlt er, haengt das Spiel in der Vorbehalt-Phase.
  it('zeigt den Vorbehalt-Dialog als Phaser-Overlay wenn eigene Vorbehalte moeglich sind', () => {
    const zustand = baueZustand({
      partieStand: bauePartieStand(baueLaufendesSpiel({
        phase: 'VORBEHALT_ANSAGE',
        spielbareKarten: [],
        moeglicheVorbehalte: ['GESUND', 'HOCHZEIT', 'ARMUT']
      }))
    });

    const { szene } = baueSzene(zustand);

    expect(hatPhaserText(szene, 'Gesund')).toBe(true);
    expect(hatPhaserText(szene, 'Hochzeit')).toBe(true);
    expect(hatPhaserText(szene, 'Armut')).toBe(true);

    klickePhaserButton(szene, 'Gesund');
    expect(appStoreHarness.store.meldeVorbehalt).toHaveBeenCalledWith('GESUND');
  });

  // WARUM: Der Vorbehalt-Dialog darf nur fuer den eigenen Spieler erscheinen; zeigt er sich
  // auch wenn ein anderer Spieler am Zug ist, blockiert er die Sicht unnoetig.
  it('zeigt keinen Vorbehalt-Dialog wenn ein anderer Spieler am Zug ist', () => {
    const zustand = baueZustand({
      partieStand: bauePartieStand(baueLaufendesSpiel({
        phase: 'VORBEHALT_ANSAGE',
        aktuellerSpieler: 'WEST',
        spielbareKarten: [],
        moeglicheVorbehalte: []
      }))
    });

    const { szene } = baueSzene(zustand);

    expect(hatPhaserText(szene, 'Gesund')).toBe(false);
    expect(hatPhaserText(szene, 'Hochzeit')).toBe(false);
  });

  // ── Tastatursteuerung ───────────────────────────────────────────────────────

  function feuereTaste(taste: string, optionen: KeyboardEventInit = {}): void {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: taste, bubbles: true, ...optionen }));
  }

  // WARUM: Die Vorbehalt-Ziffer-Auswahl ist der einzige Weg, ohne Maus eine Entscheidung
  // in der Vorbehalt-Phase zu treffen; fehlt sie, blockiert das Modal den Spielverlauf.
  it('waehlt Vorbehalt per Ziffer 1 aus', () => {
    const zustand = baueZustand({
      partieStand: bauePartieStand(baueLaufendesSpiel({
        phase: 'VORBEHALT_ANSAGE',
        spielbareKarten: [],
        moeglicheVorbehalte: ['GESUND', 'HOCHZEIT']
      }))
    });
    baueSzene(zustand);

    feuereTaste('1');

    expect(appStoreHarness.store.meldeVorbehalt).toHaveBeenCalledWith('GESUND');
  });

  // WARUM: Direktauswahl per Ziffer spart Zeit; Ziffer 2 muss die zweite Option treffen,
  // sonst ist die Nummerierung inkonsistent.
  it('waehlt Vorbehalt per Ziffer 2 aus', () => {
    const zustand = baueZustand({
      partieStand: bauePartieStand(baueLaufendesSpiel({
        phase: 'VORBEHALT_ANSAGE',
        spielbareKarten: [],
        moeglicheVorbehalte: ['GESUND', 'HOCHZEIT', 'ARMUT']
      }))
    });
    baueSzene(zustand);

    feuereTaste('2');

    expect(appStoreHarness.store.meldeVorbehalt).toHaveBeenCalledWith('HOCHZEIT');
  });

  // WARUM: Enter bestaetigt die aktuell markierte Vorbehalt-Option; ohne Enter-Unterstuetzung
  // koennte die Vorbehalt-Phase nicht vollstaendig per Tastatur gespielt werden.
  it('bestaetigt Vorbehalt per Enter', () => {
    const zustand = baueZustand({
      partieStand: bauePartieStand(baueLaufendesSpiel({
        phase: 'VORBEHALT_ANSAGE',
        spielbareKarten: [],
        moeglicheVorbehalte: ['GESUND', 'HOCHZEIT']
      }))
    });
    baueSzene(zustand);

    // ArrowDown navigiert zur zweiten Option, Enter bestaetigt sie
    feuereTaste('ArrowDown');
    feuereTaste('Enter');

    expect(appStoreHarness.store.meldeVorbehalt).toHaveBeenCalledWith('HOCHZEIT');
  });

  // WARUM: R- und K-Kuerzel sind die schnellsten Eingaben fuer Re/Kontra-Ansagen;
  // fehlen sie, muessen Spieler mit der Maus auf Buttons klicken.
  it('sagt Re per R-Taste an', () => {
    const zustand = baueZustand({
      partieStand: bauePartieStand(baueLaufendesSpiel({
        moeglicheAnsagen: ['RE', 'KEINE_90']
      }))
    });
    baueSzene(zustand);

    feuereTaste('r');

    expect(appStoreHarness.store.sageAnsageAn).toHaveBeenCalledWith('RE');
  });

  // WARUM: Ziffer-Kuerzel fuer Ansagen ermoeglicht erfahrenen Spielern blinde Bedienung;
  // stellt sicher dass 1=Re, 2=Keine90 korrekt verknuepft ist.
  it('sagt Ansage per Ziffer 2 an', () => {
    const zustand = baueZustand({
      partieStand: bauePartieStand(baueLaufendesSpiel({
        moeglicheAnsagen: ['RE', 'KEINE_90']
      }))
    });
    baueSzene(zustand);

    feuereTaste('2');

    expect(appStoreHarness.store.sageAnsageAn).toHaveBeenCalledWith('KEINE_90');
  });

  // WARUM: ArrowRight + Enter ist das Kernszenario der Karten-Tastaturnavigation;
  // sichert ab dass spieleKarte mit der naechsten spielbaren Karte aufgerufen wird.
  it('spielt Karte per ArrowRight und Enter', async () => {
    const spiel = baueLaufendesSpiel({
      spielbareKarten: [
        karte('HERZ-ZEHN-1', 'HERZ', 'ZEHN'),
        karte('KREUZ-AS-1', 'KREUZ', 'AS')
      ]
    });
    const zustand = baueZustand({
      partieStand: bauePartieStand(spiel)
    });
    baueSzene(zustand);

    // ArrowRight bewegt Auswahl von Index 0 auf Index 1
    feuereTaste('ArrowRight');
    feuereTaste('Enter');

    // spieleKarteMitAnimation ist async (zwei Promise-Ebenen: tweenZu + spieleKarte-Aufruf)
    await Promise.resolve();
    await Promise.resolve();

    expect(appStoreHarness.store.spieleKarte).toHaveBeenCalledWith('KREUZ-AS-1');
  });

  // WARUM: Die erste spielbare Karte soll beim Spielzugbeginn automatisch markiert sein;
  // fehlt der Auto-Fokus, muessen Spieler erst ArrowRight druecken bevor Enter hilft.
  it('markiert die erste spielbare Karte automatisch bei Spielzugbeginn', async () => {
    // Beginne ohne eigenen Spielzug
    const zustandOhneZug = baueZustand({
      partieStand: bauePartieStand(baueLaufendesSpiel({
        aktuellerSpieler: 'WEST',
        spielbareKarten: []
      }))
    });
    baueSzene(zustandOhneZug);

    // Jetzt eigener Spielzug beginnt
    appStoreHarness.setZustand(baueZustand({
      partieStand: bauePartieStand(baueLaufendesSpiel({
        aktuellerSpieler: 'SUED',
        spielbareKarten: [
          karte('HERZ-ZEHN-1', 'HERZ', 'ZEHN'),
          karte('KREUZ-AS-1', 'KREUZ', 'AS')
        ]
      }))
    }));
    appStoreHarness.sendeZustand();

    // Enter direkt → erste Karte wird gespielt (Index 0 auto-gesetzt)
    feuereTaste('Enter');

    // spieleKarteMitAnimation ist async (zwei Promise-Ebenen: tweenZu + spieleKarte-Aufruf)
    await Promise.resolve();
    await Promise.resolve();

    expect(appStoreHarness.store.spieleKarte).toHaveBeenCalledWith('HERZ-ZEHN-1');
  });

  // WARUM: Escape soll die Kartenmarkierung aufheben ohne die Karte zu spielen;
  // ohne Escape-Unterstuetzung gibt es keinen Weg, eine versehentliche Auswahl rueckgaengig zu machen.
  it('hebt Kartenmarkierung per Escape auf', () => {
    const spiel = baueLaufendesSpiel({
      spielbareKarten: [karte('HERZ-ZEHN-1', 'HERZ', 'ZEHN')]
    });
    const zustand = baueZustand({
      partieStand: bauePartieStand(spiel)
    });
    baueSzene(zustand);

    // Escape setzt Index auf -1: danach kein spieleKarte-Aufruf bei Enter
    feuereTaste('Escape');
    feuereTaste('Enter');

    expect(appStoreHarness.store.spieleKarte).not.toHaveBeenCalled();
  });

  // WARUM: I-Kuerzel oeffnet die Seitenlade; ohne Tastaturzugang zur Seitenlade
  // sind Spielerliste, Punktestand und Ansagehistorie nur per Maus erreichbar.
  it('oeffnet die Seitenlade per I-Taste', () => {
    baueSzene(baueZustand());

    const seitenlade = document.querySelector('.seitenlade') as HTMLElement;
    expect(seitenlade.classList.contains('seitenlade--offen')).toBe(false);

    feuereTaste('i');

    expect(seitenlade.classList.contains('seitenlade--offen')).toBe(true);
  });

  // WARUM: S-Kuerzel oeffnet das Einstellungs-Modal; ohne Tastaturzugang koennen Spieler
  // Tischhintergrund und Animationsgeschwindigkeit nur per Maus aendern.
  it('oeffnet das Einstellungs-Modal per S-Taste', () => {
    baueSzene(baueZustand());

    const modal = document.querySelector('.einstellungen-backdrop') as HTMLElement;
    expect(modal.hidden).toBe(true);

    feuereTaste('s');

    expect(modal.hidden).toBe(false);
  });
});
