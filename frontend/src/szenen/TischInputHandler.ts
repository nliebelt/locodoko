import { appStore } from '../anwendung';
import {
  SPIELER_POSITION, PARTEI,
  type TischAnsichtModell,
} from '../modelle/TischAnsichtModell';
import type { AppZustand } from '../store/AppStore';
import type { TischSzene } from './TischSzene';

export interface TischInputKontext {
  getLetztesModell(): TischAnsichtModell | null;
  getLetzterZustand(): AppZustand | undefined;
  getAusgewaehlteArmutKarten(): Set<string>;
  isSeitenladeOffen(): boolean;
  isEinstellungenOffen(): boolean;
  isPhaserModalOffen(): boolean;
  isSpielzugAnimationAktiv(): boolean;
  isArmutAnnahmeAktiv(): boolean;
  setArmutAnnahmeAktiv(v: boolean): void;
  getTastaturKarteIndex(): number;
  setTastaturKarteIndex(v: number): void;
  getTastaturVorbehaltIndex(): number;
  setTastaturVorbehaltIndex(v: number): void;
  togglSeitenlade(): void;
  togglEinstellungen(): void;
  togglHilfe(): void;
  renderTisch(zustand: AppZustand, modell?: TischAnsichtModell): void;
  spieleKarteMitAnimation(karteId: string): Promise<void>;
}

export class TischInputHandler {
  private tastaturHandler?: (e: KeyboardEvent) => void;

  constructor(private readonly kontext: TischInputKontext) {}

  /** Registriert den globalen Tastatur-Handler auf document. Einmalig in create() aufrufen. */
  registriere(): void {
    this.tastaturHandler = (e: KeyboardEvent) => this.verarbeiteTastatureingabe(e);
    document.addEventListener('keydown', this.tastaturHandler);
  }

  /** Entfernt den globalen Tastatur-Handler. In aufraeumen() aufrufen. */
  aufraeumen(): void {
    if (this.tastaturHandler) {
      document.removeEventListener('keydown', this.tastaturHandler);
      this.tastaturHandler = undefined;
    }
  }

  /** Prueft ob der Fokus in einem Formularfeld liegt (kein Shortcut in diesem Fall). */
  private istFormularFeld(e: KeyboardEvent): boolean {
    const ziel = e.target as HTMLElement | null;
    return !!(ziel && (ziel.tagName === 'INPUT' || ziel.tagName === 'TEXTAREA' || ziel.tagName === 'SELECT' || ziel.isContentEditable));
  }

  /** Globale Navigationskuerzel (I=Seitenlade, S=Einstellungen, H=Hilfe) — immer verfuegbar. */
  private verarbeiteGlobaleTasten(e: KeyboardEvent): boolean {
    if (e.key === 'i' || e.key === 'I') { this.kontext.togglSeitenlade(); e.preventDefault(); return true; }
    if (e.key === 's' || e.key === 'S') { this.kontext.togglEinstellungen(); e.preventDefault(); return true; }
    if (e.key === 'h' || e.key === 'H') { this.kontext.togglHilfe(); e.preventDefault(); return true; }
    return false;
  }

  /** Armut-Antwort-Shortcuts (Annehmen/Ablehnen) — direkt ohne DOM-Button-Suche. */
  private verarbeiteArmutAntwortTasten(e: KeyboardEvent, modell: TischAnsichtModell, zustand: AppZustand): boolean {
    if (modell.aktuellerSpieler !== SPIELER_POSITION.SUED) return false;
    if (modell.armutAktion?.modus !== 'ANTWORTEN') return false;
    if (this.kontext.isArmutAnnahmeAktiv()) return false;
    if (e.key === 'a' || e.key === 'A') {
      if (modell.armutAktion.kartenAnzahl === 0) {
        appStore.beantworteArmut(true, []);
      } else {
        this.kontext.setArmutAnnahmeAktiv(true);
        this.kontext.getAusgewaehlteArmutKarten().clear();
        this.kontext.renderTisch(zustand, modell);
      }
      e.preventDefault();
      return true;
    }
    if (e.key === 'n' || e.key === 'N') {
      this.kontext.setArmutAnnahmeAktiv(false);
      this.kontext.getAusgewaehlteArmutKarten().clear();
      appStore.beantworteArmut(false, []);
      e.preventDefault();
      return true;
    }
    return false;
  }

