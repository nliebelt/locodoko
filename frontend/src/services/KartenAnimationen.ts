import type Phaser from 'phaser';
import type { AnimierbareKartenobjekte, Punkt } from './AnimationenPrimitiven';
import type { AnimationenPrimitiven } from './AnimationenPrimitiven';
import { Logger } from '../logger';

function istVorhanden<T>(wert: T | undefined): wert is T {
  return wert !== undefined;
}

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

    const tweenConfig: Phaser.Types.Tweens.TweenBuilderConfig = {
      targets: objekte,
      x: ziel.x,
      y: ziel.y,
      duration: dauer,
      ease: 'Cubic.Out'
    };
    if (ziel.winkel !== undefined) {
      tweenConfig.angle = ziel.winkel;
    }
    await this.p.animiereTween(tweenConfig as Omit<Phaser.Types.Tweens.TweenBuilderConfig, 'duration' | 'onComplete'> & { duration: number });
    Logger.szene('Beende animiereKarteAusspielen');
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
