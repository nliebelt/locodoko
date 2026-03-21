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
      starteAktuellenTisch: vi.fn()
    }
  };
});

vi.mock('../anwendung', () => ({
  appStore: appStoreHarness.store
}));

vi.mock('phaser', () => {
  class FakeScene {
    add!: unknown;

    scale!: unknown;

    scene!: unknown;

    constructor() {}
  }

  return {
    default: {
      Scene: FakeScene,
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

  setStrokeStyle(): this {
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
  mindestkartenSchwarz: 7
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
    tileSprite(x: number, y: number, breite: number, hoehe: number, textur: string): FakeGameObject {
      return new FakeGameObject('tileSprite', { x, y, breite, hoehe, textur });
    },
    container(): FakeContainer {
      return new FakeContainer();
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

// Liefert die Handkarten-Bilder des eigenen Spielers (SUED) aus der Tischebene.
// Erkennungsmerkmale: Image-Typ, kartenspezifische Textur (karte-offen-*), Y-Position > 500.
function handkartenBilder(szene: TischSzeneInstanz): FakeGameObject[] {
  const ebene = szene['tischEbene'] as FakeContainer | undefined;
  return (ebene?.kinder ?? [])
    .filter((kind) => kind.typ === 'image' && (kind.textur?.startsWith('karte-offen-') ?? false) && kind.y > 500)
    .sort((links, rechts) => links.x - rechts.x);
}

function holeButton(text: string): HTMLButtonElement {
  const button = Array.from(document.querySelectorAll('button'))
    .find((element) => element.textContent?.trim() === text);
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Button "${text}" wurde nicht gefunden.`);
  }
  return button;
}

beforeEach(() => {
  vi.clearAllMocks();
  richteDomEin();
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
    expect(bilder[1].alpha).toBe(0.5);

    const startY = bilder[0].y;
    bilder[0].emit('pointerover');
    expect(bilder[0].y).toBe(startY - 10);
    bilder[0].emit('pointerout');
    expect(bilder[0].y).toBe(startY);

    bilder[0].emit('pointerdown');
    expect(tweens.add).toHaveBeenCalledTimes(1);
    expect(tweens.aufrufe[0].duration).toBe(400);
    await Promise.resolve();
    await Promise.resolve();
    expect(appStoreHarness.store.spieleKarte).toHaveBeenCalledWith('HERZ-ZEHN-1');
  });

  it('zeigt serverseitig erlaubte Vorbehalte an und sendet die Auswahl zurueck', () => {
    const zustand = baueZustand({
      partieStand: bauePartieStand(baueLaufendesSpiel({
        phase: 'VORBEHALT_ANSAGE',
        spielbareKarten: [],
        moeglicheVorbehalte: ['GESUND', 'ARMUT']
      }))
    });

    baueSzene(zustand);

    expect(() => holeButton('Gesund')).not.toThrow();
    expect(() => holeButton('Armut')).not.toThrow();
    expect(Array.from(document.querySelectorAll('button')).some((button) => button.textContent?.trim() === 'Bubensolo')).toBe(false);

    holeButton('Armut').click();
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

  it('zeigt Fehler-Toasts und regelkonforme Ansage-Buttons im DOM an', () => {
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

    baueSzene(zustand);

    const toast = document.querySelector('.ui-toast.ui-toast--error');
    expect(toast?.textContent).toContain('Ansagefenster ist bereits geschlossen.');

    holeButton('Re').click();
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

    const bestaetigen = holeButton('Trumpfkarten anbieten');
    expect(bestaetigen.disabled).toBe(false);
    bestaetigen.click();

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

    expect(tweens.add).toHaveBeenCalledTimes(1);
    expect(tweens.aufrufe[0].duration).toBe(600);
    vi.useRealTimers();
  });
});
