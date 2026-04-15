// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { AnimationenService } from './AnimationenService';

interface AnimierbaresZiel {
  x: number;
  y: number;
}

interface FakeKartenWurzel extends AnimierbaresZiel {
  alpha: number;
  scaleX: number;
  scaleY: number;
}

interface FakeTextObjekt {
  x: number;
  y: number;
  text: string;
  alpha: number;
  zerstort: boolean;
  setOrigin: () => FakeTextObjekt;
  setDepth: () => FakeTextObjekt;
  setAlpha: (a: number) => FakeTextObjekt;
  destroy: () => void;
}

function baueTweenSzene() {
  const aufrufe: Array<Record<string, unknown>> = [];
  const textobjekte: FakeTextObjekt[] = [];
  return {
    aufrufe,
    textobjekte,
    szene: {
      tweens: {
        add: vi.fn((konfiguration: Record<string, unknown>) => {
          aufrufe.push(konfiguration);
          const ziele = Array.isArray(konfiguration.targets)
            ? konfiguration.targets as (AnimierbaresZiel & { alpha?: number })[]
            : [konfiguration.targets as AnimierbaresZiel & { alpha?: number }];
          const zielX = konfiguration.x as number | undefined;
          const zielY = konfiguration.y as number | undefined;
          const zielAlpha = typeof konfiguration.alpha === 'number' ? konfiguration.alpha : undefined;
          const zielScaleX = typeof konfiguration.scaleX === 'number' ? konfiguration.scaleX : undefined;
          const zielScaleY = typeof konfiguration.scaleY === 'number' ? konfiguration.scaleY : undefined;
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
              ziel.alpha = zielAlpha;
            });
          }
          if (zielScaleX !== undefined) {
            ziele.forEach((ziel) => {
              (ziel as FakeKartenWurzel).scaleX = zielScaleX;
            });
          }
          if (zielScaleY !== undefined) {
            ziele.forEach((ziel) => {
              (ziel as FakeKartenWurzel).scaleY = zielScaleY;
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
      },
      add: {
        text: vi.fn((x: number, y: number, text: string) => {
          const objekt: FakeTextObjekt = {
            x,
            y,
            text,
            alpha: 0,
            zerstort: false,
            setOrigin() { return this; },
            setDepth() { return this; },
            setAlpha(a: number) { this.alpha = a; return this; },
            destroy() { this.zerstort = true; }
          };
          textobjekte.push(objekt);
          return objekt;
        })
      }
    }
  };
}

function baueKartenWurzel(x = 0, y = 0): FakeKartenWurzel {
  return { x, y, alpha: 1, scaleX: 1, scaleY: 1 };
}

describe('AnimationenService', () => {
  it('animiert das Ausspielen einer Karte zur Zielposition', async () => {
    const { szene, aufrufe } = baueTweenSzene();
    const service = new AnimationenService(szene as never);
    const wurzel = baueKartenWurzel(10, 20) as never;
    const beschriftung = { x: 10, y: 20 } as never;

    await service.animiereKarteAusspielen({ wurzel, beschriftung }, { x: 100, y: 200 });

    expect(aufrufe).toHaveLength(1);
    expect(aufrufe[0].duration).toBe(400);
    expect(wurzel).toMatchObject({ x: 100, y: 200 });
    expect(beschriftung).toMatchObject({ x: 100, y: 200 });
  });

  // WARUM: Das Ansage-Banner ist die einzige Echtzeitrueckmeldung bei Re/Kontra/Absagen;
  // ohne diese Absicherung koennte die Animation heimlich wegfallen oder dauerhaft sichtbar bleiben.
  it('blendet ein Ansage-Banner ein, haelt es sichtbar und blendet es wieder aus', async () => {
    vi.useFakeTimers();
    const { szene, aufrufe, textobjekte } = baueTweenSzene();
    const service = new AnimationenService(szene as never);

    const animation = service.animiereAnsageBanner('Anna\nRe', { x: 640, y: 360 });

    // Fade-In Tween (alpha → 1) wird sofort ausgefuehrt
    expect(aufrufe).toHaveLength(1);
    expect(aufrufe[0].alpha).toBe(1);
    expect(aufrufe[0].duration).toBe(300);

    // Sichtbarkeitsfenster noch nicht abgelaufen: kein Fade-Out
    await vi.advanceTimersByTimeAsync(1499);
    expect(aufrufe).toHaveLength(1);

    // Nach 1500ms: Fade-Out Tween (alpha → 0)
    await vi.advanceTimersByTimeAsync(1);
    await animation;

    expect(aufrufe).toHaveLength(2);
    expect(aufrufe[1].alpha).toBe(0);
    expect(aufrufe[1].duration).toBe(300);

    // Banner-Objekt wurde nach der Animation zerstört
    expect(textobjekte).toHaveLength(1);
    expect(textobjekte[0].zerstort).toBe(true);
    expect(textobjekte[0].text).toBe('Anna\nRe');

    vi.useRealTimers();
  });

  // WARUM: Das Sonderpunkt-Feedback ist der einzige sofortige visuelle Hinweis auf Fuchs/Karlchen/Doppelkopf;
  // ohne diese Absicherung koennte das Feedback bei State-Updates heimlich wegfallen oder dauerhaft sichtbar bleiben.
  it('blendet ein Sonderpunkt-Feedback ein, haelt es sichtbar und blendet es wieder aus', async () => {
    vi.useFakeTimers();
    const { szene, aufrufe, textobjekte } = baueTweenSzene();
    const service = new AnimationenService(szene as never);

    const animation = service.animiereSonderpunktFeedback('Re: Fuchs gefangen', { x: 640, y: 360 });

    // Fade-In Tween (alpha → 1) wird sofort ausgefuehrt
    expect(aufrufe).toHaveLength(1);
    expect(aufrufe[0].alpha).toBe(1);
    expect(aufrufe[0].duration).toBe(200);

    // Sichtbarkeitsfenster noch nicht abgelaufen: kein Fade-Out
    await vi.advanceTimersByTimeAsync(999);
    expect(aufrufe).toHaveLength(1);

    // Nach 1000ms: Fade-Out Tween (alpha → 0)
    await vi.advanceTimersByTimeAsync(1);
    await animation;

    expect(aufrufe).toHaveLength(2);
    expect(aufrufe[1].alpha).toBe(0);
    expect(aufrufe[1].duration).toBe(200);

    // Feedback-Objekt wurde nach der Animation zerstoert
    expect(textobjekte).toHaveLength(1);
    expect(textobjekte[0].zerstort).toBe(true);
    expect(textobjekte[0].text).toBe('Re: Fuchs gefangen');

    vi.useRealTimers();
  });

  it('wartet vor dem Stich-Einziehen und nutzt die konfigurierte Dauer', async () => {
    vi.useFakeTimers();
    const { szene, aufrufe } = baueTweenSzene();
    const service = new AnimationenService(szene as never);
    const wurzel = baueKartenWurzel() as never;

    const animation = service.animiereStichEinziehen([{ wurzel }], { x: 50, y: 75 }, 14);
    expect(aufrufe).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(999);
    expect(aufrufe).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1);
    await animation;

    // 5 Tweens: 1x Zu, 1x Scale (Karte) + 2x Alpha (Popup) + 1x Zu (Popup)
    expect(aufrufe).toHaveLength(5);
    expect(aufrufe[0].duration).toBe(600);
    expect(wurzel).toMatchObject({ x: 50, y: 75, scaleX: 0.4, scaleY: 0.4 });
    vi.useRealTimers();
  });

  // WARUM: setzeGeschwindigkeitsfaktor ist der einzige Weg, die Animations-Geschwindigkeit zur Laufzeit
  // zu aendern; ohne diesen Test koennte ein Refactoring die Skalierung leise brechen und der
  // 1x/2x/sofort-Umschalter haette keine Auswirkung mehr.
  it('skaliert Animationsdauern entsprechend dem gesetzten Geschwindigkeitsfaktor', async () => {
    const { szene, aufrufe } = baueTweenSzene();
    const service = new AnimationenService(szene as never);
    const wurzel = baueKartenWurzel() as never;

    // Faktor 2: Dauern werden halbiert
    service.setzeGeschwindigkeitsfaktor(2);
    await service.animiereKarteAusspielen({ wurzel }, { x: 100, y: 100 });
    expect(aufrufe[0].duration).toBe(200); // 400ms / 2

    // Faktor Infinity (sofort): Dauern werden 0
    service.setzeGeschwindigkeitsfaktor(Infinity);
    await service.animiereKarteAusspielen({ wurzel }, { x: 200, y: 200 });
    expect(aufrufe[1].duration).toBe(0);
  });

  it('loest bei Geschwindigkeitsfaktor Infinity alle Animationen sofort auf', async () => {
    vi.useFakeTimers();
    const { szene, aufrufe } = baueTweenSzene();
    const service = new AnimationenService(szene as never, Infinity);

    // animiereStichEinziehen wartet normalerweise 1000ms — bei Infinity sofort fertig
    const wurzel = baueKartenWurzel() as never;
    const animation = service.animiereStichEinziehen([{ wurzel }], { x: 50, y: 75 }, 14);
    // Kein Tick noetig: warte(0) kehrt sofort zurueck, Tween mit duration=0 loest sofort auf
    await animation;

    expect(aufrufe).toHaveLength(5);
    expect(aufrufe[0].duration).toBe(0);
    vi.useRealTimers();
  });

  // WARUM: BUG-3 — bei schnellen KI-Zuegen wurden Stich-Einziehen und Karten-Ausspielen parallel
  // animiert. Die Warteschlange serialisiert Animationen und verhindert die Aufstauung.
  it('serialisiert eingereihte Animationen — keine parallele Ausfuehrung', async () => {
    const { szene } = baueTweenSzene();
    const service = new AnimationenService(szene as never, Infinity);
    const ablauf: string[] = [];

    const animation1 = service.reiheEin(async () => {
      ablauf.push('start-1');
      await Promise.resolve();
      ablauf.push('ende-1');
    });
    const animation2 = service.reiheEin(async () => {
      ablauf.push('start-2');
      await Promise.resolve();
      ablauf.push('ende-2');
    });
    const animation3 = service.reiheEin(async () => {
      ablauf.push('start-3');
      await Promise.resolve();
      ablauf.push('ende-3');
    });

    await Promise.all([animation1, animation2, animation3]);

    // Alle Animationen muessen strikt nacheinander gelaufen sein
    expect(ablauf).toEqual(['start-1', 'ende-1', 'start-2', 'ende-2', 'start-3', 'ende-3']);
  });

  // WARUM: Wenn eine eingereihte Animation fehlschlaegt, darf die Kette nicht blockieren.
  it('faengt Fehler in der Warteschlange ab und fuehrt nachfolgende Animationen aus', async () => {
    const { szene } = baueTweenSzene();
    const service = new AnimationenService(szene as never, Infinity);
    const ablauf: string[] = [];

    await service.reiheEin(async () => { throw new Error('Test-Fehler'); });
    await service.reiheEin(async () => { ablauf.push('nach-fehler'); });

    expect(ablauf).toEqual(['nach-fehler']);
  });

  // WARUM: animationLaeuft wird von der TischSzene geprüft um Buttons/Karten zu sperren.
  it('setzt animationLaeuft waehrend der Warteschlangen-Ausfuehrung', async () => {
    const { szene } = baueTweenSzene();
    const service = new AnimationenService(szene as never, Infinity);

    expect(service.animationLaeuft).toBe(false);

    let warLaeuftInAnimation = false;
    await service.reiheEin(async () => {
      warLaeuftInAnimation = service.animationLaeuft;
    });

    expect(warLaeuftInAnimation).toBe(true);
    expect(service.animationLaeuft).toBe(false);
  });

  // WARUM: abbrechen() muss die Warteschlange zuruecksetzen, damit bei Szenen-Wechsel keine
  // veralteten Animationen weiterlaufen.
  it('setzt die Warteschlange bei abbrechen() zurueck', async () => {
    const { szene } = baueTweenSzene();
    const service = new AnimationenService(szene as never, Infinity);

    service.abbrechen();

    expect(service.animationLaeuft).toBe(false);
    // Nach abbrechen() sollen neue Animationen weiterhin funktionieren
    const ablauf: string[] = [];
    await service.reiheEin(async () => { ablauf.push('nach-abbrechen'); });
    expect(ablauf).toEqual(['nach-abbrechen']);
  });
});
