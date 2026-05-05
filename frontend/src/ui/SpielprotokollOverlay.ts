import Phaser from 'phaser';
import {
  PANEL_BG, BORDER_PANEL, FONT_FAMILY
} from './designTokens';
import type { SpielprotokollEintrag } from '../store/AppStore';
import type { TischAnsichtModell, SpielerPosition } from '../modelle/TischAnsichtModell';

export class SpielprotokollOverlay extends Phaser.GameObjects.Container {
  private scrollYOffset = 0;
  private listContainer: Phaser.GameObjects.Container;
  private maskGraphics: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    breite: number,
    hoehe: number,
    eintraege: SpielprotokollEintrag[],
    modell: TischAnsichtModell,
    onClose: () => void
  ) {
    super(scene, x, y);

    const dialogW = Math.min(800, breite * 0.95);
    const dialogH = Math.min(500, hoehe * 0.8);

    // Backdrop
    const backdrop = scene.add.rectangle(0, 0, breite, hoehe, 0x000000, 0.6)
      .setInteractive()
      .on('pointerdown', onClose);
    this.add(backdrop);

    // Panel
    const panel = scene.add.rectangle(0, 0, dialogW, dialogH, PANEL_BG)
      .setStrokeStyle(4, BORDER_PANEL);
    // Prevent clicks from passing through
    panel.setInteractive().on('pointerdown', () => { /* konsumiert den Event, verhindert Durchklicken */ });
    this.add(panel);

    // Title
    const title = scene.add.text(0, -dialogH / 2 + 20, 'SPIELPROTOKOLL', {
      fontFamily: FONT_FAMILY,
      fontSize: '16px',
      color: '#ffd700'
    }).setOrigin(0.5, 0);
    this.add(title);

    // Close button
    const closeBtn = scene.add.text(dialogW / 2 - 20, -dialogH / 2 + 20, 'X', {
      fontFamily: FONT_FAMILY,
      fontSize: '16px',
      color: '#ff4455'
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true })
      .on('pointerdown', onClose);
    this.add(closeBtn);

    // Headers
    const startY = -dialogH / 2 + 60;
    const colX = {
      nr: -dialogW / 2 + 20,
      geber: -dialogW / 2 + 60,
      typ: -dialogW / 2 + 120,
      bock: -dialogW / 2 + 230,
      spieler: -dialogW / 2 + 280
    };

    const headerStyle = { fontFamily: FONT_FAMILY, fontSize: '10px', color: '#7a5a9a' };
    this.add(scene.add.text(colX.nr, startY, 'NR', headerStyle));
    this.add(scene.add.text(colX.geber, startY, 'GEBER', headerStyle));
    this.add(scene.add.text(colX.typ, startY, 'TYP', headerStyle));
    this.add(scene.add.text(colX.bock, startY, 'BOCK', headerStyle));

    const posOrder: SpielerPosition[] = ['SUED', 'WEST', 'NORD', 'OST'];
    const pColWidth = Math.floor((dialogW - 280 - 20) / 4);

    posOrder.forEach((pos, idx) => {
      const spName = modell.spieler.find(s => s.position === pos)?.name ?? pos;
      const xPos = colX.spieler + idx * pColWidth;
      this.add(scene.add.text(xPos, startY - 15, spName.substring(0, 8), { ...headerStyle, color: '#f0e6ff' }));
      this.add(scene.add.text(xPos, startY, 'PKT', headerStyle));
      this.add(scene.add.text(xPos + 35, startY, 'STD', headerStyle));
    });

    this.add(scene.add.line(0, startY + 20, -dialogW / 2 + 20, 0, dialogW / 2 - 20, 0, BORDER_PANEL));

    // List Container with Mask
    const listY = startY + 30;
    const listH = dialogH - (listY - (-dialogH / 2)) - 20;

    this.listContainer = scene.add.container(0, listY);
    this.add(this.listContainer);

    this.maskGraphics = scene.make.graphics();
    this.maskGraphics.fillStyle(0xffffff);
    // Absolute position for mask relative to scene (x, y are the center of the screen)
    this.maskGraphics.fillRect(x - dialogW / 2, y + listY, dialogW, listH);
    const mask = this.maskGraphics.createGeometryMask();
    this.listContainer.setMask(mask);

    // Populate List
    const rowH = 25;
    const rowStyle = { fontFamily: FONT_FAMILY, fontSize: '8px', color: '#f0e6ff' };
    const rowBockStyle = { fontFamily: FONT_FAMILY, fontSize: '8px', color: '#ffd700' };

    if (eintraege.length === 0) {
      this.listContainer.add(scene.add.text(0, 20, 'Noch keine Spiele absolviert.', { ...rowStyle, color: '#7a5a9a', fontSize: '10px' }).setOrigin(0.5, 0));
    }

    eintraege.forEach((e, idx) => {
      const yPos = idx * rowH;
      const isLast = idx === eintraege.length - 1;
      const rowColor = isLast ? '#44aaff' : '#f0e6ff';
      const style = { ...rowStyle, color: rowColor };

      this.listContainer.add(scene.add.text(colX.nr, yPos, e.nr.toString(), style));
      this.listContainer.add(scene.add.text(colX.geber, yPos, e.geber.substring(0,1), style));
      
      let typShort = e.spieltyp;
      if (typShort === 'NORMALSPIEL') typShort = 'NORMAL';
      else if (typShort.startsWith('SOLO_')) typShort = typShort.replace('SOLO_', '');
      this.listContainer.add(scene.add.text(colX.typ, yPos, typShort, style));
      
      this.listContainer.add(scene.add.text(colX.bock, yPos, e.istBockrunde ? 'JA' : '-', e.istBockrunde ? rowBockStyle : style));

      posOrder.forEach((pos, pIdx) => {
        const px = colX.spieler + pIdx * pColWidth;
        const pData = e.punkteProSpieler[pos];
        const pkt = pData ? (pData.pkt > 0 ? `+${pData.pkt}` : pData.pkt.toString()) : '-';
        const std = pData ? pData.stand.toString() : '-';
        
        const pktColor = pData && pData.pkt > 0 ? '#44ff88' : (pData && pData.pkt < 0 ? '#ff4455' : rowColor);
        this.listContainer.add(scene.add.text(px, yPos, pkt, { ...style, color: pktColor }));
        this.listContainer.add(scene.add.text(px + 35, yPos, std, style));
      });
    });

    const totalListHeight = eintraege.length * rowH;

    // Scrolling logic
    if (totalListHeight > listH) {
      scene.input.on('wheel', (_p: unknown, _g: unknown, _dX: number, deltaY: number) => {
        this.scrollYOffset -= deltaY * 0.5;
        if (this.scrollYOffset > 0) this.scrollYOffset = 0;
        const maxScroll = -(totalListHeight - listH);
        if (this.scrollYOffset < maxScroll) this.scrollYOffset = maxScroll;
        this.listContainer.y = listY + this.scrollYOffset;
      });
      this.on('destroy', () => scene.input.off('wheel'));
    }

    scene.add.existing(this);
  }

  destroy(fromScene?: boolean) {
    this.maskGraphics.destroy();
    super.destroy(fromScene);
  }
}
