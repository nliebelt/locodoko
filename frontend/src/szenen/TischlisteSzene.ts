import Phaser from 'phaser';
import { TEXTUR_FILZ, registriereBasisTexturen, ladeHintergrundbilder } from '../assets/AssetLoader';
import { appStore } from '../anwendung';
import type { AppZustand } from '../store/AppStore';
import type { TischListenEintragAntwort, TischPresetAntwort } from '../modelle/SpielverwaltungDto';
import { PhaserButton } from './PhaserButton';
import { zeigeTischErstellenDialog } from './tischErstellenDialog';
import { PhaserList } from '../ui/PhaserList';
import { FONT_FAMILY } from '../ui/designTokens';
import { Logger } from '../logger';

const ZEILE_HOEHE = 52;
// Spalten-Offsets relativ zum Container-Mittelpunkt (Container-x = canvas-breite / 2 = 640)
const COL_NAME = -575;        // absolut 65
const COL_SPIELER = -195;     // absolut 445
const COL_REGELN = 195;       // absolut 835
const COL_BUTTON = 510;       // absolut 1150, Mitte des Buttons
const MAX_BREITE_NAME = 280;
const MAX_BREITE_SPIELER = 340;
const LISTE_BREITE = 1180;

export class TischlisteSzene extends Phaser.Scene {
  private abmeldenStore?: () => void;
  private inhaltElemente: Phaser.GameObjects.GameObject[] = [];
  private tischListe?: PhaserList;
  private presets: TischPresetAntwort[] = [];

  constructor() {
    super('TischlisteSzene');
  }

  preload(): void {
    ladeHintergrundbilder(this);
  }

  create(): void {
    registriereBasisTexturen(this);
    this.add
      .tileSprite(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, TEXTUR_FILZ)
      .setAlpha(0.95);

    this.add.text(this.scale.width / 2, 45, 'OFFENE TISCHE', {
      fontFamily: FONT_FAMILY,
      fontSize: '48px',
      color: '#f8f9fa',
    }).setOrigin(0.5).setShadow(3, 3, '#000', 0);

    new PhaserButton(this, {
      x: 100, y: 45, text: '← Zurück', typ: 'secondary', breite: 160,
      testId: 'btn-tischliste-zurueck',
      callback: () => this.scene.start('SpielverwaltungsSzene'),
    });

    new PhaserButton(this, {
      x: this.scale.width - 122, y: 45, text: '+ Neuen Tisch', typ: 'secondary', breite: 200,
      testId: 'btn-tischliste-neuer-tisch',
      callback: () => zeigeTischErstellenDialog(appStore.snapshot(), this.presets),
    });

    this.zeigeHeaderZeile();

    appStore.ladePresets()
      .then(p => { this.presets = p; })
      .catch(e => Logger.error('Preset-Laden fehlgeschlagen', e));

    this.abmeldenStore?.();
    this.abmeldenStore = appStore.abonniere((zustand) => {
      this.rendereInhalt(zustand);
      if (zustand.bereich === 'TISCH' && zustand.aktuellerTisch) {
        this.abmeldenStore?.();
        this.scene.start('TischSzene');
      } else if (zustand.bereich === 'LOGIN') {
        this.abmeldenStore?.();
        this.scene.start('LoginSzene');
      }
    });

    this.events.once('shutdown', () => this.shutdown());
    this.rendereInhalt(appStore.snapshot());
  }

  private zeigeHeaderZeile(): void {
    const headerY = 118;
    const cols: [string, number][] = [
      ['Tischname', this.scale.width / 2 + COL_NAME],
      ['Spieler', this.scale.width / 2 + COL_SPIELER],
      ['Regeln', this.scale.width / 2 + COL_REGELN],
    ];
    cols.forEach(([label, x]) => {
      this.add.text(x, headerY, label, {
        fontFamily: FONT_FAMILY,
        fontSize: '14px',
        color: '#a3c4a8',
        fontStyle: 'bold',
      });
    });
    this.add
      .rectangle(this.scale.width / 2, headerY + 20, LISTE_BREITE, 1, 0x4a7c59)
      .setOrigin(0.5, 0.5);
  }