  private verarbeiteSeitenladeUndEinstellungen(e: KeyboardEvent): boolean {
    if (this.kontext.isSeitenladeOffen() && e.key === 'Escape') {
      this.kontext.togglSeitenlade();
      e.preventDefault();
      return true;
    }
    if (this.kontext.isEinstellungenOffen()) {
      // Keine Focus-Trap fuer Phaser-Modal moeglich — Escape schliesst
      if (e.key === 'Escape') { this.kontext.togglEinstellungen(); e.preventDefault(); }
      return true;
    }
    return false;
  }

  /**
   * Zentraler Tastatur dispatcher: prueft den aktuellen Kontext (Vorbehalt-Modal offen?
   * Rundenende-Modal offen? etc.) und delegiert an den passenden Handler.
   */
  private verarbeiteTastatureingabe(e: KeyboardEvent): void {
    const modell = this.kontext.getLetztesModell();
    const zustand = this.kontext.getLetzterZustand();
    if (!modell || !zustand) return;
    if (this.istFormularFeld(e)) return;
    if (this.kontext.isPhaserModalOffen()) return;
    if (this.verarbeiteGlobaleTasten(e)) return;
    if (this.verarbeiteSeitenladeUndEinstellungen(e)) return;

    // Vorbehalt-Dialog hat absoluten Vorrang
    const vorbehaltAktiv = modell.aktuellerSpieler === SPIELER_POSITION.SUED && modell.moeglicheVorbehalte.length > 0;
    if (vorbehaltAktiv) { this.verarbeiteVorbehaltTaste(e, modell); return; }

    if (this.verarbeiteArmutAntwortTasten(e, modell, zustand)) return;

    if (modell.aktuellerSpieler === SPIELER_POSITION.SUED && modell.moeglicheAnsagen.length > 0) {
      if (this.verarbeiteAnsageTaste(e, modell)) return;
    }
    if (modell.aktuellerSpieler === SPIELER_POSITION.SUED && modell.spielbareKarten.length > 0) {
      this.verarbeiteKartenTaste(e, modell);
    }
  }

