import type Phaser from 'phaser';
import { appStore } from '../anwendung';
import { SPIELER_POSITION } from '../modelle/TischAnsichtModell';
import type { TischAnsichtModell } from '../modelle/TischAnsichtModell';
import type { VorbehaltAnsage } from '../modelle/SpielverwaltungDto';
import type { AppZustand } from '../store/AppStore';
import { berechneKartenGroesse, berechneKartenAbstand } from './layout';
import { FONT_FAMILY } from '../ui/designTokens';
import { formatiereAnsage, formatiereVorbehalt } from './tischFormatierer';
import { erstellePhaserButton } from './TischHudRenderer';

export interface TischSpieleventKontext {
  wartendeKartenId: string | null;
  animationLaeuft: boolean;
  ausgewaehlteArmutKarten: Set<string>;
  armutAnnahmeAktiv: boolean;
  tastaturVorbehaltIndex: number;
  onTastaturVorbehaltIndexAendern: (v: number) => void;
  onRenderTisch: () => void;
  onArmutKarteToggle: (id: string, max: number) => void;
  onBestaetigeArmut: () => void;
  onArmutAnnahmeAktivSetzen: (v: boolean) => void;
}

export function renderVorbehaltButtons(
  szene: Phaser.Scene,
  ebene: Phaser.GameObjects.Container,
  modell: TischAnsichtModell,
  breite: number,
  hoehe: number,
  kontext: TischSpieleventKontext
): void {
  if (modell.aktuellerSpieler !== SPIELER_POSITION.SUED || modell.moeglicheVorbehalte.length === 0) return;
  const opt = modell.moeglicheVorbehalte;
  const idx = Math.min(kontext.tastaturVorbehaltIndex, opt.length - 1);
  const kG = berechneKartenGroesse(breite);

  const suedKartenY = hoehe * 0.91;
  const basisY = suedKartenY - kG.h * 0.5 - kG.h * 0.28 - 18;

  const bH = Math.round(Math.max(34, hoehe * 0.050));
  const bW = Math.round(Math.min(150, breite * 0.13));
  const ab = Math.round(breite * 0.008);
  const kleinFontSize = Math.round(Math.max(9, breite * 0.009));

  const maxProReihe = Math.min(opt.length, 4);
  const reihe1 = opt.slice(0, maxProReihe);
  const reihe2 = opt.slice(maxProReihe);

  const renderReihe = (reiheOpt: VorbehaltAnsage[], startGlobalIdx: number, y: number) => {
    const gesamtBreite = reiheOpt.length * bW + (reiheOpt.length - 1) * ab;
    const startX = breite / 2 - gesamtBreite / 2 + bW / 2;
    reiheOpt.forEach((v, i) => {
      erstellePhaserButton(
        szene, ebene,
        startX + i * (bW + ab), y,
        bW, bH,
        formatiereVorbehalt(v) ?? v,
        () => { void appStore.meldeVorbehalt(v); },
        false, false, startGlobalIdx + i === idx,
        `btn-vorbehalt-${v.toLowerCase().replace(/_/g, '-')}`
      );
    });
  };

  if (reihe2.length > 0) {
    renderReihe(reihe1, 0, basisY - bH / 2 - 4);
    renderReihe(reihe2, maxProReihe, basisY + bH / 2 + 4);
  } else {
    renderReihe(reihe1, 0, basisY);
  }

  const aDek = modell.deklarierteVorbehalte.filter((d) => d.position !== SPIELER_POSITION.SUED);
  if (aDek.length > 0) {
    const statusBasisY = (reihe2.length > 0 ? basisY - bH - 8 : basisY) - bH * 0.7;
    aDek.forEach((d, i) => {
      const sN = modell.spieler.find((s) => s.position === d.position)?.name ?? d.position;
      const hV = d.ansage !== 'GESUND';
      ebene.add(
        szene.add.text(breite / 2, statusBasisY - i * (kleinFontSize + 4), `${sN}: ${hV ? '⚑ Vorbehalt' : '✓ Gesund'}`, {
          fontFamily: FONT_FAMILY, color: hV ? '#ffd700' : '#aaffaa', fontSize: `${kleinFontSize}px`
        }).setOrigin(0.5)
      );
    });
  }
}

