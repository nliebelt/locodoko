import type Phaser from 'phaser';
import { PARTEI } from '../modelle/SpielverwaltungDto';
import type { Partei } from '../modelle/SpielverwaltungDto';
import { FONT_FAMILY } from '../ui/designTokens';

/**
 * Phaser-Spielobjekte, die gemeinsam als Karte animiert werden koennen:
 * eine Kartenwurzel und optional direkte Unterobjekte fuer Spezialeffekte.
 */
export interface AnimierbareKartenobjekte {
  wurzel: Phaser.GameObjects.Container;
  bild?: Phaser.GameObjects.Image;
  beschriftung?: Phaser.GameObjects.Text;
}

/** Zweidimensionaler Punkt mit x- und y-Koordinate (in Spielpixeln). */
export interface Punkt {
  x: number;
  y: number;
}

function istVorhanden<T>(wert: T | undefined): wert is T {
  return wert !== undefined;
}

/**
 * Verwaltet alle Phaser-Tweens und Timer fuer Kartenanimationen in der TischSzene.
 *
 * Bietet Promise-basierte Animationen fuer Kartenausspielen, Austeilen, Sticheinziehen
 * sowie visuelle Feedback-Banner fuer Ansagen und Sonderpunkte. Alle Animationen
 * beruecksichtigen den konfigurierbaren Geschwindigkeitsfaktor (1x / 2x / sofort).
 *
 * Laufende Tweens und Timer werden intern verwaltet und koennen per `abbrechen()`
 * sofort gestoppt werden (z.B. beim Schliessen der Szene).
 */
export class AnimationenService {
  private readonly laufendeTweens = new Set<Phaser.Tweens.Tween>();

  private readonly laufendenTimer = new Set<number>();

  // Globaler Multiplikator fuer alle Animationsdauern: 1 = normal, 2 = doppelt, Infinity = sofort
  public geschwindigkeitsfaktor: number;

  // Serielle FIFO-Queue: Jede eingereihte Animation wartet auf die vorherige.
  // Verhindert dass Karten-Ausspielen und Stich-Einziehen parallel laufen.
  private warteschlange: Promise<void> = Promise.resolve();

  // True solange irgendeine Animation in der Warteschlange laeuft (fuer UI-Sperren).
  private _animationLaeuft = false;

  constructor(
    private readonly szene: Phaser.Scene,
    geschwindigkeitsfaktor = 1
  ) {
    this.geschwindigkeitsfaktor = geschwindigkeitsfaktor;
  }

  /** Gibt zurueck ob gerade eine Animation in der Warteschlange laeuft. */
  get animationLaeuft(): boolean {
    return this._animationLaeuft;
  }

