import Phaser from 'phaser';
import { TEXTUR_FILZ, registriereBasisTexturen, ladeHintergrundbilder } from '../assets/AssetLoader';
import { appStore } from '../anwendung';
import { PhaserButton } from './PhaserButton';
import { FONT_FAMILY } from '../ui/designTokens';
import { Logger } from '../logger';
import type { BestenlisteAntwortGenerated } from '../generated/schema-types';

const REGELVARIANTEN = ['TURNIER', 'SONDER', 'FREI'] as const;

// Spalten-Positionen (linksbündig)
const SPALTEN = [50, 110, 570, 760, 900, 1055] as const;
const HEADER_LABELS = ['#', 'Spieler', 'Rating (μ−3σ)', 'μ', 'Spiele', 'Siege %'];

/**
 * Phaser-Szene für die ewige TrueSkill-Bestenliste.
 * Sortiert nach konservativem Rating (μ − 3σ), pro Regelvariante.
 */
export class BestenlisterSzene extends Phaser.Scene {
  private aktiveRegelvariante: string = 'TURNIER';
  private inhaltElemente: Phaser.GameObjects.GameObject[] = [];
  private tabButtons: PhaserButton[] = [];

  constructor() {
    super('BestenlisterSzene');
  }

  preload(): void {
    ladeHintergrundbilder(this);
  }

  create(): void {
    registriereBasisTexturen(this);

    this.add.tileSprite(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, TEXTUR_FILZ).setAlpha(0.95);

    this.add.text(this.scale.width / 2, 45, 'BESTENLISTE', {
      fontFamily: FONT_FAMILY,
      fontSize: '48px',
      color: '#f8f9fa'
    }).setOrigin(0.5).setShadow(3, 3, '#000', 0);

    new PhaserButton(this, {
      x: 100, y: 45, text: '← Zurück', typ: 'secondary', breite: 160,
      callback: () => this.scene.start('SpielverwaltungsSzene')
    });

    this.baueTabs();
    this.ladeBestenliste();

    this.events.once('shutdown', () => this.raeumAb());
  }

  private baueTabs(): void {
    this.tabButtons.forEach(b => b.destroy());
    this.tabButtons = [];

    REGELVARIANTEN.forEach((variante, i) => {
      const btn = new PhaserButton(this, {
        x: 450 + i * 190, y: 105,
        text: variante,
        breite: 160,
        typ: variante === this.aktiveRegelvariante ? 'primary' : 'secondary',
        callback: () => {
          if (this.aktiveRegelvariante !== variante) {
            this.aktiveRegelvariante = variante;
            this.baueTabs();
            this.ladeBestenliste();
          }
        }
      });
      this.tabButtons.push(btn);
    });
  }

  private raeumInhaltAb(): void {
    this.inhaltElemente.forEach(e => e.destroy());
    this.inhaltElemente = [];
  }

  private raeumAb(): void {
    this.raeumInhaltAb();
    this.tabButtons.forEach(b => b.destroy());
    this.tabButtons = [];
  }

  private ladeBestenliste(): void {
    this.raeumInhaltAb();

    const ladeText = this.add.text(this.scale.width / 2, 400, 'Lade Bestenliste…', {
      fontFamily: FONT_FAMILY,
      fontSize: '18px',
      color: '#a3c4a8'
    }).setOrigin(0.5);
    this.inhaltElemente.push(ladeText);

    appStore.ladeBestenliste(this.aktiveRegelvariante)
      .then(antwort => this.zeigeEintraege(antwort))
      .catch(fehler => {
        Logger.error('Bestenliste laden fehlgeschlagen', fehler);
        this.raeumInhaltAb();
        const txt = this.add.text(this.scale.width / 2, 400, 'Fehler beim Laden der Bestenliste', {
          fontFamily: FONT_FAMILY,
          fontSize: '18px',
          color: '#ff6b6b'
        }).setOrigin(0.5);
        this.inhaltElemente.push(txt);
      });
  }

  private zeigeEintraege(antwort: BestenlisteAntwortGenerated): void {
    this.raeumInhaltAb();

    const eintraege = antwort.eintraege ?? [];

    if (eintraege.length === 0) {
      const txt = this.add.text(this.scale.width / 2, 400, 'Noch keine Ranglisteneinträge — spiele zuerst eine Partie!', {
        fontFamily: FONT_FAMILY,
        fontSize: '18px',
        color: '#a3c4a8'
      }).setOrigin(0.5);
      this.inhaltElemente.push(txt);
      return;
    }

    const headerY = 165;

    // Kopfzeile
    HEADER_LABELS.forEach((label, k) => {
      const t = this.add.text(SPALTEN[k], headerY, label, {
        fontFamily: FONT_FAMILY,
        fontSize: '14px',
        color: '#f8c94e',
        fontStyle: 'bold'
      });
      this.inhaltElemente.push(t);
    });

    // Trennlinie
    const sep = this.add.rectangle(this.scale.width / 2, headerY + 22, 1200, 1, 0x4a7c59).setOrigin(0.5, 0.5);
    this.inhaltElemente.push(sep);

    // Datenzeilen (max. 15)
    const maxReihen = Math.min(eintraege.length, 15);
    for (let i = 0; i < maxReihen; i++) {
      const e = eintraege[i];
      const y = headerY + 42 + i * 34;
      const farbe = i === 0 ? '#f8c94e'
        : i === 1 ? '#c0c0c0'
        : i === 2 ? '#cd7f32'
        : '#d4e6d4';

      const zeile = [
        String(e.rang ?? i + 1),
        e.spielerName ?? '–',
        e.konservativesRating?.toFixed(2) ?? '–',
        e.ratingMu?.toFixed(2) ?? '–',
        String(e.anzahlSpiele ?? 0),
        (e.siegquote?.toFixed(1) ?? '–') + ' %'
      ];

      zeile.forEach((inhalt, k) => {
        const t = this.add.text(SPALTEN[k], y, inhalt, {
          fontFamily: FONT_FAMILY,
          fontSize: '14px',
          color: farbe
        });
        this.inhaltElemente.push(t);
      });
    }
  }
}
