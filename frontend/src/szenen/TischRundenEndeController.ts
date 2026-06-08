import Phaser from 'phaser';
import { appStore } from '../anwendung';
import { Logger } from '../logger';
import { PARTEI, SPIELER_POSITION } from '../modelle/TischAnsichtModell';
import type { TischAnsichtModell } from '../modelle/TischAnsichtModell';
import type { AppZustand } from '../store/AppStore';
import type { VorbehaltAnsage } from '../modelle/SpielverwaltungDto';
import { PhaserModal } from '../ui/PhaserModal';
import {
  formatiereVorbehalt,
  formatiereSonderpunkt,
  formatiereCountdownText,
} from './tischFormatierer';

/**
 * Verwaltet die Rundenende- und Partieende-Modals.
 * Kapselt den zugehoerigen Zustand (phaserRundenEndeModal, etc.) aus TischSzene heraus.
 */
export class TischRundenEndeController {
  phaserRundenEndeModal?: PhaserModal;
  rundenauswertungObjekte: Phaser.GameObjects.GameObject[] = [];
  phaserPartieEndeModal?: PhaserModal;
  partieCountdownInterval?: number;
  private tweenCountUp?: Phaser.Tweens.Tween;
  private yoyoTweens: Phaser.Tweens.Tween[] = [];

  constructor(
    private readonly szene: Phaser.Scene,
    private readonly getLetzterZustand: () => AppZustand | undefined
  ) {}

