import Phaser from 'phaser';

export interface PhaserListOptionen {
  breite: number;
  hoehe: number;
  worldX?: number; // Globale X-Koordinate fuer die Maske, falls in einem Container verschachtelt
  worldY?: number; // Globale Y-Koordinate fuer die Maske
}

export class PhaserList extends Phaser.GameObjects.Container {
  private scrollYOffset = 0;
  private listContainer: Phaser.GameObjects.Container;
  private maskGraphics: Phaser.GameObjects.Graphics;
  private listH: number;
  private totalListHeight: number = 0;
  private onWheel: (p: Phaser.Input.Pointer, g: unknown[], dx: number, dy: number) => void;

  constructor(scene: Phaser.Scene, x: number, y: number, optionen: PhaserListOptionen) {
    super(scene, x, y);

    this.listH = optionen.hoehe;
    this.listContainer = scene.add.container(0, 0);
    this.add(this.listContainer);

    this.maskGraphics = scene.make.graphics();
    this.maskGraphics.fillStyle(0xffffff);

    // Die Maske benoetigt absolute (Welt-)Koordinaten. 
    // Wenn worldX/worldY uebergeben wurden, nehmen wir diese, sonst nehmen wir x/y an.
    const mX = optionen.worldX !== undefined ? optionen.worldX : x;
    const mY = optionen.worldY !== undefined ? optionen.worldY : y;
    
    // Wir nehmen an, dass die Maske zentriert ueber der Liste liegt
    this.maskGraphics.fillRect(mX - optionen.breite / 2, mY - optionen.hoehe / 2, optionen.breite, optionen.hoehe);
    const mask = this.maskGraphics.createGeometryMask();
    this.listContainer.setMask(mask);

    this.onWheel = (_p: unknown, _g: unknown, _dX: number, deltaY: number) => {
      this.scrollYOffset -= deltaY * 0.5;
      if (this.scrollYOffset > 0) this.scrollYOffset = 0;
      
      const maxScroll = Math.min(0, -(this.totalListHeight - this.listH));
      if (this.scrollYOffset < maxScroll) this.scrollYOffset = maxScroll;
      
      this.listContainer.y = this.scrollYOffset;
    };

    scene.input.on('wheel', this.onWheel);
    scene.add.existing(this);
    
    this.on('destroy', () => {
      scene.input.off('wheel', this.onWheel);
      this.maskGraphics.destroy();
    });
  }

  public addItems(items: Phaser.GameObjects.GameObject[]) {
    this.listContainer.add(items);
  }
  
  public addItem(item: Phaser.GameObjects.GameObject) {
    this.listContainer.add(item);
  }

  public setTotalHeight(height: number) {
    this.totalListHeight = height;
    
    // Falls sich die Hoehe aendert, stellen wir sicher, dass der Scroll-Offset noch gueltig ist
    const maxScroll = Math.min(0, -(this.totalListHeight - this.listH));
    if (this.scrollYOffset < maxScroll) {
       this.scrollYOffset = maxScroll;
       this.listContainer.y = this.scrollYOffset;
    } else if (this.scrollYOffset > 0) {
       this.scrollYOffset = 0;
       this.listContainer.y = this.scrollYOffset;
    }
  }

  public getListContainer(): Phaser.GameObjects.Container {
    return this.listContainer;
  }
}
