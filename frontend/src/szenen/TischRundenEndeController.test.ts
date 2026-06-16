// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TischAnsichtModell } from '../modelle/TischAnsichtModell';
import { PARTEI, SPIELER_POSITION } from '../modelle/TischAnsichtModell';
import type { AppZustand } from '../store/AppStore';

// === AppStore-Mock (Singleton aus ../anwendung) ===
const mockAppStore = vi.hoisted(() => ({
  setzeQueueFort: vi.fn(),
  snapshot: vi.fn(() => ({ countdownSekunden: 10 } as Partial<AppZustand>)),
  starteNeuePartie: vi.fn().mockResolvedValue(undefined),
  verlasseAktuellenTisch: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../anwendung', () => ({ appStore: mockAppStore }));

vi.mock('./tischFormatierer', () => ({
  formatiereVorbehalt: vi.fn((v: string) => v ?? null),
  formatiereSonderpunkt: vi.fn(() => 'Sonderpunkt'),
  formatiereCountdownText: vi.fn((n: number) => `${n}s`),
}));

vi.mock('../logger', () => ({ Logger: { szene: vi.fn() } }));

// === PhaserModal-Mock ===
const phaserModalHarness = vi.hoisted(() => {
  const destroyFn = vi.fn();
  const containerAddFn = vi.fn();
  const getContentContainerFn = vi.fn(() => ({ add: containerAddFn }));
  const setDepthFn = vi.fn().mockReturnThis();
  // Vitest 4: Reflect.construct erfordert reguläre Funktion, keine Arrow-Function
  const KlasseMock = vi.fn().mockImplementation(function () {
    return {
      destroy: destroyFn,
      getContentContainer: getContentContainerFn,
      setDepth: setDepthFn,
    };
  });
  return { destroyFn, containerAddFn, getContentContainerFn, setDepthFn, KlasseMock };
});

vi.mock('../ui/PhaserModal', () => ({ PhaserModal: phaserModalHarness.KlasseMock }));

// === Fake-Phaser.Math (wird in tweens.add ease verwendet) ===
vi.mock('phaser', () => ({
  default: {
    Math: { Easing: { Cubic: { Out: vi.fn() } } },
  },
}));

// === Hilfsfunktion: minimales TischAnsichtModell ===
function baueSpielergebnis(overrides: Record<string, unknown> = {}): any {
  return {
    spielNummer: 2,
    spieltyp: 'NORMALSPIEL',
    siegerPartei: PARTEI.RE,
    grundwert: 2,
    absagePunkte: 0,
    gegenDieAltenPunkte: 0,
    soloMultiplikator: 1,
    spielwert: 2,
    augenRe: 130,
    augenKontra: 110,
    sonderpunkteRe: [],
    sonderpunkteKontra: [],
    spielpunkte: [
      { position: SPIELER_POSITION.SUED, name: 'Ich', punkte: 2 },
      { position: SPIELER_POSITION.NORD, name: 'Nord', punkte: -2 },
    ],
    punkteAufschluesselung: [],
    ...overrides,
  };
}

function baueFakeModell(overrides: Partial<TischAnsichtModell> = {}): TischAnsichtModell {
  return {
    letztesSpielergebnis: baueSpielergebnis(),
    spieler: [
      { position: SPIELER_POSITION.SUED, name: 'Ich', partei: PARTEI.RE } as any,
      { position: SPIELER_POSITION.NORD, name: 'Nord', partei: PARTEI.KONTRA } as any,
    ],
    gesamtpunktestand: [
      { position: SPIELER_POSITION.SUED, name: 'Ich', punkte: 10 },
      { position: SPIELER_POSITION.NORD, name: 'Nord', punkte: 5 },
    ],
    ...overrides,
  } as TischAnsichtModell;
}

// === Fake-Szene mit Tween-Tracking ===
function baueSzene() {
  const erstellteTweens: Array<{ remove: ReturnType<typeof vi.fn> }> = [];

  const fakeText = () => ({
    setOrigin: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setColor: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    setText: vi.fn().mockReturnThis(),
    getData: vi.fn().mockReturnValue(false),
    setData: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  });

  const szene: any = {
    scale: { gameSize: { width: 1280, height: 720 } },
    add: {
      text: vi.fn().mockImplementation(() => fakeText()),
      existing: vi.fn(),
    },
    tweens: {
      add: vi.fn().mockImplementation((config: any) => {
        // Simuliert vollständig abgelaufenen Tween: t auf 1 setzen vor onUpdate
        if (Array.isArray(config.targets)) {
          config.targets.forEach((t: any) => { if (typeof t.t === 'number') t.t = 1; });
        }
        if (config.onUpdate) config.onUpdate();
        if (config.onComplete) config.onComplete();
        const mock = { remove: vi.fn() };
        erstellteTweens.push(mock);
        return mock;
      }),
    },
  };

  return { szene, erstellteTweens };
}

// === Lazy-Import nach vi.mock ===
async function ladeController() {
  const { TischRundenEndeController } = await import('./TischRundenEndeController');
  return TischRundenEndeController;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAppStore.snapshot.mockReturnValue({ countdownSekunden: 10 } as Partial<AppZustand>);
});

describe('TischRundenEndeController', () => {
  // ─────────────────────────────────────────────────────────────────────────
  describe('zeigeRundenEndeModal()', () => {
    it('setzt Queue fort und erstellt kein Modal wenn kein Spielergebnis vorhanden', async () => {
      const Klasse = await ladeController();
      const { szene } = baueSzene();
      const controller = new Klasse(szene, () => undefined);
      const modell = baueFakeModell({ letztesSpielergebnis: null });

      await controller.zeigeRundenEndeModal(modell);

      expect(mockAppStore.setzeQueueFort).toHaveBeenCalledOnce();
      expect(controller.phaserRundenEndeModal).toBeUndefined();
    });

    it('erstellt phaserRundenEndeModal wenn Spielergebnis vorhanden', async () => {
      const Klasse = await ladeController();
      const { szene } = baueSzene();
      const controller = new Klasse(szene, () => undefined);

      await controller.zeigeRundenEndeModal(baueFakeModell());

      expect(controller.phaserRundenEndeModal).toBeDefined();
    });

    it('enthält Spielzahl im Titel wenn anzahlSpiele in Konfiguration gesetzt', async () => {
      const Klasse = await ladeController();
      const { szene } = baueSzene();
      const getLetzterZustand = () =>
        ({ aktuellerTisch: { konfiguration: { anzahlSpiele: 12 } } } as any);
      const controller = new Klasse(szene, getLetzterZustand);

      await controller.zeigeRundenEndeModal(baueFakeModell());

      const konstruktorAufruf = phaserModalHarness.KlasseMock.mock.calls[0];
      const optionen = konstruktorAufruf?.[3];
      expect(optionen?.titel).toContain('2/12');
    });

    it('zeigt Spielnummer ohne Gesamtzahl wenn anzahlSpiele fehlt', async () => {
      const Klasse = await ladeController();
      const { szene } = baueSzene();
      const controller = new Klasse(szene, () => undefined);

      await controller.zeigeRundenEndeModal(baueFakeModell());

      const konstruktorAufruf = phaserModalHarness.KlasseMock.mock.calls[0];
      const optionen = konstruktorAufruf?.[3];
      expect(optionen?.titel).toContain('Spiel 2');
      expect(optionen?.titel).not.toContain('/');
    });

    it('fügt Modal in rundenauswertungObjekte ein', async () => {
      const Klasse = await ladeController();
      const { szene } = baueSzene();
      const controller = new Klasse(szene, () => undefined);

      await controller.zeigeRundenEndeModal(baueFakeModell());

      expect(controller.rundenauswertungObjekte.length).toBeGreaterThan(0);
      expect(controller.rundenauswertungObjekte[0]).toBeDefined();
    });

    it('erstellt CountUp-Tween beim Anzeigen', async () => {
      const Klasse = await ladeController();
      const { szene, erstellteTweens } = baueSzene();
      const controller = new Klasse(szene, () => undefined);

      await controller.zeigeRundenEndeModal(baueFakeModell());

      // Mindestens 1 Tween (countUp) muss erstellt worden sein
      expect(erstellteTweens.length).toBeGreaterThanOrEqual(1);
    });

    it('erstellt yoyo-Tweens wenn countUp abgeschlossen (t >= 0.95)', async () => {
      const Klasse = await ladeController();
      const { szene, erstellteTweens } = baueSzene();
      const controller = new Klasse(szene, () => undefined);
      const modell = baueFakeModell({
        letztesSpielergebnis: baueSpielergebnis({
          punkteAufschluesselung: [
            { label: 'Grundwert', punkte: 2 },
          ],
        }),
      });

      await controller.zeigeRundenEndeModal(modell);

      // countUp-Tween (1) + mindestens 1 yoyo-Tween für jeden Aufschlüsselungs-Eintrag
      expect(erstellteTweens.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe('schliesseRundenEndeModal()', () => {
    it('entfernt tweenCountUp', async () => {
      const Klasse = await ladeController();
      const { szene, erstellteTweens } = baueSzene();
      const controller = new Klasse(szene, () => undefined);
      await controller.zeigeRundenEndeModal(baueFakeModell());
      const countUpTween = erstellteTweens[0];

      controller.schliesseRundenEndeModal();

      expect(countUpTween.remove).toHaveBeenCalled();
    });

    it('entfernt alle yoyo-Tweens', async () => {
      const Klasse = await ladeController();
      const { szene, erstellteTweens } = baueSzene();
      const controller = new Klasse(szene, () => undefined);
      const modell = baueFakeModell({
        letztesSpielergebnis: baueSpielergebnis({
          punkteAufschluesselung: [{ label: 'Grundwert', punkte: 2 }],
        }),
      });
      await controller.zeigeRundenEndeModal(modell);
      // Alle erstellten Tweens (countUp + yoyo) müssen remove() erhalten
      expect(erstellteTweens.length).toBeGreaterThanOrEqual(2);

      controller.schliesseRundenEndeModal();

      erstellteTweens.forEach((tween) => {
        expect(tween.remove).toHaveBeenCalled();
      });
    });

    it('zerstört phaserRundenEndeModal', async () => {
      const Klasse = await ladeController();
      const { szene } = baueSzene();
      const controller = new Klasse(szene, () => undefined);
      await controller.zeigeRundenEndeModal(baueFakeModell());

      controller.schliesseRundenEndeModal();

      expect(phaserModalHarness.destroyFn).toHaveBeenCalled();
    });

    it('setzt phaserRundenEndeModal auf undefined', async () => {
      const Klasse = await ladeController();
      const { szene } = baueSzene();
      const controller = new Klasse(szene, () => undefined);
      await controller.zeigeRundenEndeModal(baueFakeModell());

      controller.schliesseRundenEndeModal();

      expect(controller.phaserRundenEndeModal).toBeUndefined();
    });

    it('leert rundenauswertungObjekte', async () => {
      const Klasse = await ladeController();
      const { szene } = baueSzene();
      const controller = new Klasse(szene, () => undefined);
      await controller.zeigeRundenEndeModal(baueFakeModell());

      controller.schliesseRundenEndeModal();

      expect(controller.rundenauswertungObjekte).toHaveLength(0);
    });

    it('setzt Queue nach Schließen fort', async () => {
      const Klasse = await ladeController();
      const { szene } = baueSzene();
      const controller = new Klasse(szene, () => undefined);
      await controller.zeigeRundenEndeModal(baueFakeModell());
      vi.clearAllMocks();

      controller.schliesseRundenEndeModal();

      expect(mockAppStore.setzeQueueFort).toHaveBeenCalledOnce();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe('zeigePartieEndeModal()', () => {
    it('setzt Queue fort und erstellt kein Modal wenn kein Spielergebnis vorhanden', async () => {
      const Klasse = await ladeController();
      const { szene } = baueSzene();
      const controller = new Klasse(szene, () => undefined);

      controller.zeigePartieEndeModal(baueFakeModell({ letztesSpielergebnis: null }));

      expect(mockAppStore.setzeQueueFort).toHaveBeenCalledOnce();
      expect(controller.phaserPartieEndeModal).toBeUndefined();
    });

    it('erstellt phaserPartieEndeModal wenn Spielergebnis vorhanden', async () => {
      const Klasse = await ladeController();
      const { szene } = baueSzene();
      const controller = new Klasse(szene, () => undefined);

      controller.zeigePartieEndeModal(baueFakeModell());

      expect(controller.phaserPartieEndeModal).toBeDefined();
    });

    it('startet Countdown-Interval nach Modal-Anzeige', async () => {
      const Klasse = await ladeController();
      const { szene } = baueSzene();
      const setIntervalSpy = vi.spyOn(window, 'setInterval');
      const controller = new Klasse(szene, () => undefined);

      controller.zeigePartieEndeModal(baueFakeModell());

      expect(setIntervalSpy).toHaveBeenCalled();
    });

    it('speichert Interval-ID in partieCountdownInterval', async () => {
      const Klasse = await ladeController();
      const { szene } = baueSzene();
      const controller = new Klasse(szene, () => undefined);

      controller.zeigePartieEndeModal(baueFakeModell());

      expect(controller.partieCountdownInterval).toBeDefined();
    });

    it('schließt Modal und startet neue Partie wenn Countdown auf 0 fällt', async () => {
      vi.useFakeTimers();
      const Klasse = await ladeController();
      const { szene } = baueSzene();
      // Erster snapshot-Aufruf (direkt in updateCountdown) gibt 5 zurück,
      // nach Interval-Tick gibt er 0 zurück → schliessePartieEndeModal + starteNeuePartie
      mockAppStore.snapshot
        .mockReturnValueOnce({ countdownSekunden: 5 } as any)
        .mockReturnValue({ countdownSekunden: 0 } as any);
      const controller = new Klasse(szene, () => undefined);

      controller.zeigePartieEndeModal(baueFakeModell());
      vi.advanceTimersByTime(1000);

      expect(mockAppStore.starteNeuePartie).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('nutzt grüne Siegerfarbe bei RE-Sieg', async () => {
      const Klasse = await ladeController();
      const { szene } = baueSzene();
      const controller = new Klasse(szene, () => undefined);

      controller.zeigePartieEndeModal(baueFakeModell({
        letztesSpielergebnis: baueSpielergebnis({ siegerPartei: 'RE' }),
      }));

      // Mindestens ein text()-Aufruf muss '#4adf7a' als Farbe erhalten haben
      // add.text(x, y, text, config) → config ist Index 3
      const farben = (szene.add.text as ReturnType<typeof vi.fn>).mock.calls
        .map((c: any) => c[3]?.color)
        .filter(Boolean);
      expect(farben).toContain('#4adf7a');
    });

    it('nutzt rote Siegerfarbe bei KONTRA-Sieg', async () => {
      const Klasse = await ladeController();
      const { szene } = baueSzene();
      const controller = new Klasse(szene, () => undefined);

      controller.zeigePartieEndeModal(baueFakeModell({
        letztesSpielergebnis: baueSpielergebnis({ siegerPartei: 'KONTRA' }),
      }));

      const farben = (szene.add.text as ReturnType<typeof vi.fn>).mock.calls
        .map((c: any) => c[3]?.color)
        .filter(Boolean);
      expect(farben).toContain('#ff6b6b');
    });

    it('markiert den Führenden im Gesamtstand mit Sternchen', async () => {
      const Klasse = await ladeController();
      const { szene } = baueSzene();
      const controller = new Klasse(szene, () => undefined);

      controller.zeigePartieEndeModal(baueFakeModell({
        gesamtpunktestand: [
          { position: SPIELER_POSITION.SUED, name: 'Ich', punkte: 20 },
          { position: SPIELER_POSITION.NORD, name: 'Nord', punkte: 5 },
        ],
      }));

      // Mindestens ein text()-Aufruf muss '★' für den Führenden enthalten
      const texte = (szene.add.text as ReturnType<typeof vi.fn>).mock.calls
        .map((c: any) => c[2])
        .filter((t: string) => typeof t === 'string' && t.includes('★'));
      expect(texte.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe('schliessePartieEndeModal()', () => {
    it('löscht den Countdown-Interval', async () => {
      const Klasse = await ladeController();
      const { szene } = baueSzene();
      const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
      const controller = new Klasse(szene, () => undefined);
      controller.zeigePartieEndeModal(baueFakeModell());

      controller.schliessePartieEndeModal();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('löscht kein Interval wenn keins aktiv (Guard)', async () => {
      const Klasse = await ladeController();
      const { szene } = baueSzene();
      const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
      const controller = new Klasse(szene, () => undefined);

      controller.schliessePartieEndeModal();

      expect(clearIntervalSpy).not.toHaveBeenCalled();
    });

    it('setzt partieCountdownInterval auf undefined', async () => {
      const Klasse = await ladeController();
      const { szene } = baueSzene();
      const controller = new Klasse(szene, () => undefined);
      controller.zeigePartieEndeModal(baueFakeModell());

      controller.schliessePartieEndeModal();

      expect(controller.partieCountdownInterval).toBeUndefined();
    });

    it('zerstört phaserPartieEndeModal', async () => {
      const Klasse = await ladeController();
      const { szene } = baueSzene();
      const controller = new Klasse(szene, () => undefined);
      controller.zeigePartieEndeModal(baueFakeModell());
      vi.clearAllMocks();

      controller.schliessePartieEndeModal();

      expect(phaserModalHarness.destroyFn).toHaveBeenCalled();
    });

    it('setzt Queue nach Schließen fort', async () => {
      const Klasse = await ladeController();
      const { szene } = baueSzene();
      const controller = new Klasse(szene, () => undefined);
      controller.zeigePartieEndeModal(baueFakeModell());
      vi.clearAllMocks();

      controller.schliessePartieEndeModal();

      expect(mockAppStore.setzeQueueFort).toHaveBeenCalledOnce();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe('aufraeumen()', () => {
    it('entfernt tweenCountUp und yoyo-Tweens', async () => {
      const Klasse = await ladeController();
      const { szene, erstellteTweens } = baueSzene();
      const controller = new Klasse(szene, () => undefined);
      await controller.zeigeRundenEndeModal(baueFakeModell());

      controller.aufraeumen();

      erstellteTweens.forEach((tween) => {
        expect(tween.remove).toHaveBeenCalled();
      });
    });

    it('löscht den Countdown-Interval beim Aufräumen', async () => {
      const Klasse = await ladeController();
      const { szene } = baueSzene();
      const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
      const controller = new Klasse(szene, () => undefined);
      controller.zeigePartieEndeModal(baueFakeModell());

      controller.aufraeumen();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('zerstört beide Modals', async () => {
      const Klasse = await ladeController();
      const { szene } = baueSzene();
      const controller = new Klasse(szene, () => undefined);
      await controller.zeigeRundenEndeModal(baueFakeModell());
      vi.clearAllMocks();
      controller.zeigePartieEndeModal(baueFakeModell());
      vi.clearAllMocks();

      controller.aufraeumen();

      // destroy wird 3-mal aufgerufen: phaserRundenEndeModal.destroy() +
      // rundenauswertungObjekte enthält ebenfalls das Modal → nochmals destroy()
      // + phaserPartieEndeModal.destroy()
      expect(phaserModalHarness.destroyFn).toHaveBeenCalledTimes(3);
    });

    it('ist idempotent wenn kein Modal aktiv ist (kein Crash)', async () => {
      const Klasse = await ladeController();
      const { szene } = baueSzene();
      const controller = new Klasse(szene, () => undefined);

      expect(() => controller.aufraeumen()).not.toThrow();
    });
  });
});