  async zeigeRundenEndeModal(m: TischAnsichtModell): Promise<void> {
    const e = m.letztesSpielergebnis;
    if (!e) {
      Logger.szene('zeigeRundenEndeModal: kein Spielergebnis — Queue wird fortgesetzt');
      appStore.setzeQueueFort();
      return;
    }

    const br = (window as { __locodoko?: { _rundenEndeModalGezeigt?: number; _rundenauswertungSpieltypLabel?: string; _rundenauswertungMultiplikator?: number } }).__locodoko;
    if (br) {
      br._rundenEndeModalGezeigt = (br._rundenEndeModalGezeigt ?? 0) + 1;
      br._rundenauswertungSpieltypLabel = formatiereVorbehalt(e.spieltyp as VorbehaltAnsage) ?? e.spieltyp;
      br._rundenauswertungMultiplikator = e.soloMultiplikator;
    }

    const anzahlS = this.getLetzterZustand()?.aktuellerTisch?.konfiguration?.anzahlSpiele;
    const { width: bw, height: bh } = this.szene.scale.gameSize;
    const cx = bw / 2, cy = bh / 2;
    const spieltypLabel = formatiereVorbehalt(e.spieltyp as VorbehaltAnsage) ?? e.spieltyp;

    this.phaserRundenEndeModal = new PhaserModal(this.szene, cx, cy, {
      breite: 620,
      hoehe: 520,
      titel: anzahlS ? `${spieltypLabel} | Spiel ${e.spielNummer}/${anzahlS}` : `${spieltypLabel} | Spiel ${e.spielNummer}`,
      aktionen: [{ text: 'Weiter', callback: () => this.schliesseRundenEndeModal() }]
    });
    this.rundenauswertungObjekte.push(this.phaserRundenEndeModal);

    const gewinner = e.siegerPartei === PARTEI.RE ? 'RE gewinnt!' : 'KONTRA gewinnt!';
    const siegerFarbe = e.siegerPartei === PARTEI.RE ? '#ffd700' : '#ff4455';
    let ry = -520 / 2 + 70;

    const siegerText = this.szene.add.text(0, ry, gewinner, {
      fontSize: '18px', color: siegerFarbe, fontFamily: 'Press Start 2P', stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5, 0).setDepth(100);
    this.phaserRundenEndeModal.getContentContainer().add(siegerText);
    ry += 36;

    const aufschluesselung = e.punkteAufschluesselung.length > 0
      ? e.punkteAufschluesselung
      : [
          { label: 'Grundwert', punkte: e.grundwert },
          ...(e.absagePunkte !== 0 ? [{ label: 'Ansagen', punkte: e.absagePunkte }] : []),
          ...(e.gegenDieAltenPunkte > 0 ? [{ label: 'Gegen die Alten', punkte: e.gegenDieAltenPunkte }] : []),
          ...(e.sonderpunkteRe.length + e.sonderpunkteKontra.length > 0
            ? [{ label: 'Sonderpunkte', punkte: e.sonderpunkteRe.length + e.sonderpunkteKontra.length }]
            : [])
        ];

    const countUpTexte: { wert: number; label: string; textObj: Phaser.GameObjects.Text }[] = [];
    aufschluesselung.forEach((pc) => {
      const txt = this.szene.add.text(-290, ry, `${pc.label}: 0`, {
        fontSize: '12px', color: '#f0e6ff', fontFamily: 'Press Start 2P'
      }).setOrigin(0, 0).setDepth(100);
      this.phaserRundenEndeModal!.getContentContainer().add(txt);
      countUpTexte.push({ wert: pc.punkte, label: pc.label, textObj: txt });
      ry += 24;
    });

    const targets = countUpTexte.map(() => ({ t: 0 }));
    this.tweenCountUp = this.szene.tweens.add({
      targets,
      t: 1,
      duration: 800,
      ease: Phaser.Math.Easing.Cubic.Out,
      onUpdate: () => {
        countUpTexte.forEach((ct, idx) => {
          const val = Math.round(ct.wert * targets[idx].t);
          ct.textObj.setText(`${ct.label}: ${val > 0 ? '+' : ''}${val}`);
          if (targets[idx].t >= 0.95 && !ct.textObj.getData('yoyo-started')) {
            ct.textObj.setData('yoyo-started', true);
            ct.textObj.setColor('#ffff66');
            const tween = this.szene.tweens.add({ targets: ct.textObj, alpha: 0.6, duration: 150, yoyo: true, repeat: 1,
              onComplete: () => { ct.textObj.setColor('#f0e6ff'); ct.textObj.setAlpha(1); }
            });
            this.yoyoTweens.push(tween);
          }
        });
      }
    });

    ry += 12;
    const swText = this.szene.add.text(0, ry, `Spielwert: ${e.spielwert > 0 ? '+' : ''}${e.spielwert}`, {
      fontSize: '13px', color: siegerFarbe, fontFamily: 'Press Start 2P'
    }).setOrigin(0.5, 0).setDepth(100);
    this.phaserRundenEndeModal.getContentContainer().add(swText);
    ry += 28;

    e.spielpunkte.forEach((sp) => {
      const istSelbst = sp.position === SPIELER_POSITION.SUED;
      const marker = istSelbst ? ' <<' : '';
      const spTxt = this.szene.add.text(-290, ry, `${sp.name}: ${sp.punkte > 0 ? '+' : ''}${sp.punkte}${marker}`, {
        fontSize: '10px', color: istSelbst ? '#ffd700' : '#c0b0d0', fontFamily: 'Press Start 2P'
      }).setOrigin(0, 0).setDepth(100);
      this.phaserRundenEndeModal!.getContentContainer().add(spTxt);
      ry += 20;
    });

    this.szene.add.existing(this.phaserRundenEndeModal);
    this.phaserRundenEndeModal.setDepth(200);
  }

  schliesseRundenEndeModal(): void {
    this.tweenCountUp?.remove();
    this.tweenCountUp = undefined;
    this.yoyoTweens.forEach((t) => t.remove());
    this.yoyoTweens = [];
    this.phaserRundenEndeModal?.destroy();
    this.phaserRundenEndeModal = undefined;
    this.rundenauswertungObjekte.forEach((o) => o.destroy());
    this.rundenauswertungObjekte = [];
    appStore.setzeQueueFort();
  }

  zeigePartieEndeModal(m: TischAnsichtModell): void {
    const e = m.letztesSpielergebnis;
    if (!e) {
      Logger.szene('zeigePartieEndeModal: kein Spielergebnis — Queue wird fortgesetzt');
      appStore.setzeQueueFort();
      return;
    }

    const anzahlS = this.getLetzterZustand()?.aktuellerTisch?.konfiguration?.anzahlSpiele;
    const sNMap = new Map(m.spieler.map((s) => [s.position, s.name] as const));
    const spieltypLabel = formatiereVorbehalt(e.spieltyp as VorbehaltAnsage) ?? e.spieltyp;
    const siegerFarbe = e.siegerPartei === 'RE' ? '#4adf7a' : '#ff6b6b';

    this.phaserPartieEndeModal = new PhaserModal(this.szene, this.szene.scale.gameSize.width / 2, this.szene.scale.gameSize.height / 2, {
      breite: 500,
      hoehe: 600,
      titel: 'Partie beendet',
      zeigeSchliessenButton: false,
      aktionen: [
        {
          text: 'Neue Partie',
          callback: () => { this.schliessePartieEndeModal(); void appStore.starteNeuePartie(); }
        },
        {
          text: 'Tisch verlassen',
          typ: 'secondary',
          callback: () => { this.schliessePartieEndeModal(); void appStore.verlasseAktuellenTisch(); }
        }
      ]
    });

    const container = this.phaserPartieEndeModal.getContentContainer();
    // Start unter dem Modaltitel: PhaserModal zeichnet den Titel bei modal-y = -hoehe/2 + 20 = -280.
    // Ein Content-Start bei -280 überlappte den Titel ("Partie beendet" doppelt). 50px Abstand.
    let y = -230;

    const infoTxt = this.szene.add.text(0, y, `${spieltypLabel} · ${anzahlS ? `Spiel ${e.spielNummer} von ${anzahlS}` : `Spiel ${e.spielNummer}`}`, {
      fontSize: '12px', color: '#d8f3dc', fontFamily: 'Press Start 2P'
    }).setOrigin(0.5, 0);
    container.add(infoTxt);
    y += 20;

    const siegerTxt = this.szene.add.text(0, y, `${e.siegerPartei} gewinnt`, {
      fontSize: '16px', color: siegerFarbe, fontFamily: 'Press Start 2P', stroke: '#000', strokeThickness: 2
    }).setOrigin(0.5, 0);
    container.add(siegerTxt);
    y += 28;

    const augenTxt = this.szene.add.text(0, y, `Re ${e.augenRe}:${e.augenKontra} Kontra Augen`, {
      fontSize: '11px', color: '#90caf9', fontFamily: 'Press Start 2P'
    }).setOrigin(0.5, 0);
    container.add(augenTxt);
    y += 20;

    const reNamen = m.spieler.filter((s) => s.partei === PARTEI.RE).map((s) => s.name).join(', ') || '–';
    const kontraNamen = m.spieler.filter((s) => s.partei === PARTEI.KONTRA).map((s) => s.name).join(', ') || '–';
    const parteienTxt = this.szene.add.text(0, y, `Re: ${reNamen}\nKontra: ${kontraNamen}`, {
      fontSize: '9px', color: '#c0b0d0', fontFamily: 'Press Start 2P', align: 'center'
    }).setOrigin(0.5, 0);
    container.add(parteienTxt);
    y += 36;

    const bZ: string[] = [`Grundwert: +${e.grundwert}`];
    if (e.absagePunkte !== 0) bZ.push(`Ansagen: ${e.absagePunkte > 0 ? '+' : ''}${e.absagePunkte}`);
    if (e.gegenDieAltenPunkte > 0) bZ.push(`Gegen die Alten: +${e.gegenDieAltenPunkte}`);
    if (e.soloMultiplikator > 1) bZ.push(`Solo-Multiplikator: ×${e.soloMultiplikator}`);
    const sp = [...e.sonderpunkteRe.map((s) => `Re: ${formatiereSonderpunkt(s, sNMap)}`), ...e.sonderpunkteKontra.map((s) => `Kontra: ${formatiereSonderpunkt(s, sNMap)}`)];
    if (sp.length > 0) bZ.push(`Sonderpunkte: ${sp.join(', ')}`);

    bZ.forEach((zeile) => {
      const berechnungTxt = this.szene.add.text(-220, y, zeile, {
        fontSize: '10px', color: '#f0e6ff', fontFamily: 'Press Start 2P'
      }).setOrigin(0, 0);
      container.add(berechnungTxt);
      y += 18;
    });

    y += 6;
    const spielwertTxt = this.szene.add.text(0, y, `Spielwert: ${e.spielwert > 0 ? '+' : ''}${e.spielwert}`, {
      fontSize: '12px', color: siegerFarbe, fontFamily: 'Press Start 2P'
    }).setOrigin(0.5, 0);
    container.add(spielwertTxt);
    y += 22;

    e.spielpunkte.forEach((sp) => {
      const istSelbst = sp.position === SPIELER_POSITION.SUED;
      const marker = istSelbst ? ' <<' : '';
      const puntFarbe = sp.punkte >= 0 ? '#4adf7a' : '#ff6b6b';
      const punktTxt = this.szene.add.text(-220, y, `${sp.name}: ${sp.punkte > 0 ? '+' : ''}${sp.punkte}${marker}`, {
        fontSize: '10px', color: puntFarbe, fontFamily: 'Press Start 2P'
      }).setOrigin(0, 0);
      container.add(punktTxt);
      y += 18;
    });

    y += 12;
    const gesamtstandTitel = this.szene.add.text(0, y, 'Gesamtstand', {
      fontSize: '12px', color: '#ffd700', fontFamily: 'Press Start 2P'
    }).setOrigin(0.5, 0);
    container.add(gesamtstandTitel);
    y += 20;

    const sortedGs = [...m.gesamtpunktestand].sort((a, b) => b.punkte - a.punkte).slice(0, 4);
    const maxPkt = sortedGs.length > 0 ? sortedGs[0].punkte : 0;
    sortedGs.forEach((ei) => {
      const istVorne = ei.punkte === maxPkt && maxPkt > 0;
      const sternchenText = istVorne ? ' ★' : '';
      const gsTxt = this.szene.add.text(-220, y, `${ei.name}${sternchenText}: ${ei.punkte}`, {
        fontSize: '10px', color: istVorne ? '#ffd166' : '#c0b0d0', fontFamily: 'Press Start 2P'
      }).setOrigin(0, 0);
      container.add(gsTxt);
      y += 18;
    });

    y += 12;
    const countdownTxt = this.szene.add.text(0, y, '', {
      fontSize: '10px', color: '#888888', fontFamily: 'Press Start 2P'
    }).setOrigin(0.5, 0);
    container.add(countdownTxt);

    const updateCountdown = () => {
      const aktuellerCountdown = appStore.snapshot().countdownSekunden ?? 0;
      countdownTxt.setText(formatiereCountdownText(aktuellerCountdown));
      if (aktuellerCountdown <= 0) {
        this.schliessePartieEndeModal();
        void appStore.starteNeuePartie();
      }
    };

    updateCountdown();
    this.partieCountdownInterval = window.setInterval(updateCountdown, 1000);

    this.szene.add.existing(this.phaserPartieEndeModal);
    this.phaserPartieEndeModal.setDepth(200);

    const br = (window as { __locodoko?: { _partieEndeModalGezeigt?: number } }).__locodoko;
    if (br) {
      br._partieEndeModalGezeigt = (br._partieEndeModalGezeigt ?? 0) + 1;
    }
  }

  schliessePartieEndeModal(): void {
    if (this.partieCountdownInterval !== undefined) {
      clearInterval(this.partieCountdownInterval);
      this.partieCountdownInterval = undefined;
    }
    this.phaserPartieEndeModal?.destroy();
    this.phaserPartieEndeModal = undefined;
    appStore.setzeQueueFort();
  }

  aufraeumen(): void {
    this.tweenCountUp?.remove();
    this.tweenCountUp = undefined;
    this.yoyoTweens.forEach((t) => t.remove());
    this.yoyoTweens = [];
    if (this.partieCountdownInterval !== undefined) {
      clearInterval(this.partieCountdownInterval);
      this.partieCountdownInterval = undefined;
    }
    this.phaserRundenEndeModal?.destroy();
    this.phaserRundenEndeModal = undefined;
    this.rundenauswertungObjekte.forEach((o) => o.destroy());
    this.rundenauswertungObjekte = [];
    this.phaserPartieEndeModal?.destroy();
    this.phaserPartieEndeModal = undefined;
  }
}
