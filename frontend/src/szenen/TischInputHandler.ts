import { appStore } from '../anwendung';
import {
  SPIELER_POSITION, PARTEI,
  type TischAnsichtModell,
} from '../modelle/TischAnsichtModell';
import type { AppZustand } from '../store/AppStore';

export interface TischInputKontext {
  getLetztesModell(): TischAnsichtModell | null;
  getLetzterZustand(): AppZustand | undefined;
  getAusgewaehlteArmutKarten(): Set<string>;
  getRundenEndeModal(): HTMLDivElement | undefined;
  getPartieEndeModal(): HTMLDivElement | undefined;
  getEinstellungsModalEl(): HTMLDivElement | undefined;
  isSeitenladeOffen(): boolean;
  isEinstellungenOffen(): boolean;
  isSpielzugAnimationAktiv(): boolean;
  isArmutAnnahmeAktiv(): boolean;
  setArmutAnnahmeAktiv(v: boolean): void;
  getTastaturKarteIndex(): number;
  setTastaturKarteIndex(v: number): void;
  getTastaturVorbehaltIndex(): number;
  setTastaturVorbehaltIndex(v: number): void;
  togglSeitenlade(): void;
  togglEinstellungen(): void;
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

  /**
   * Zentraler Tastatur dispatcher: prueft den aktuellen Kontext (Vorbehalt-Modal offen?
   * Rundenende-Modal offen? etc.) und delegiert an den passenden Handler.
   */
  private verarbeiteTastatureingabe(e: KeyboardEvent): void {
    const modell = this.kontext.getLetztesModell();
    const zustand = this.kontext.getLetzterZustand();
    if (!modell || !zustand) {
      return;
    }

    // 1. Vorbehalt-Dialog hat absoluten Vorrang — keine anderen Shortcuts moeglich
    const vorbehaltAktiv = modell.aktuellerSpieler === SPIELER_POSITION.SUED && modell.moeglicheVorbehalte.length > 0;
    if (vorbehaltAktiv) {
      this.verarbeiteVorbehaltTaste(e, modell);
      return;
    }

    // 2. Armut-Antwort-Shortcuts (Annehmen / Ablehnen) — direkt ohne DOM-Button-Suche
    if (modell.aktuellerSpieler === SPIELER_POSITION.SUED
        && modell.armutAktion?.modus === 'ANTWORTEN'
        && !this.kontext.isArmutAnnahmeAktiv()) {
      if (e.key === 'a' || e.key === 'A') {
        if (modell.armutAktion.kartenAnzahl === 0) {
          appStore.beantworteArmut(true, []);
        } else {
          this.kontext.setArmutAnnahmeAktiv(true);
          this.kontext.getAusgewaehlteArmutKarten().clear();
          this.kontext.renderTisch(zustand, modell);
        }
        e.preventDefault();
        return;
      }
      if (e.key === 'n' || e.key === 'N') {
        this.kontext.setArmutAnnahmeAktiv(false);
        this.kontext.getAusgewaehlteArmutKarten().clear();
        appStore.beantworteArmut(false, []);
        e.preventDefault();
        return;
      }
    }

    // 3. Rundenende-Modal: Focus-Trap (Tab-Zirkulation) und Enter-Bestaetigung
    const rundenEndeModal = this.kontext.getRundenEndeModal();
    if (rundenEndeModal && !rundenEndeModal.hidden) {
      this.verarbeiteModalFocusTrap(e, rundenEndeModal);
      return;
    }

    // 4. Partie-Ende-Modal: Focus-Trap
    const partieEndeModal = this.kontext.getPartieEndeModal();
    if (partieEndeModal && !partieEndeModal.hidden) {
      this.verarbeiteModalFocusTrap(e, partieEndeModal);
      return;
    }

    // 5. Seitenlade (Phaser): Escape schliesst
    if (this.kontext.isSeitenladeOffen() && e.key === 'Escape') {
      this.kontext.togglSeitenlade();
      e.preventDefault();
      return;
    }

    // 6. Einstellungs-Modal (Phaser): Escape schliesst
    if (this.kontext.isEinstellungenOffen()) {
      if (e.key === 'Escape') {
        this.kontext.togglEinstellungen();
        e.preventDefault();
      }
      // Keine Focus-Trap fuer Phaser-Modal noetig/moeglich via DOM
      return;
    }

    // 6. Navigationskuerzel: I=Seitenlade, S=Einstellungen
    if (e.key === 'i' || e.key === 'I') {
      this.kontext.togglSeitenlade();
      e.preventDefault();
      return;
    }
    if (e.key === 's' || e.key === 'S') {
      this.kontext.togglEinstellungen();
      e.preventDefault();
      return;
    }

    // 7. Ansage-Kuerzel (nur moeglich wenn am Zug und Karten vorhanden)
    if (modell.aktuellerSpieler === SPIELER_POSITION.SUED && modell.moeglicheAnsagen.length > 0) {
      if (this.verarbeiteAnsageTaste(e, modell)) {
        return;
      }
    }

    // 8. Kartennavigation (nur moeglich wenn am Zug)
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

  private verarbeiteKartenTaste(e: KeyboardEvent, modell: TischAnsichtModell): void {
    if (this.kontext.isSpielzugAnimationAktiv()) {
      return;
    }

    const anzahl = modell.spielbareKarten.length;
    let aktIdx = this.kontext.getTastaturKarteIndex();

    if (e.key === 'ArrowLeft') {
      aktIdx = aktIdx < 0 ? anzahl - 1 : (aktIdx - 1 + anzahl) % anzahl;
    } else if (e.key === 'ArrowRight' || e.key === 'Tab') {
      aktIdx = aktIdx < 0 ? 0 : (aktIdx + 1) % anzahl;
    } else if (e.key === 'Home') {
      aktIdx = 0;
    } else if (e.key === 'End') {
      aktIdx = anzahl - 1;
    } else if (e.key === 'Enter' || e.key === ' ') {
      if (aktIdx >= 0 && aktIdx < anzahl) {
        void this.kontext.spieleKarteMitAnimation(modell.spielbareKarten[aktIdx]);
      }
      return;
    } else if (e.key === 'Escape') {
      aktIdx = -1;
    } else {
      return;
    }

    this.kontext.setTastaturKarteIndex(aktIdx);
    this.kontext.renderTisch(this.kontext.getLetzterZustand()!, modell);
    e.preventDefault();
  }

  private verarbeiteModalFocusTrap(e: KeyboardEvent, modal: HTMLDivElement): void {
    const focusable = modal.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.key === 'Tab') {
      if (e.shiftKey) {
        if (document.activeElement === first) {
          last?.focus();
          e.preventDefault();
        }
      } else if (document.activeElement === last) {
        first?.focus();
        e.preventDefault();
      }
    } else if (e.key === 'Enter') {
      const ersterButton = modal.querySelector<HTMLButtonElement>('button:not([disabled])');
      ersterButton?.click();
      e.preventDefault();
    }
  }
}