  private rendereInhalt(zustand: AppZustand): void {
    this.inhaltElemente.forEach(e => e.destroy());
    this.inhaltElemente = [];
    this.tischListe?.destroy();
    this.tischListe = undefined;

    const aktiverTischId = zustand.spieler?.aktiverTischId;
    const sichtbareTische = zustand.tische.filter(t =>
      t.status === 'WARTEND' || (t.status === 'IM_SPIEL' && t.id === aktiverTischId)
    );

    if (sichtbareTische.length === 0) {
      const txt = this.add.text(
        this.scale.width / 2, 360,
        'Keine offenen Tische — starte ein Schnellspiel in der Lobby!',
        { fontFamily: FONT_FAMILY, fontSize: '18px', color: '#a3c4a8' }
      ).setOrigin(0.5);
      this.inhaltElemente.push(txt);
      return;
    }

    const listeY = 155 + (8 * ZEILE_HOEHE) / 2;
    this.tischListe = new PhaserList(this, this.scale.width / 2, listeY, {
      breite: LISTE_BREITE,
      hoehe: 8 * ZEILE_HOEHE,
      elementHoehe: ZEILE_HOEHE,
      items: sichtbareTische,
      renderElement: (item: unknown, c: Phaser.GameObjects.Container) =>
        this.renderTischEintrag(item as TischListenEintragAntwort, c, aktiverTischId),
    });
  }

  private renderTischEintrag(
    tisch: TischListenEintragAntwort,
    c: Phaser.GameObjects.Container,
    aktiverTischId: string | null | undefined,
  ): void {
    const hervorgehoben = tisch.id === aktiverTischId;

    const bg = this.add
      .rectangle(0, 0, LISTE_BREITE - 10, ZEILE_HOEHE - 4, 0x000000, hervorgehoben ? 0.5 : 0.3)
      .setOrigin(0.5);
    c.add(bg);

    const nameTxt = this.add.text(COL_NAME, 0, (hervorgehoben ? '★ ' : '') + tisch.name, {
      fontFamily: FONT_FAMILY,
      fontSize: '16px',
      color: hervorgehoben ? '#f8c94e' : '#f8f9fa',
    }).setOrigin(0, 0.5);
    c.add(nameTxt);
    this.kuerzeText(nameTxt, MAX_BREITE_NAME);

    const spielerNamen = tisch.spielerNamen ?? [];
    const freieSlots = Math.max(0, 4 - spielerNamen.length);
    const spielerText = [...spielerNamen, ...Array(freieSlots).fill('○')].join(', ');
    const spielerTxt = this.add.text(COL_SPIELER, 0, spielerText, {
      fontFamily: FONT_FAMILY,
      fontSize: '14px',
      color: '#d4e6d4',
    }).setOrigin(0, 0.5);
    c.add(spielerTxt);
    this.kuerzeText(spielerTxt, MAX_BREITE_SPIELER);

    const kfg = tisch.kurzKonfiguration;
    const regelTxt = this.add.text(COL_REGELN, 0, `${kfg.anzahlSpiele} Sp · ${kfg.ohneNeunen ? 'o.9' : 'm.9'}`, {
      fontFamily: FONT_FAMILY,
      fontSize: '14px',
      color: '#a3c4a8',
    }).setOrigin(0, 0.5);
    c.add(regelTxt);

    const btn = new PhaserButton(this, {
      x: COL_BUTTON, y: 0,
      text: hervorgehoben ? 'Fortsetzen' : 'Beitreten',
      typ: hervorgehoben ? 'secondary' : 'primary',
      breite: 160, hoehe: 36,
      testId: hervorgehoben ? undefined : `btn-beitreten-${tisch.id}`,
      callback: () => {
        if (hervorgehoben) {
          void appStore.reconnecteTisch(tisch.id);
        } else {
          void appStore.betreteTisch(tisch.id);
        }
      },
    });
    c.add(btn);
  }

  private kuerzeText(txt: Phaser.GameObjects.Text, maxBreite: number): void {
    if (txt.width <= maxBreite) return;
    let s = txt.text;
    while (s.length > 1 && txt.width > maxBreite) {
      s = s.slice(0, -1);
      txt.setText(s + '…');
    }
  }

  shutdown(): void {
    this.abmeldenStore?.();
    this.inhaltElemente.forEach(e => e.destroy());
    this.inhaltElemente = [];
    this.tischListe?.destroy();
    this.tischListe = undefined;
  }
}