  /**
   * Reiht eine Animation ans Ende der seriellen Warteschlange ein.
   * Fehler werden abgefangen damit ein fehlgeschlagener Schritt die Kette nicht blockiert.
   * @param fn - Async-Funktion die die eigentliche Animation ausfuehrt
   */
  reiheEin(fn: () => Promise<void>): Promise<void> {
    // Sofort als laufend markieren, damit isIdle() auch zwischen reiheEin()-Aufruf
    // und Mikrotask-Ausführung false zurückgibt (Race-Condition mit SNAPSHOT).
    this._animationLaeuft = true;
    const versprechen = this.warteschlange.then(() => {
      return fn();
    }).catch(() => undefined).finally(() => {
      // Pruefen ob nach diesem Schritt noch weitere Eintraege in der Kette warten
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
  }

  /**
   * Bewegt Karte (Bild + optionale Beschriftung) per Tween zur Zielpositon.
   * @param kartenobjekte - Zu animierende Spielobjekte der Karte
   * @param ziel - Zielposition in Spielpixeln, inkl. optionalem Winkel
   * @param dauer - Animationsdauer in Millisekunden (Standard: 400ms)
   */
  async animiereKarteAusspielen(
    kartenobjekte: AnimierbareKartenobjekte,
    ziel: { x: number; y: number; winkel?: number },
    dauer = 400
  ): Promise<void> {
    const objekte = [kartenobjekte.wurzel, kartenobjekte.beschriftung].filter(istVorhanden);
    if (objekte.length === 0) return;
    
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
    await this.animiereTween(tweenConfig as Omit<Phaser.Types.Tweens.TweenBuilderConfig, 'duration' | 'onComplete'> & { duration: number });
  }

  /**
   * Teilt Karten gestaffelt aus, indem jede Karte mit leichter Verzoegerung nach der vorherigen animiert wird.
   * Alle Karten-Tweens laufen parallel (Promise.all), aber gestaffelt gestartet.
   * @param pakete - Liste von Karte+Zielposition-Paaren
   * @param verzoegerungProKarte - Startverzoegerung zwischen je zwei Karten in ms (Standard: 75ms)
   * @param dauerProKarte - Tween-Dauer pro Karte in ms (Standard: 75ms)
   */
  async animiereKartenAusteilen(
    pakete: Array<{ kartenobjekte: AnimierbareKartenobjekte; ziel: Punkt }>,
    verzoegerungProKarte = 75,
    dauerProKarte = 75
  ): Promise<void> {
    if (pakete.length === 0) {
      return;
    }
    // Karten gestaffelt animieren: jede Karte startet mit leichter Verzoegerung nach der vorherigen
    const animationen = pakete.map(async (paket, index) => {
      await this.warte(index * verzoegerungProKarte);
      await this.tweenZu(
        [paket.kartenobjekte.wurzel, paket.kartenobjekte.beschriftung].filter(istVorhanden),
        paket.ziel,
        dauerProKarte
      );
    });
    await Promise.all(animationen);
  }

  /**
   * Blendet ein Ansage-Banner in der Szene ein (Fade-In), haelt es sichtbar und
   * blendet es wieder aus (Fade-Out).
   * Re-Ansagen erscheinen in Gold (#ffd166), Kontra in Blau (#90caf9), sonst Weiss.
   * @param text - Anzeigetext (z.B. "Re" oder "Kontra")
   * @param position - Anzeigeposition in Spielpixeln
   * @param sichtbarkeitsdauer - Haltezeit in ms nach Fade-In (Standard: 1500ms)
   * @param textFarbe - CSS-Farbe des Textes (Standard: '#ffffff')
   */
  async animiereAnsageBanner(
    text: string,
    position: Punkt,
    sichtbarkeitsdauer = 2500,
    textFarbe = '#ffffff'
  ): Promise<void> {
    const bannerobjekt = this.szene.add
      .text(position.x, position.y, text, {
        fontFamily: FONT_FAMILY,
        fontSize: '28px',
        color: textFarbe,
        stroke: '#000000',
        strokeThickness: 6,
        align: 'center'
      })
      .setOrigin(0.5, 0.5)
      .setDepth(100)
      .setAlpha(0);
    try {
      await this.tweenAlpha(bannerobjekt, 1, 300);
      await this.warte(sichtbarkeitsdauer);
      await this.tweenAlpha(bannerobjekt, 0, 300);
    } finally {
      bannerobjekt.destroy();
    }
  }

  /**
   * Zeigt eine dramatische Solo-Ankuendigung: Text faehrt von oben ein,
   * verweilt kurz und faehrt wieder heraus (Balatro-Stil).
   * Wird beim Start eines Solo-Spiels aufgerufen.
   * @param text - Anzeigetext der Ankuendigung (z.B. "Damensolo!")
   * @param position - Zielposition in der Szene (z.B. Bildmitte)
   * @param sichtbarkeitsdauer - Haltezeit in ms (Standard: 1500ms)
   */
  async animiereSoloAnkuendigung(
    text: string,
    position: Punkt,
    sichtbarkeitsdauer = 2500
  ): Promise<void> {
    // Startposition: ausserhalb des sichtbaren Bereichs (oberhalb)
    const startY = position.y - 160;
    const bannerobjekt = this.szene.add
      .text(position.x, startY, text, {
        fontFamily: FONT_FAMILY,
        fontSize: '38px',
        color: '#f8f9fa',
        stroke: '#000000',
        strokeThickness: 8,
        align: 'center'
      })
      .setOrigin(0.5, 0.5)
      .setDepth(110)
      .setAlpha(0);
    try {
      // Einfahren und Fade-In gleichzeitig
      await Promise.all([
        this.tweenZu([bannerobjekt], position, 400),
        this.tweenAlpha(bannerobjekt, 1, 300)
      ]);
      await this.warte(sichtbarkeitsdauer);
      // Ausfahren nach oben und Fade-Out gleichzeitig
      await Promise.all([
        this.tweenZu([bannerobjekt], { x: position.x, y: startY }, 400),
        this.tweenAlpha(bannerobjekt, 0, 300)
      ]);
    } finally {
      bannerobjekt.destroy();
    }
  }

  /**
   * Gewinner-Flash am Rundenende: Siegerpartei, Spielernamen und Spielwert fahren von oben ein,
   * verweilen kurz und fahren wieder heraus. Erscheint vor dem Rundenende-Modal.
   * @param parteiText - z.B. "RE gewinnt!" oder "KONTRA gewinnt!"
   * @param namenText - Kommagetrennte Spielernamen der Siegerpartei
   * @param punkteText - z.B. "+3 Punkte"
   * @param farbe - CSS-Farbe passend zur Partei (Gold fuer RE, Blau fuer KONTRA)
   * @param position - Zielposition in der Szene (z.B. Bildmitte)
   * @param sichtbarkeitsdauer - Haltezeit in ms (Standard: 2500ms)
   */
  async animiereGewinnerFlash(
    parteiText: string,
    namenText: string,
    punkteText: string,
    farbe: string,
    position: Punkt,
    sichtbarkeitsdauer = 2500
  ): Promise<void> {
    const startY = position.y - 200;
    const parteiLabel = this.szene.add
      .text(position.x, startY, parteiText, {
        fontFamily: FONT_FAMILY,
        fontSize: '42px',
        color: farbe,
        stroke: '#000000',
        strokeThickness: 8,
        align: 'center'
      })
      .setOrigin(0.5, 0.5)
      .setDepth(115)
      .setAlpha(0);
    const namenLabel = this.szene.add
      .text(position.x, startY + 68, namenText, {
        fontFamily: FONT_FAMILY,
        fontSize: '18px',
        color: '#f8f9fa',
        stroke: '#000000',
        strokeThickness: 5,
        align: 'center'
      })
      .setOrigin(0.5, 0.5)
      .setDepth(115)
      .setAlpha(0);
    const punkteLabel = this.szene.add
      .text(position.x, startY + 108, punkteText, {
        fontFamily: FONT_FAMILY,
        fontSize: '24px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 6,
        align: 'center'
      })
      .setOrigin(0.5, 0.5)
      .setDepth(115)
      .setAlpha(0);
    const zielPartei = { x: position.x, y: position.y - 54 };
    const zielNamen = { x: position.x, y: position.y + 14 };
    const zielPunkte = { x: position.x, y: position.y + 54 };
    try {
      await Promise.all([
        this.tweenZu([parteiLabel], zielPartei, 400),
        this.tweenZu([namenLabel], zielNamen, 400),
        this.tweenZu([punkteLabel], zielPunkte, 400),
        this.tweenAlpha(parteiLabel, 1, 300),
        this.tweenAlpha(namenLabel, 1, 300),
        this.tweenAlpha(punkteLabel, 1, 300)
      ]);
      await this.warte(sichtbarkeitsdauer);
      await Promise.all([
        this.tweenZu([parteiLabel], { x: position.x, y: startY }, 400),
        this.tweenZu([namenLabel], { x: position.x, y: startY + 68 }, 400),
        this.tweenZu([punkteLabel], { x: position.x, y: startY + 108 }, 400),
        this.tweenAlpha(parteiLabel, 0, 300),
        this.tweenAlpha(namenLabel, 0, 300),
        this.tweenAlpha(punkteLabel, 0, 300)
      ]);
    } finally {
      parteiLabel.destroy();
      namenLabel.destroy();
      punkteLabel.destroy();
    }
  }

  /**
   * Bockrunden-Ankuendigung: Ein Schaf faehrt von oben herein, verweilt und faehrt wieder heraus.
   * @param anzahl - Anzahl der aktiven Bockrunden (1 = Bockrunde, 2 = Doppelbock, ≥3 = Bockrunde ×N)
   * @param position - Zielposition in der Szene (z.B. Bildmitte)
   * @param sichtbarkeitsdauer - Haltezeit in ms (Standard: 2500ms)
   */
  async animiereBockrunde(anzahl: number, position: Punkt, sichtbarkeitsdauer = 2500): Promise<void> {
    const emojiText = anzahl === 1 ? '🐑' : anzahl === 2 ? '🐑🐑' : `🐑×${anzahl}`;
    const labelText = anzahl === 1 ? 'Bockrunde!' : anzahl === 2 ? 'Doppelbock!' : `Bockrunde ×${anzahl}`;
    const startY = position.y - 200;
    const schaf = this.szene.add
      .text(position.x, startY, emojiText, {
        fontFamily: FONT_FAMILY,
        fontSize: '48px',
        align: 'center'
      })
      .setOrigin(0.5, 0.5)
      .setDepth(115)
      .setAlpha(0);
    const titel = this.szene.add
      .text(position.x, startY + 90, labelText, {
        fontFamily: FONT_FAMILY,
        fontSize: '38px',
        color: '#ff6b35',
        stroke: '#000000',
        strokeThickness: 8,
        align: 'center'
      })
      .setOrigin(0.5, 0.5)
      .setDepth(115)
      .setAlpha(0);
    try {
      await Promise.all([
        this.tweenZu([schaf], { x: position.x, y: position.y - 40 }, 400),
        this.tweenZu([titel], { x: position.x, y: position.y + 50 }, 400),
        this.tweenAlpha(schaf, 1, 300),
        this.tweenAlpha(titel, 1, 300)
      ]);
      await this.warte(sichtbarkeitsdauer);
      await Promise.all([
        this.tweenZu([schaf], { x: position.x, y: startY - 40 }, 400),
        this.tweenZu([titel], { x: position.x, y: startY + 50 }, 400),
        this.tweenAlpha(schaf, 0, 300),
        this.tweenAlpha(titel, 0, 300)
      ]);
    } finally {
      schaf.destroy();
      titel.destroy();
    }
  }

  /**
   * Zeigt kurzes visuelles Feedback (goldener Text) bei einem Sonderpunkt
   * (Fuchs gefangen, Karlchen, Doppelkopf). Nicht blockierend — setzt keine Spielaktion aus.
   * @param text - Anzeige-Label des Sonderpunkts (z.B. "Fuchs gefangen")
   * @param position - Anzeigeposition in Spielpixeln
   * @param sichtbarkeitsdauer - Haltezeit in ms (Standard: 2000ms)
   */
  async animiereSonderpunktFeedback(
    text: string,
    position: Punkt,
    sichtbarkeitsdauer = 2000
  ): Promise<void> {
    const feedbackobjekt = this.szene.add
      .text(position.x, position.y, text, {
        fontFamily: FONT_FAMILY,
        fontSize: '22px',
        color: '#ffd700',
        stroke: '#000000',
        strokeThickness: 5,
        align: 'center'
      })
      .setOrigin(0.5, 0.5)
      .setDepth(100)
      .setAlpha(0);
    try {
      await this.tweenAlpha(feedbackobjekt, 1, 200);
      await this.warte(sichtbarkeitsdauer);
      await this.tweenAlpha(feedbackobjekt, 0, 200);
    } finally {
      feedbackobjekt.destroy();
    }
  }

  /**
    * Zieht alle Karten eines abgeschlossenen Stichs zur Gewinner-Position ein.
    * Wartet zuerst eine konfigurierbare Zeit, damit Spieler den Stich sehen koennen.
    * @param kartenobjekte - Alle vier Kartenobjekte des Stichs
    * @param ziel - Zielposition des Stichstapels (beim Spieler)
    * @param flashObjekt - Optionales Objekt (z.B. Nameplate), das kurz aufleuchten soll
    * @param wartezeit - Wartezeit vor dem Einziehen in ms (Standard: 1000ms)
    * @param dauer - Tween-Dauer in ms (Standard: 600ms)
    */
   async animiereStichEinziehen(
     kartenobjekte: AnimierbareKartenobjekte[],
     ziel: Punkt,
     augenzahl: number,
     flashObjekt?: Phaser.GameObjects.GameObject,
     wartezeit = 1000,
     dauer = 600
   ): Promise<void> {
     if (kartenobjekte.length === 0) {
       return;
     }
     await this.warte(wartezeit);

     if (flashObjekt) {
       // Nameplate-Flash am Gewinner
       void this.tweenAlpha(flashObjekt, 1, 200).then(async () => {
         await this.warte(200);
         await this.tweenAlpha(flashObjekt, 0, 200);
       });
     }

     // Alle Karten gleichzeitig zum Ziel bewegen und dabei verkleinern

     const animationen = kartenobjekte.flatMap((kartenobjekt) => {
       const objekte = [kartenobjekt.wurzel, kartenobjekt.beschriftung].filter(istVorhanden);
       return [
         this.tweenZu(objekte, ziel, dauer),
         this.tweenScale(kartenobjekt.wurzel, 0.4, dauer)
       ];
     });

     await Promise.all(animationen);

     // "+X Augen" Popup am Ziel einblenden
     const popup = this.szene.add.text(ziel.x, ziel.y - 40, `+${augenzahl} Augen`, {
       fontFamily: FONT_FAMILY,
       fontSize: '18px',
       color: '#ffd166',
       stroke: '#000000',
       strokeThickness: 4
     }).setOrigin(0.5).setDepth(200).setAlpha(0);

     try {
       await this.tweenAlpha(popup, 1, 200);
       await this.tweenZu([popup], { x: ziel.x, y: ziel.y - 80 }, 800);
       await this.tweenAlpha(popup, 0, 300);
     } finally {
       popup.destroy();
     }
   }
  // Zentraler Promise-Wrapper für alle Phaser-Tweens — Warum: tweenAlpha/tweenZu/tweenScale
  // teilten identische Registrierungs- und Cleanup-Logik; hier statt dreifach dupliziert.
  // Sicherheits-Timeout: Falls onComplete im Headless-Modus nicht feuert (zerstoertes Target,
  // GPU-Rendering deaktiviert), wird die Promise nach maxDauer*3+2000ms aufgeloest, damit
  // die Animationskette nicht fuer immer haengt.
  private animiereTween(
    konfiguration: Omit<Phaser.Types.Tweens.TweenBuilderConfig, 'duration' | 'onComplete'> & { duration: number }
  ): Promise<void> {
    // Sofort auflösen wenn skalierte Dauer 0 (z.B. geschwindigkeitsfaktor = Infinity):
    // Phaser-Tweens with duration=0 feuern onComplete nicht zuverlässig im Headless-Modus.
    const skalierteDauer = this.skalierteDauer(konfiguration.duration);
    if (skalierteDauer <= 0) {
      const ziele = Array.isArray(konfiguration.targets) ? konfiguration.targets : [konfiguration.targets];
      ziele.forEach((ziel) => {
        if (!ziel) return;
        if (typeof konfiguration.x === 'number') (ziel as Punkt).x = konfiguration.x;
        if (typeof konfiguration.y === 'number') (ziel as Punkt).y = konfiguration.y;
        if (typeof konfiguration.alpha === 'number') (ziel as { alpha: number }).alpha = konfiguration.alpha;
        if (typeof konfiguration.scaleX === 'number') (ziel as { scaleX: number }).scaleX = konfiguration.scaleX;
        if (typeof konfiguration.scaleY === 'number') (ziel as { scaleY: number }).scaleY = konfiguration.scaleY;
      });
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const tweenReferenz: { wert?: Phaser.Tweens.Tween } = {};
      let abgeschlossen = false;
      let sicherheitsTimer: number | undefined;
      const fertig = () => {
        if (abgeschlossen) return;
        abgeschlossen = true;
        if (tweenReferenz.wert) {
          this.laufendeTweens.delete(tweenReferenz.wert);
        }
        if (sicherheitsTimer !== undefined) {
          window.clearTimeout(sicherheitsTimer);
          this.laufendenTimer.delete(sicherheitsTimer);
        }
        resolve();
      };
      // Cast nötig: TypeScript verliert beim Spread die targets-Info aus dem Omit-Typ
      const tweenKonfig: Phaser.Types.Tweens.TweenBuilderConfig = {
        ...(konfiguration as Phaser.Types.Tweens.TweenBuilderConfig),
        duration: skalierteDauer,
        onComplete: fertig
      };
      const tween = this.szene.tweens.add(tweenKonfig);
      tweenReferenz.wert = tween;
      if (!abgeschlossen) {
        this.laufendeTweens.add(tween);
        sicherheitsTimer = window.setTimeout(fertig, skalierteDauer * 3 + 2000);
        this.laufendenTimer.add(sicherheitsTimer);
      }
    });
  }

  /**
   * Animiert die Skalierung eines Phaser-Objekts.
   * @param ziel - Zu skalierendes Objekt
   * @param skala - Ziel-Skalierung (1.0 = 100%)
   * @param dauer - Dauer in ms
   */
  private tweenScale(
    ziel: Phaser.GameObjects.GameObject & { scaleX: number; scaleY: number },
    skala: number,
    dauer: number
  ): Promise<void> {
    return this.animiereTween({ targets: [ziel], scaleX: skala, scaleY: skala, duration: dauer, ease: 'Cubic.Out' });
  }

  /**
   * Stoppt alle laufenden Tweens und Timer sofort und setzt die Warteschlange zurueck.
   * Wird beim Herunterfahren der Szene aufgerufen, um Memory-Leaks zu verhindern.
   */
  abbrechen(): void {
    this.laufendeTweens.forEach((tween) => tween.stop());
    this.laufendeTweens.clear();
    this.laufendenTimer.forEach((timer) => window.clearTimeout(timer));
    this.laufendenTimer.clear();
    this.warteschlange = Promise.resolve();
    this._animationLaeuft = false;
  }

  // Animiert die Transparenz eines Phaser-Objekts auf einen Zielwert (0=unsichtbar, 1=sichtbar)
  private tweenAlpha(
    ziel: Phaser.GameObjects.GameObject,
    alpha: number,
    dauer: number
  ): Promise<void> {
    return this.animiereTween({ targets: [ziel], alpha, duration: dauer, ease: 'Linear' });
  }

  private tweenZu(
    ziele: Phaser.GameObjects.GameObject[],
    zielPunkt: Punkt,
    dauer: number
  ): Promise<void> {
    if (ziele.length === 0) {
      return Promise.resolve();
    }
    return this.animiereTween({ targets: ziele, x: zielPunkt.x, y: zielPunkt.y, duration: dauer, ease: 'Cubic.Out' });
  }

  private warte(wartezeit: number): Promise<void> {
    const skalierteWartezeit = this.skalierteDauer(wartezeit);
    if (skalierteWartezeit <= 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => {
        this.laufendenTimer.delete(timer);
        resolve();
      }, skalierteWartezeit);
      this.laufendenTimer.add(timer);
    });
  }

  private skalierteDauer(dauer: number): number {
    return Math.max(0, Math.round(dauer / Math.max(this.geschwindigkeitsfaktor, 0.01)));
  }

  /**
   * Animiert die Rundenauswertung vollstaendig in Phaser:
   * dunkles Overlay, Sieger-Banner (Bounce), Punkte-Berechnung,
   * Flipper-Zaehler pro Spieler und Gesamtstand.
   * Gibt alle erstellten GameObjects zurueck — der Aufrufer ist fuer die Zerstoerung zustaendig.
   */
  async animiereRundenauswertung(
    daten: RundenauswertungDaten,
    breite: number,
    hoehe: number
  ): Promise<Phaser.GameObjects.GameObject[]> {
    const objekte: Phaser.GameObjects.GameObject[] = [];
    const cx = breite / 2;
    const TIEFE = 300;
    const FARBE_RE = '#ffd166';
    const FARBE_KONTRA = '#90caf9';
    const siegerFarbe = daten.siegerPartei === PARTEI.RE ? FARBE_RE : FARBE_KONTRA;
    const FONT = FONT_FAMILY;

    const fuege = <T extends Phaser.GameObjects.GameObject>(obj: T): T => {
      objekte.push(obj);
      return obj;
    };

    // ── 1. Dunkles Overlay ────────────────────────────────────────────────
    const bg = fuege(
      this.szene.add.rectangle(cx, hoehe / 2, breite, hoehe, 0x050a10, 0.93)
        .setDepth(TIEFE).setAlpha(0)
    );
    await this.tweenAlpha(bg, 1, 300);

    let y = Math.round(hoehe * 0.08);

    // ── 2. Spieltyp + Nummer ──────────────────────────────────────────────
    const kopf = fuege(
      this.szene.add.text(cx, y, `${daten.spieltypLabel}  ·  ${daten.spielNummerText}`, {
        fontFamily: FONT, fontSize: '14px', color: '#7a9aaa',
      }).setOrigin(0.5, 0).setDepth(TIEFE + 1).setAlpha(0)
    );
    await this.tweenAlpha(kopf, 1, 250);
    y += 44;

    // ── 3. Sieger-Banner (Scale-Bounce) ───────────────────────────────────
    const sieger = fuege(
      this.szene.add.text(cx, y, `${daten.siegerPartei} gewinnt!`, {
        fontFamily: FONT, fontSize: '42px', color: siegerFarbe,
        stroke: '#000000', strokeThickness: 7,
      }).setOrigin(0.5, 0).setDepth(TIEFE + 1).setAlpha(0).setScale(0.5)
    );
    await Promise.all([
      this.tweenAlpha(sieger, 1, 280),
      this.tweenScale(sieger, 1.1, 320),
    ]);
    await this.tweenScale(sieger, 1.0, 140);
    y += 74;

    // ── 4. Parteien: Spielernamen + Augen ─────────────────────────────────
    const reZeile = `RE: ${daten.reSpielerNamen}  (${daten.augenRe} Augen)`;
    const kontraZeile = `KONTRA: ${daten.kontraSpielerNamen}  (${daten.augenKontra} Augen)`;
    const parteien = fuege(
      this.szene.add.text(cx, y, `${reZeile}    ·    ${kontraZeile}`, {
        fontFamily: FONT, fontSize: '11px', color: '#99bbcc', align: 'center',
      }).setOrigin(0.5, 0).setDepth(TIEFE + 1).setAlpha(0)
    );
    await this.tweenAlpha(parteien, 1, 220);
    y += 34;

    // ── Trennlinie ────────────────────────────────────────────────────────
    const linie1 = fuege(
      this.szene.add.rectangle(cx, y + 6, Math.min(breite * 0.62, 500), 1, 0x334455)
        .setDepth(TIEFE + 1).setAlpha(0)
    );
    await this.tweenAlpha(linie1, 0.45, 180);
    y += 22;

    // ── 5. Punkte-Berechnung: Zeilen nacheinander ─────────────────────────
    const berLabel = fuege(
      this.szene.add.text(cx, y, 'Punkte-Berechnung', {
        fontFamily: FONT, fontSize: '10px', color: '#557766',
      }).setOrigin(0.5, 0).setDepth(TIEFE + 1).setAlpha(0)
    );
    await this.tweenAlpha(berLabel, 1, 130);
    y += 22;

    for (const zeile of daten.berechnungZeilen) {
      const zobj = fuege(
        this.szene.add.text(cx, y, zeile, {
          fontFamily: FONT, fontSize: '13px', color: '#aabbcc',
        }).setOrigin(0.5, 0).setDepth(TIEFE + 1).setAlpha(0)
      );
      await this.tweenAlpha(zobj, 1, 120);
      y += 25;
    }

    await this.warte(80);

    // ── 6. Gesamt-Flipper ─────────────────────────────────────────────────
    const gesamtObj = fuege(
      this.szene.add.text(cx, y, 'Gesamt:  +0', {
        fontFamily: FONT, fontSize: '20px', color: '#e8f0e8',
      }).setOrigin(0.5, 0).setDepth(TIEFE + 1).setAlpha(0)
    );
    await this.tweenAlpha(gesamtObj, 1, 150);
    await this.flipperZaehler(gesamtObj, daten.spielwert, 'Gesamt:  +', 650);
    y += 42;

    // ── Trennlinie 2 ──────────────────────────────────────────────────────
    const linie2 = fuege(
      this.szene.add.rectangle(cx, y + 6, Math.min(breite * 0.62, 500), 1, 0x334455)
        .setDepth(TIEFE + 1).setAlpha(0)
    );
    await this.tweenAlpha(linie2, 0.45, 180);
    y += 22;

    // ── 7. Spielpunkte pro Spieler mit Flipper ────────────────────────────
    const spLabel = fuege(
      this.szene.add.text(cx, y, 'Spielpunkte', {
        fontFamily: FONT, fontSize: '10px', color: '#557766',
      }).setOrigin(0.5, 0).setDepth(TIEFE + 1).setAlpha(0)
    );
    await this.tweenAlpha(spLabel, 1, 130);
    y += 22;

    const panelW = Math.min(breite * 0.58, 440);
    const linkX = cx - panelW / 2;
    const rechtsX = cx + panelW / 2;

    for (const eintrag of daten.spielpunkte) {
      const nameObj = fuege(
        this.szene.add.text(linkX, y, eintrag.istSelbst ? `▸ ${eintrag.name}` : eintrag.name, {
          fontFamily: FONT, fontSize: '14px',
          color: eintrag.istSelbst ? '#f0f4f0' : '#99aabb',
        }).setOrigin(0, 0).setDepth(TIEFE + 1).setAlpha(0)
      );
      const pfx = eintrag.punkte >= 0 ? '+' : '';
      const punkteObj = fuege(
        this.szene.add.text(rechtsX, y, `${pfx}0`, {
          fontFamily: FONT, fontSize: '14px',
          color: eintrag.punkte >= 0 ? '#7edd94' : '#ff8877',
        }).setOrigin(1, 0).setDepth(TIEFE + 1).setAlpha(0)
      );
      await Promise.all([
        this.tweenAlpha(nameObj, 1, 120),
        this.tweenAlpha(punkteObj, 1, 120),
      ]);
      await this.flipperZaehler(punkteObj, eintrag.punkte, pfx, 480);
      y += 30;
    }

    y += 8;

    // ── 8. Gesamtstand kompakt ────────────────────────────────────────────
    const gsText = daten.gesamtstand
      .slice().sort((a, b) => b.punkte - a.punkte)
      .map((e) => `${e.name} ${e.punkte}`)
      .join('  ·  ');
    const gsObj = fuege(
      this.szene.add.text(cx, y, `Gesamtstand: ${gsText}`, {
        fontFamily: FONT, fontSize: '9px', color: '#557766',
      }).setOrigin(0.5, 0).setDepth(TIEFE + 1).setAlpha(0)
    );
    await this.tweenAlpha(gsObj, 1, 200);

    return objekte;
  }

  /** Flipper-Zaehler: animiert Text-Objekt von 0 auf Zielwert (Flipper/Pinball-Stil). */
  private async flipperZaehler(
    obj: Phaser.GameObjects.Text,
    ziel: number,
    prefix: string,
    dauer: number
  ): Promise<void> {
    // Sofort Zielwert setzen wenn skalierte Dauer 0 (kein Tween noetig)
    const skalierteDauer = this.skalierteDauer(dauer);
    if (skalierteDauer <= 0) {
      try { obj.setText(`${prefix}${ziel}`); } catch { /* Objekt bereits zerstoert */ }
      return;
    }
    const counter = { val: 0 };
    await new Promise<void>((resolve) => {
      const ref: { tween?: Phaser.Tweens.Tween } = {};
      let fertig = false;
      let sicherheitsTimer: number | undefined;
      const abschliessen = () => {
        if (fertig) return;
        fertig = true;
        if (ref.tween) this.laufendeTweens.delete(ref.tween);
        if (sicherheitsTimer !== undefined) {
          window.clearTimeout(sicherheitsTimer);
          this.laufendenTimer.delete(sicherheitsTimer);
        }
        resolve();
      };
      const tween = this.szene.tweens.add({
        targets: counter,
        val: ziel,
        duration: skalierteDauer,
        ease: 'Cubic.Out',
        onUpdate: () => {
          try { obj.setText(`${prefix}${Math.round(counter.val)}`); } catch { /* Objekt bereits zerstoert */ }
        },
        onComplete: abschliessen,
      });
      ref.tween = tween;
      if (!fertig) {
        this.laufendeTweens.add(tween);
        sicherheitsTimer = window.setTimeout(abschliessen, skalierteDauer * 3 + 2000);
        this.laufendenTimer.add(sicherheitsTimer);
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Daten-Transfer-Objekt fuer die Phaser-Rundenauswertung
// ---------------------------------------------------------------------------

export interface RundenauswertungDaten {
  spieltypLabel: string;
  spielNummerText: string;
  siegerPartei: Partei;
  spielwert: number;
  reSpielerNamen: string;
  kontraSpielerNamen: string;
  augenRe: number;
  augenKontra: number;
  /** Vorformatierte Berechnungszeilen, z.B. "Grundwert: +1", "Solo-Multiplikator: ×3" */
  berechnungZeilen: string[];
  spielpunkte: { name: string; punkte: number; istSelbst: boolean }[];
  gesamtstand: { name: string; punkte: number }[];
}