export function renderAnsageButtons(
  szene: Phaser.Scene,
  ebene: Phaser.GameObjects.Container,
  modell: TischAnsichtModell,
  zustand: AppZustand,
  breite: number,
  hoehe: number,
  kontext: TischSpieleventKontext
): void {
  if (modell.aktuellerSpieler !== SPIELER_POSITION.SUED || modell.moeglicheAnsagen.length === 0) return;
  const dkt = zustand.wirdGeladen || !!kontext.wartendeKartenId || kontext.animationLaeuft;
  const bH = Math.round(Math.max(32, hoehe * 0.048));
  const bW = Math.round(Math.min(110, breite * 0.09));
  const ab = Math.round(breite * 0.008);
  const ans = modell.moeglicheAnsagen;
  const sP = modell.spieler.find((s) => s.position === SPIELER_POSITION.SUED);
  const kAnz = sP ? (sP.sichtbareHandkarten.length > 0 ? sP.sichtbareHandkarten.length : Math.max(sP.verbleibendeKarten, 0)) : 0;
  const kAb = berechneKartenAbstand(breite, hoehe);
  const kG = berechneKartenGroesse(breite);
  const npX = Math.min(breite / 2 + (kAnz > 0 ? ((kAnz - 1) * kAb.horizontal + kG.w) / 2 : 0) + Math.max(120, breite * 0.11) / 2 + 40, breite - Math.max(120, breite * 0.11) / 2 - 4);
  const stX = npX - (ans.length * (bW + ab) - ab) / 2 + bW / 2;
  const y = Math.min(hoehe * 0.85 + Math.max(54, hoehe * 0.075) / 2 + bH / 2 + 8, hoehe - bH / 2 - 4);
  ans.forEach((a, i) => {
    erstellePhaserButton(szene, ebene, stX + i * (bW + ab), y, bW, bH, formatiereAnsage(a), () => appStore.sageAnsageAn(a), dkt, false, false, `btn-ansage-${a.toLowerCase().replace(/_/g, '-')}`);
  });
}

export function renderArmutBereich(
  szene: Phaser.Scene,
  ebene: Phaser.GameObjects.Container,
  modell: TischAnsichtModell,
  zustand: AppZustand,
  breite: number,
  hoehe: number,
  kontext: TischSpieleventKontext
): void {
  if (!modell.armutAktion || modell.aktuellerSpieler !== SPIELER_POSITION.SUED) return;
  const a = modell.armutAktion;
  const dkt = zustand.wirdGeladen || !!kontext.wartendeKartenId || kontext.animationLaeuft;
  const bH = Math.round(Math.max(32, hoehe * 0.048));
  const y = hoehe * 0.73;
  if (a.modus === 'ANBIETEN') {
    const anz = kontext.ausgewaehlteArmutKarten.size;
    ebene.add(szene.add.text(breite / 2, y - hoehe * 0.032, `Waehle ${a.kartenAnzahl} Trumpfkarte${a.kartenAnzahl === 1 ? '' : 'n'} (${anz}/${a.kartenAnzahl} gewaehlt)`, { fontFamily: FONT_FAMILY, color: '#d8f3dc', fontSize: `${Math.round(Math.max(11, breite * 0.010))}px`, align: 'center' }).setOrigin(0.5));
    erstellePhaserButton(szene, ebene, breite / 2, y, Math.round(Math.min(200, breite * 0.17)), bH, 'Trumpfkarten anbieten', () => kontext.onBestaetigeArmut(), dkt || anz !== a.kartenAnzahl, false, false, 'btn-armut-anbieten');
  } else if (!kontext.armutAnnahmeAktiv) {
    const bW = Math.round(Math.min(130, breite * 0.11));
    const ab = Math.round(breite * 0.012);
    erstellePhaserButton(szene, ebene, breite / 2 - bW / 2 - ab / 2, y, bW, bH, 'Annehmen', () => {
      if (a.kartenAnzahl === 0) appStore.beantworteArmut(true, []);
      else { kontext.onArmutAnnahmeAktivSetzen(true); kontext.ausgewaehlteArmutKarten.clear(); kontext.onRenderTisch(); }
    }, dkt, false, false, 'btn-armut-annehmen');
    erstellePhaserButton(szene, ebene, breite / 2 + bW / 2 + ab / 2, y, bW, bH, 'Ablehnen', () => {
      kontext.onArmutAnnahmeAktivSetzen(false); kontext.ausgewaehlteArmutKarten.clear(); appStore.beantworteArmut(false, []);
    }, dkt, true, false, 'btn-armut-ablehnen');
  } else {
    const anz = kontext.ausgewaehlteArmutKarten.size;
    ebene.add(szene.add.text(breite / 2, y - hoehe * 0.032, `Waehle ${a.kartenAnzahl} Karte${a.kartenAnzahl === 1 ? '' : 'n'} zurueck (${anz}/${a.kartenAnzahl})`, { fontFamily: FONT_FAMILY, color: '#d8f3dc', fontSize: `${Math.round(Math.max(11, breite * 0.010))}px`, align: 'center' }).setOrigin(0.5));
    const bW = Math.round(Math.min(150, breite * 0.13));
    const ab = Math.round(breite * 0.012);
    erstellePhaserButton(szene, ebene, breite / 2 - bW / 2 - ab / 2, y, bW, bH, 'Annahme bestaetigen', () => kontext.onBestaetigeArmut(), dkt || anz !== a.kartenAnzahl, false, false, 'btn-armut-annahme-bestaetigen');
    erstellePhaserButton(szene, ebene, breite / 2 + bW / 2 + ab / 2, y, Math.round(Math.min(100, breite * 0.085)), bH, 'Abbrechen', () => {
      kontext.onArmutAnnahmeAktivSetzen(false); kontext.ausgewaehlteArmutKarten.clear(); kontext.onRenderTisch();
    }, dkt, true, false, 'btn-armut-abbrechen');
  }
}
