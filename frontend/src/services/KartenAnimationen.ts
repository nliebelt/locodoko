import type Phaser from 'phaser';
import type { AnimierbareKartenobjekte, Punkt } from './AnimationenPrimitiven';
import type { AnimationenPrimitiven } from './AnimationenPrimitiven';
import { Logger } from '../logger';

function istVorhanden<T>(wert: T | undefined): wert is T {
  return wert !== undefined;
}

type AusSpielStil = 'standard' | 'bounce' | 'spin' | 'bogen' | 'schnell' | 'schwer' | 'katapult' | 'zittern' | 'fade';

const AUSSPIEL_STILE: readonly AusSpielStil[] = [
  'standard', 'bounce', 'spin', 'bogen', 'schnell', 'schwer', 'katapult', 'zittern', 'fade'
];

/** Animiert Kartenbewegungen: Ausspielen, Austeilen und Stich-Einziehen. */
export class KartenAnimationen {
  constructor(private readonly p: AnimationenPrimitiven) {}

  async animiereKarteAusspielen(
    kartenobjekte: AnimierbareKartenobjekte,
    ziel: { x: number; y: number; winkel?: number },
    dauer = 400
  ): Promise<void> {
    Logger.szene('Starte animiereKarteAusspielen', { dauer });
    const objekte = [kartenobjekte.wurzel, kartenobjekte.beschriftung].filter(istVorhanden);
    if (objekte.length === 0) { Logger.szene('Beende animiereKarteAusspielen'); return; }

    const stil = AUSSPIEL_STILE[Math.floor(Math.random() * AUSSPIEL_STILE.length)];
    await this.animiereAusSpielStil(stil, kartenobjekte, objekte, ziel, dauer);
    Logger.szene('Beende animiereKarteAusspielen');
  }

  private async animiereAusSpielStil(
    stil: AusSpielStil,
    kartenobjekte: AnimierbareKartenobjekte,
    objekte: Phaser.GameObjects.GameObject[],
    ziel: { x: number; y: number; winkel?: number },
    dauer: number
  ): Promise<void> {
    const zielWinkel = ziel.winkel ?? 0;
    const mitWinkel = ziel.winkel !== undefined ? { angle: ziel.winkel } : {};

    switch (stil) {
      case 'standard':
        await this.p.animiereTween({ targets: objekte, x: ziel.x, y: ziel.y, duration: dauer, ease: 'Cubic.Out', ...mitWinkel });
        break;

      case 'bounce':
        await this.p.animiereTween({ targets: objekte, x: ziel.x, y: ziel.y, duration: dauer, ease: 'Bounce.Out', ...mitWinkel });
        break;

      case 'schnell':
        await this.p.animiereTween({ targets: objekte, x: ziel.x, y: ziel.y, duration: dauer, ease: 'Expo.Out', ...mitWinkel });
        break;

      case 'schwer':
        await this.p.animiereTween({ targets: objekte, x: ziel.x, y: ziel.y, duration: dauer, ease: 'Quintic.In', ...mitWinkel });
        break;

      case 'katapult':
        await this.p.animiereTween({ targets: objekte, x: ziel.x, y: ziel.y, duration: dauer, ease: 'Back.Out', ...mitWinkel });
        break;

      case 'spin': {
        const startAngle = kartenobjekte.wurzel.angle ?? 0;
        await Promise.all([
          this.p.animiereTween({ targets: objekte, x: ziel.x, y: ziel.y, duration: dauer, ease: 'Cubic.Out' }),
          this.p.animiereTween({ targets: [kartenobjekte.wurzel], angle: startAngle + 360, duration: dauer, ease: 'Cubic.Out' })
        ]);
        kartenobjekte.wurzel.angle = zielWinkel;
        break;
      }

      case 'bogen': {
        const startX = kartenobjekte.wurzel.x;
        const startY = kartenobjekte.wurzel.y;
        const midX = (startX + ziel.x) / 2;
        const midY = Math.min(startY, ziel.y) - 80;
        const halbeDauer = Math.round(dauer / 2);
        await this.p.animiereTween({ targets: objekte, x: midX, y: midY, duration: halbeDauer, ease: 'Sine.Out' });
        await this.p.animiereTween({ targets: objekte, x: ziel.x, y: ziel.y, duration: halbeDauer, ease: 'Sine.In', ...mitWinkel });
        break;
      }

      case 'zittern': {
        const startAngle = kartenobjekte.wurzel.angle ?? 0;
        await Promise.all([
          this.p.animiereTween({ targets: objekte, x: ziel.x, y: ziel.y, duration: dauer, ease: 'Cubic.Out' }),
          this.p.animiereTween({ targets: [kartenobjekte.wurzel], angle: startAngle + 5, yoyo: true, repeat: 3, duration: Math.round(dauer / 8), ease: 'Sine.InOut' })
        ]);
        kartenobjekte.wurzel.angle = zielWinkel;
        break;
      }

      case 'fade': {
        await Promise.all(objekte.map(o => this.p.tweenAlpha(o, 0, 120)));
        objekte.forEach(o => { (o as unknown as { x: number; y: number }).x = ziel.x; (o as unknown as { x: number; y: number }).y = ziel.y; });
        kartenobjekte.wurzel.angle = zielWinkel;
        await Promise.all(objekte.map(o => this.p.tweenAlpha(o, 1, 120)));
        break;
      }
    }
  }

