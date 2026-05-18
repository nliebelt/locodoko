import { appStore } from '../anwendung';
import { SPIELER_POSITION } from '../modelle/TischAnsichtModell';
import type { TischAnsichtModell } from '../modelle/TischAnsichtModell';
import type { AppZustand } from '../store/AppStore';
import type { TischSzene } from './TischSzene';

/** Verwaltet Spielzustand-Synchronisation: Armut, Tastaturnavigation, Animationszustand. */
export class TischZustandsKontroller {
  constructor(private readonly szene: TischSzene) {}

  synchronisiereAktionZustand(modell: TischAnsichtModell): void {
    if (!modell.armutAktion || modell.aktuellerSpieler !== SPIELER_POSITION.SUED) {
      this.szene.armutAnnahmeAktiv = false;
      this.szene.ausgewaehlteArmutKarten.clear();
      return;
    }
    if (modell.armutAktion.modus === 'ANBIETEN') this.szene.armutAnnahmeAktiv = false;
    const eigeneHand = modell.spieler.find((s) => s.istSelbst)?.sichtbareHandkarten ?? [];
    const sichtbareIds = new Set(eigeneHand.map((k) => k.id));
    this.szene.ausgewaehlteArmutKarten = new Set(
      [...this.szene.ausgewaehlteArmutKarten].filter((id) => sichtbareIds.has(id)).slice(0, modell.armutAktion.kartenAnzahl)
    );
  }

  bestaetigeArmut(modell: TischAnsichtModell): void {
    if (!modell.armutAktion) return;
    appStore.beantworteArmut(true, Array.from(this.szene.ausgewaehlteArmutKarten));
    this.szene.armutAnnahmeAktiv = false;
    this.szene.ausgewaehlteArmutKarten.clear();
  }

  toggleArmutKarte(id: string, max: number): void {
    if (max <= 0) return;
    if (this.szene.ausgewaehlteArmutKarten.has(id)) this.szene.ausgewaehlteArmutKarten.delete(id);
    else if (this.szene.ausgewaehlteArmutKarten.size < max) this.szene.ausgewaehlteArmutKarten.add(id);
  }

  aktualisiereKartenNavigationsIndex(modell: TischAnsichtModell): void {
    const letztes = this.szene.letztesModell;
    const wE = letztes?.aktuellerSpieler === SPIELER_POSITION.SUED && (letztes?.spielbareKarten.length ?? 0) > 0;
    const iE = modell.aktuellerSpieler === SPIELER_POSITION.SUED && modell.spielbareKarten.length > 0;
    if ((!wE && iE) || (iE && this.szene.tastaturKarteIndex === -1)) this.szene.tastaturKarteIndex = 0;
    else if (!iE) this.szene.tastaturKarteIndex = -1;
    else if (iE && this.szene.tastaturKarteIndex >= modell.spielbareKarten.length) this.szene.tastaturKarteIndex = modell.spielbareKarten.length - 1;
  }

  aktualisiereVorbehaltNavigationsIndex(modell: TischAnsichtModell): void {
    const letztes = this.szene.letztesModell;
    const hatteVorbehalt = (letztes?.moeglicheVorbehalte.length ?? 0) > 0;
    const hatVorbehalt = modell.moeglicheVorbehalte.length > 0 && modell.aktuellerSpieler === SPIELER_POSITION.SUED;
    if (!hatteVorbehalt && hatVorbehalt) {
      const gesundIdx = modell.moeglicheVorbehalte.indexOf('GESUND');
      this.szene.tastaturVorbehaltIndex = gesundIdx >= 0 ? gesundIdx : 0;
    } else if (!hatteVorbehalt) {
      this.szene.tastaturVorbehaltIndex = 0;
    }
  }

  synchronisiereAnimationszustand(modell: TischAnsichtModell, zustand: AppZustand): void {
    if (!this.szene.wartendeKartenId) return;
    const sHand = modell.spieler.find((s) => s.istSelbst)?.sichtbareHandkarten ?? [];
    const inHand = sHand.some((k) => k.id === this.szene.wartendeKartenId);
    if (!inHand && zustand.meldung?.typ === 'fehler') {
      this.szene.wartendeKartenId = null;
    }
  }
}
