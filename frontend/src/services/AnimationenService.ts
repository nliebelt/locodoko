import type Phaser from 'phaser';
import { AnimationenPrimitiven } from './AnimationenPrimitiven';
import { KartenAnimationen } from './KartenAnimationen';
import { SpieleffektAnimationen } from './SpieleffektAnimationen';

// Re-Exports für Rückwärtskompatibilität aller Importeure
export type { AnimierbareKartenobjekte, Punkt } from './AnimationenPrimitiven';
export type { RundenauswertungDaten } from './SpieleffektAnimationen';

/**
 * Verwaltet alle Phaser-Tweens und Timer für Kartenanimationen in der TischSzene.
 *
 * Bietet Promise-basierte Animationen für Kartenausspielen, Austeilen, Sticheinziehen
 * sowie visuelle Feedback-Banner für Ansagen und Sonderpunkte. Alle Animationen
 * berücksichtigen den konfigurierbaren Geschwindigkeitsfaktor (1x / 2x / sofort).
 *
 * Laufende Tweens und Timer werden intern verwaltet und können per `abbrechen()`
 * sofort gestoppt werden (z.B. beim Schließen der Szene).
 *
 * Implementierung: Queue-Orchestrierung delegiert an KartenAnimationen und SpieleffektAnimationen.
 */
export class AnimationenService {
  private readonly laufendeTweens = new Set<Phaser.Tweens.Tween>();
  private readonly laufendenTimer = new Set<number>();
  private readonly laufendeWarteLoeser = new Set<() => void>();
  private readonly primitiven: AnimationenPrimitiven;
  private readonly karten: KartenAnimationen;
  private readonly effekte: SpieleffektAnimationen;

  public geschwindigkeitsfaktor: number;

  // Serielle FIFO-Queue: Jede eingereihte Animation wartet auf die vorherige.
  // Verhindert dass Karten-Ausspielen und Stich-Einziehen parallel laufen.
  private warteschlange: Promise<void> = Promise.resolve();

  // True solange irgendeine Animation in der Warteschlange läuft (für UI-Sperren).
  private _animationLaeuft = false;

  constructor(
    szene: Phaser.Scene,
    geschwindigkeitsfaktor = 1
  ) {
    this.geschwindigkeitsfaktor = geschwindigkeitsfaktor;
    this.primitiven = new AnimationenPrimitiven(szene, this.laufendeTweens, this.laufendenTimer, this.laufendeWarteLoeser, geschwindigkeitsfaktor);
    this.karten = new KartenAnimationen(this.primitiven);
    this.effekte = new SpieleffektAnimationen(this.primitiven);
  }

  /** Gibt zurück ob gerade eine Animation in der Warteschlange läuft. */
  get animationLaeuft(): boolean {
    return this._animationLaeuft;
  }

  /**
   * Reiht eine Animation ans Ende der seriellen Warteschlange ein.
   * Fehler werden abgefangen damit ein fehlgeschlagener Schritt die Kette nicht blockiert.
   */
  reiheEin(fn: () => Promise<void>): Promise<void> {
    // Sofort als laufend markieren, damit isIdle() auch zwischen reiheEin()-Aufruf
    // und Mikrotask-Ausführung false zurückgibt (Race-Condition mit SNAPSHOT).
    this._animationLaeuft = true;
    const versprechen = this.warteschlange.then(() => {
      return fn();
    }).catch(() => undefined).finally(() => {
      if (this.warteschlange === versprechen) {
        this._animationLaeuft = false;
      }
    });
    this.warteschlange = versprechen;
    return versprechen;
  }

  /**
   * Setzt den globalen Geschwindigkeitsmultiplikator; wirkt auf alle nachfolgenden Animationen.
   * @param faktor - 1 = normal, 2 = doppelt schnell, Infinity = sofort (kein Tween, kein Warten)
   */
  setzeGeschwindigkeitsfaktor(faktor: number): void {
    this.geschwindigkeitsfaktor = faktor;
    this.primitiven.geschwindigkeitsfaktor = faktor;
  }

  /**
   * Stoppt alle laufenden Tweens und Timer sofort und setzt die Warteschlange zurück.
   * Wird beim Herunterfahren der Szene aufgerufen, um Memory-Leaks zu verhindern.
   */
  abbrechen(): void {
    this.laufendeTweens.forEach((tween) => tween.stop());
    this.laufendeTweens.clear();
    this.laufendenTimer.forEach((timer) => window.clearTimeout(timer));
    this.laufendenTimer.clear();
    this.laufendeWarteLoeser.forEach((loeser) => loeser());
    this.laufendeWarteLoeser.clear();
    this.warteschlange = Promise.resolve();
    this._animationLaeuft = false;
  }

  // ── Karten-Animationen (delegiert an KartenAnimationen) ──────────────────

  animiereKarteAusspielen(
    ...args: Parameters<KartenAnimationen['animiereKarteAusspielen']>
  ): ReturnType<KartenAnimationen['animiereKarteAusspielen']> {
    return this.karten.animiereKarteAusspielen(...args);
  }

  animiereKartenAusteilen(
    ...args: Parameters<KartenAnimationen['animiereKartenAusteilen']>
  ): ReturnType<KartenAnimationen['animiereKartenAusteilen']> {
    return this.karten.animiereKartenAusteilen(...args);
  }

  animiereStichEinziehen(
    ...args: Parameters<KartenAnimationen['animiereStichEinziehen']>
  ): ReturnType<KartenAnimationen['animiereStichEinziehen']> {
    return this.karten.animiereStichEinziehen(...args);
  }

  // ── Spieleffekt-Animationen (delegiert an SpieleffektAnimationen) ─────────

  animiereAnsageBanner(
    ...args: Parameters<SpieleffektAnimationen['animiereAnsageBanner']>
  ): ReturnType<SpieleffektAnimationen['animiereAnsageBanner']> {
    return this.effekte.animiereAnsageBanner(...args);
  }

  animiereSoloAnkuendigung(
    ...args: Parameters<SpieleffektAnimationen['animiereSoloAnkuendigung']>
  ): ReturnType<SpieleffektAnimationen['animiereSoloAnkuendigung']> {
    return this.effekte.animiereSoloAnkuendigung(...args);
  }

  animiereGewinnerFlash(
    ...args: Parameters<SpieleffektAnimationen['animiereGewinnerFlash']>
  ): ReturnType<SpieleffektAnimationen['animiereGewinnerFlash']> {
    return this.effekte.animiereGewinnerFlash(...args);
  }

  animiereBockrunde(
    ...args: Parameters<SpieleffektAnimationen['animiereBockrunde']>
  ): ReturnType<SpieleffektAnimationen['animiereBockrunde']> {
    return this.effekte.animiereBockrunde(...args);
  }

  animiereSonderpunktFeedback(
    ...args: Parameters<SpieleffektAnimationen['animiereSonderpunktFeedback']>
  ): ReturnType<SpieleffektAnimationen['animiereSonderpunktFeedback']> {
    return this.effekte.animiereSonderpunktFeedback(...args);
  }

  animiereRundenauswertung(
    ...args: Parameters<SpieleffektAnimationen['animiereRundenauswertung']>
  ): ReturnType<SpieleffektAnimationen['animiereRundenauswertung']> {
    return this.effekte.animiereRundenauswertung(...args);
  }
}