  async animiereKartenAusteilen(
    pakete: Array<{ kartenobjekte: AnimierbareKartenobjekte; ziel: Punkt }>,
    verzoegerungProKarte = 75,
    dauerProKarte = 75
  ): Promise<void> {
    Logger.szene('Starte animiereKartenAusteilen', { anzahl: pakete.length });
    if (pakete.length === 0) {
      Logger.szene('Beende animiereKartenAusteilen');
      return;
    }
    // Karten gestaffelt animieren: jede Karte startet mit leichter Verzögerung nach der vorherigen
    const animationen = pakete.map(async (paket, index) => {
      await this.p.warte(index * verzoegerungProKarte);
      await this.p.tweenZu(
        [paket.kartenobjekte.wurzel, paket.kartenobjekte.beschriftung].filter(istVorhanden),
        paket.ziel,
        dauerProKarte
      );
    });
    await Promise.all(animationen);
    Logger.szene('Beende animiereKartenAusteilen');
  }

  async animiereStichEinziehen(
    kartenobjekte: AnimierbareKartenobjekte[],
    ziel: Punkt,
    _augenzahl: number,
    flashObjekt?: Phaser.GameObjects.GameObject,
    wartezeit = 1000,
    dauer = 600
  ): Promise<void> {
    Logger.szene('Starte animiereStichEinziehen', { karten: kartenobjekte.length });
    if (kartenobjekte.length === 0) {
      Logger.szene('Beende animiereStichEinziehen');
      return;
    }
    await this.p.warte(wartezeit);

    if (flashObjekt) {
      // Nameplate-Flash am Gewinner — fire-and-forget, läuft parallel zur Einzieh-Animation
      void this.p.tweenAlpha(flashObjekt, 1, 200).then(async () => {
        await this.p.warte(200);
        await this.p.tweenAlpha(flashObjekt, 0, 200);
      }).catch(() => { /* Objekt wurde zerstört bevor Tween abschloss */ });
    }

    const animationen = kartenobjekte.flatMap((kartenobjekt) => {
      const objekte = [kartenobjekt.wurzel, kartenobjekt.beschriftung].filter(istVorhanden);
      return [
        this.p.tweenZu(objekte, ziel, dauer),
        this.p.tweenScale(kartenobjekt.wurzel, 0.4, dauer)
      ];
    });

    await Promise.all(animationen);
    Logger.szene('Beende animiereStichEinziehen');
  }
}