  private verarbeiteVorbehaltTaste(e: KeyboardEvent, modell: TischAnsichtModell): void {
    const anzahl = modell.moeglicheVorbehalte.length;
    const index = parseInt(e.key, 10) - 1;
    if (index >= 0 && index < anzahl) {
      void appStore.meldeVorbehalt(modell.moeglicheVorbehalte[index]);
      e.preventDefault();
      return;
    }

    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      const neu = (this.kontext.getTastaturVorbehaltIndex() - 1 + anzahl) % anzahl;
      this.kontext.setTastaturVorbehaltIndex(neu);
      this.kontext.renderTisch(this.kontext.getLetzterZustand()!, modell);
      e.preventDefault();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'Tab') {
      const neu = (this.kontext.getTastaturVorbehaltIndex() + 1) % anzahl;
      this.kontext.setTastaturVorbehaltIndex(neu);
      this.kontext.renderTisch(this.kontext.getLetzterZustand()!, modell);
      e.preventDefault();
    } else if (e.key === 'Enter' || e.key === ' ') {
      void appStore.meldeVorbehalt(modell.moeglicheVorbehalte[this.kontext.getTastaturVorbehaltIndex()]);
      e.preventDefault();
    }
  }

  private verarbeiteAnsageTaste(e: KeyboardEvent, modell: TischAnsichtModell): boolean {
    if (e.key === 'r' || e.key === 'R') {
      if (modell.moeglicheAnsagen.includes(PARTEI.RE)) {
        void appStore.sageAnsageAn(PARTEI.RE);
        return true;
      }
    }
    if (e.key === 'k' || e.key === 'K') {
      if (modell.moeglicheAnsagen.includes(PARTEI.KONTRA)) {
        void appStore.sageAnsageAn(PARTEI.KONTRA);
        return true;
      }
    }
    const index = parseInt(e.key, 10) - 1;
    if (index >= 0 && index < modell.moeglicheAnsagen.length) {
      void appStore.sageAnsageAn(modell.moeglicheAnsagen[index]);
      return true;
    }
    return false;
  }

  /** Erstellt den TischInputKontext aus einer TischSzene-Referenz (type-safe Closure). */
  static erstelleKontext(szene: TischSzene): TischInputKontext {
    return {
      getLetztesModell: () => szene.letztesModell ?? null,
      getLetzterZustand: () => szene.letzterZustand,
      getAusgewaehlteArmutKarten: () => szene.ausgewaehlteArmutKarten,
      isSeitenladeOffen: () => szene.seitenladeOffen,
      isEinstellungenOffen: () => szene.einstellungenOffen,
      isPhaserModalOffen: () => !!szene.rundenEndeController?.phaserRundenEndeModal || !!szene.rundenEndeController?.phaserPartieEndeModal,
      isSpielzugAnimationAktiv: () => !!szene.wartendeKartenId || (szene.animationen?.animationLaeuft ?? false),
      isArmutAnnahmeAktiv: () => szene.armutAnnahmeAktiv,
      setArmutAnnahmeAktiv: (v) => { szene.armutAnnahmeAktiv = v; },
      getTastaturKarteIndex: () => szene.tastaturKarteIndex,
      setTastaturKarteIndex: (v) => { szene.tastaturKarteIndex = v; },
      getTastaturVorbehaltIndex: () => szene.tastaturVorbehaltIndex,
      setTastaturVorbehaltIndex: (v) => { szene.tastaturVorbehaltIndex = v; },
      togglSeitenlade: () => { szene.seitenladeOffen = !szene.seitenladeOffen; szene.triggerRender(); },
      togglEinstellungen: () => { szene.einstellungenOffen = !szene.einstellungenOffen; szene.triggerRender(); },
      togglHilfe: () => { szene.scene.launch('HilfeSzene', { modus: 'overlay' }); },
      renderTisch: (z, m) => { szene.renderTisch(z, m); },
      spieleKarteMitAnimation: (k) => szene.animationOrchestrator.spieleKarteMitAnimation(k),
    };
  }

  private berechneNeuenKartenIndex(key: string, aktIdx: number, anzahl: number): number | 'spielen' | 'ignorieren' {
    if (key === 'ArrowLeft') return aktIdx < 0 ? anzahl - 1 : (aktIdx - 1 + anzahl) % anzahl;
    if (key === 'ArrowRight' || key === 'Tab') return aktIdx < 0 ? 0 : (aktIdx + 1) % anzahl;
    if (key === 'Home') return 0;
    if (key === 'End') return anzahl - 1;
    if (key === 'Enter' || key === ' ') return 'spielen';
    if (key === 'Escape') return -1;
    return 'ignorieren';
  }

  private verarbeiteKartenTaste(e: KeyboardEvent, modell: TischAnsichtModell): void {
    if (this.kontext.isSpielzugAnimationAktiv()) return;

    const anzahl = modell.spielbareKarten.length;
    const ergebnis = this.berechneNeuenKartenIndex(e.key, this.kontext.getTastaturKarteIndex(), anzahl);
    if (ergebnis === 'ignorieren') return;

    if (ergebnis === 'spielen') {
      const aktIdx = this.kontext.getTastaturKarteIndex();
      if (aktIdx >= 0 && aktIdx < anzahl) {
        void this.kontext.spieleKarteMitAnimation(modell.spielbareKarten[aktIdx]);
      }
      return;
    }

    this.kontext.setTastaturKarteIndex(ergebnis);
    this.kontext.renderTisch(this.kontext.getLetzterZustand()!, modell);
    e.preventDefault();
  }
}
