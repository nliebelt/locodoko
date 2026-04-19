/**
 * Verwaltet die gesamte Tastatursteuerung der TischSzene.
 *
 * Registriert einen globalen keydown-Listener auf document und delegiert Eingaben
 * je nach aktivem Kontext (Vorbehalt-Modal, Rundenende-Modal, Ansagen, Kartennavigation)
 * an spezialisierte private Handler-Methoden.
 *
 * Abhaengigkeiten werden ueber TischInputKontext injiziert — TischInputHandler hat
 * keine direkte Referenz auf TischSzene.
 */
import { appStore } from '../anwendung';
import type { TischAnsichtModell } from '../modelle/TischAnsichtModell';
import type { AppZustand } from '../store/AppStore';

/**
 * Schnittstelle zwischen TischInputHandler und TischSzene.
 * Alle Zugriffe auf Szenen-State und Szenen-Aktionen laufen ueber dieses Interface.
 */
export interface TischInputKontext {
  getLetztesModell(): TischAnsichtModell | null;
  getLetzterZustand(): AppZustand | undefined;
  getAusgewaehlteArmutKarten(): Set<string>;
  getRundenEndeModal(): HTMLDivElement | undefined;
  getPartieEndeModal(): HTMLDivElement | undefined;
  getEinstellungsModalEl(): HTMLDivElement | undefined;
  isSeitenladeOffen(): boolean;
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
   * Zentraler Tastatur-Dispatcher: prueft den aktuellen Kontext (Vorbehalt-Modal offen?
   * Rundenende-Modal offen? etc.) und delegiert an den passenden Handler.
   */
  private verarbeiteTastatureingabe(e: KeyboardEvent): void {
    const modell = this.kontext.getLetztesModell();
    const zustand = this.kontext.getLetzterZustand();
    if (!modell || !zustand) {
      return;
    }

    // 1. Vorbehalt-Dialog hat absoluten Vorrang — keine anderen Shortcuts moeglich
    const vorbehaltAktiv = modell.aktuellerSpieler === 'SUED' && modell.moeglicheVorbehalte.length > 0;
    if (vorbehaltAktiv) {
      this.verarbeiteVorbehaltTaste(e, modell);
      return;
    }

    // 2. Armut-Antwort-Shortcuts (Annehmen / Ablehnen) — direkt ohne DOM-Button-Suche
    if (modell.aktuellerSpieler === 'SUED'
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

    // 5. Einstellungs-Modal: Escape schliesst, sonst Focus-Trap
    const einstellungsModalEl = this.kontext.getEinstellungsModalEl();
    if (einstellungsModalEl && !einstellungsModalEl.hidden) {
      if (e.key === 'Escape') {
        einstellungsModalEl.hidden = true;
        e.preventDefault();
      } else {
        this.verarbeiteModalFocusTrap(e, einstellungsModalEl);
      }
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

    // 7. Escape schliesst Seitenlade (falls offen)
    if (e.key === 'Escape' && this.kontext.isSeitenladeOffen()) {
      this.kontext.togglSeitenlade();
      e.preventDefault();
      return;
    }

    // 8. Ansage-Shortcuts (nur wenn Floating Action Bar Buttons zeigt)
    if (modell.aktuellerSpieler === 'SUED' && modell.moeglicheAnsagen.length > 0) {
      if (this.verarbeiteAnsageTaste(e, modell)) {
        return;
      }
    }

    // 9. Karten-Navigation (nur wenn eigener Spielzug mit spielbaren Karten)
    if (modell.aktuellerSpieler === 'SUED' && modell.spielbareKarten.length > 0) {
      this.verarbeiteKartenNavigationTaste(e, modell, zustand);
    }
  }

  /**
   * Verarbeitet Tastatureingaben im Vorbehalt-Modal.
   * Ziffern 1-N waehlen direkt, ArrowUp/Down navigieren, Enter bestaetigt.
   * Escape ist absichtlich nicht unterstuetzt — eine Entscheidung ist zwingend.
   */
  private verarbeiteVorbehaltTaste(e: KeyboardEvent, modell: TischAnsichtModell): void {
    const optionen = modell.moeglicheVorbehalte;
    if (optionen.length === 0) {
      return;
    }

    // Ziffer 1-N: direkte Auswahl und sofortiger Abschluss
    const ziffer = parseInt(e.key, 10);
    if (!isNaN(ziffer) && ziffer >= 1 && ziffer <= optionen.length) {
      e.preventDefault();
      appStore.meldeVorbehalt(optionen[ziffer - 1]);
      return;
    }

    // ArrowUp/Down: Navigation durch Optionen (Phaser-Dialog hat keinen DOM-Focus)
    if (e.key === 'ArrowUp') {
      this.kontext.setTastaturVorbehaltIndex(Math.max(0, this.kontext.getTastaturVorbehaltIndex() - 1));
      e.preventDefault();
      return;
    }
    if (e.key === 'ArrowDown') {
      this.kontext.setTastaturVorbehaltIndex(Math.min(optionen.length - 1, this.kontext.getTastaturVorbehaltIndex() + 1));
      e.preventDefault();
      return;
    }

    // Enter: aktuell markierte Option bestaetigen
    if (e.key === 'Enter') {
      const option = optionen[this.kontext.getTastaturVorbehaltIndex()];
      if (option !== undefined) {
        appStore.meldeVorbehalt(option);
      }
      e.preventDefault();
    }
  }

  /**
   * Verarbeitet Ansage-Shortcuts in der Floating Action Bar.
   * R=Re, K=Kontra, 1-5 fuer die Buttons in Anzeigereihenfolge.
   * Gibt true zurueck wenn eine Taste verarbeitet wurde.
   */
  private verarbeiteAnsageTaste(e: KeyboardEvent, modell: TischAnsichtModell): boolean {
    const ansagen = modell.moeglicheAnsagen;

    if (e.key === 'r' || e.key === 'R') {
      if (ansagen.includes('RE')) {
        appStore.sageAnsageAn('RE');
        e.preventDefault();
        return true;
      }
    }
    if (e.key === 'k' || e.key === 'K') {
      if (ansagen.includes('KONTRA')) {
        appStore.sageAnsageAn('KONTRA');
        e.preventDefault();
        return true;
      }
    }

    // 1-5: Ansage nach Position in der angezeigten Liste
    const ziffer = parseInt(e.key, 10);
    if (!isNaN(ziffer) && ziffer >= 1 && ziffer <= ansagen.length) {
      const ansage = ansagen[ziffer - 1];
      if (ansage) {
        appStore.sageAnsageAn(ansage);
        e.preventDefault();
        return true;
      }
    }

    return false;
  }

  /**
   * Verarbeitet Pfeiltasten/Enter/Space/Escape fuer die Karten-Navigation.
   * ArrowLeft/Right navigieren durch spielbare Karten (kreisfoermig).
   * Enter/Space spielen die markierte Karte.
   * Escape hebt die Markierung auf.
   */
  private verarbeiteKartenNavigationTaste(e: KeyboardEvent, modell: TischAnsichtModell, zustand: AppZustand): void {
    const kartenAnzahl = modell.spielbareKarten.length;

    if (e.key === 'ArrowLeft') {
      this.kontext.setTastaturKarteIndex(
        this.kontext.getTastaturKarteIndex() <= 0 ? kartenAnzahl - 1 : this.kontext.getTastaturKarteIndex() - 1
      );
      this.kontext.renderTisch(zustand, modell);
      e.preventDefault();
      return;
    }

    if (e.key === 'ArrowRight') {
      this.kontext.setTastaturKarteIndex(
        this.kontext.getTastaturKarteIndex() < 0 || this.kontext.getTastaturKarteIndex() >= kartenAnzahl - 1
          ? 0
          : this.kontext.getTastaturKarteIndex() + 1
      );
      this.kontext.renderTisch(zustand, modell);
      e.preventDefault();
      return;
    }

    if (e.key === 'Enter' || e.key === ' ') {
      const idx = this.kontext.getTastaturKarteIndex();
      if (idx >= 0 && idx < kartenAnzahl) {
        const karteId = modell.spielbareKarten[idx];
        if (karteId && !this.kontext.isSpielzugAnimationAktiv()) {
          void this.kontext.spieleKarteMitAnimation(karteId);
        }
      }
      e.preventDefault();
      return;
    }

    if (e.key === 'Escape') {
      this.kontext.setTastaturKarteIndex(-1);
      this.kontext.renderTisch(zustand, modell);
      e.preventDefault();
    }
  }

  /**
   * Focus-Trap fuer modale Dialoge: Tab zirkuliert zwischen fokussierbaren Elementen,
   * Enter bestaetigt den ersten aktiven Button.
   */
  private verarbeiteModalFocusTrap(e: KeyboardEvent, modal: HTMLElement): void {
    if (e.key === 'Tab') {
      const fokussierbar = Array.from(
        modal.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled])')
      );
      if (fokussierbar.length === 0) {
        return;
      }
      const aktuellerIndex = fokussierbar.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey) {
        const vorheriger = aktuellerIndex <= 0 ? fokussierbar.length - 1 : aktuellerIndex - 1;
        fokussierbar[vorheriger].focus();
      } else {
        const naechster = aktuellerIndex >= fokussierbar.length - 1 ? 0 : aktuellerIndex + 1;
        fokussierbar[naechster].focus();
      }
      e.preventDefault();
    } else if (e.key === 'Enter') {
      const ersterButton = modal.querySelector<HTMLButtonElement>('button:not([disabled])');
      ersterButton?.click();
      e.preventDefault();
    }
  }
}
