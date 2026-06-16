import type Phaser from 'phaser';
import { appStore } from '../anwendung';
import type { TischAnsichtModell } from '../modelle/TischAnsichtModell';
import type { AppZustand } from '../store/AppStore';
import type { Tischhintergrund } from '../modelle/SpielverwaltungDto';
import { FONT_FAMILY, PANEL_BG, BORDER_PANEL } from '../ui/designTokens';
import { formatiereAnsage } from './tischFormatierer';
/** Moegliche Animations-Geschwindigkeitsstufen: normal (1x), doppelt (2x), sofort (Infinity). */
export type AnimationsGeschwindigkeit = 1 | 2 | typeof Infinity;

const LS_GESCHWINDIGKEIT = 'locodoko.animationsgeschwindigkeit';

export function ladeGeschwindigkeit(): AnimationsGeschwindigkeit {
  const wert = localStorage.getItem(LS_GESCHWINDIGKEIT);
  if (wert === '2') return 2;
  if (wert === 'sofort') return Infinity;
  return 1;
}

export function speichereGeschwindigkeit(faktor: AnimationsGeschwindigkeit): void {
  const wert = faktor === Infinity ? 'sofort' : String(faktor);
  localStorage.setItem(LS_GESCHWINDIGKEIT, wert);
}

interface ButtonFarben { hgF: number; rF: number; tF: string; }

// overlay=true: Balatro-Purpur-Palette für Buttons in Modals (gold-primär/purpur-sekundär).
// Default (grün) gilt für In-Game-HUD, Ansage- und Armut-Buttons auf dem Spieltisch.
function berechneButtonFarben(d: boolean, hv: boolean, s: boolean, overlay: boolean): ButtonFarben {
  if (d) return { hgF: 0x2a2a2a, rF: 0x555555, tF: '#888888' };
  if (hv) return { hgF: 0xffd166, rF: 0xf8f9fa, tF: '#0d1f12' };
  if (overlay) return { hgF: s ? 0x2d1d40 : 0xffd700, rF: 0x4a2d6a, tF: s ? '#f0e6ff' : '#1a1020' };
  return { hgF: s ? 0x1a2a1a : 0x1a5a2a, rF: s ? 0x4a7a5a : 0x4adf7a, tF: '#f8f9fa' };
}

/** Erzeugt einen einfachen Aktionsbutton auf der Tischebene. */
export function erstellePhaserButton(
  szene: Phaser.Scene,
  ebene: Phaser.GameObjects.Container,
  x: number, y: number, w: number, h: number,
  txt: string, hdl: () => void,
  d = false, s = false, hv = false, testId?: string, overlay = false
): void {
  const { hgF, rF, tF } = berechneButtonFarben(d, hv, s, overlay);
  const bg = szene.add.rectangle(x, y, w, h, hgF, d ? 0.5 : 0.92).setStrokeStyle(hv ? 2 : 1, rF, 0.9);
  if (testId) bg.setName(testId);
  ebene.add(bg);
  ebene.add(szene.add.text(x, y, txt, { fontFamily: FONT_FAMILY, color: tF, fontSize: `${Math.round(Math.max(12, szene.scale.gameSize.width * 0.011))}px` }).setOrigin(0.5));
  if (!d) bg.setInteractive({ useHandCursor: true }).on('pointerdown', hdl);
}

export interface TischHudTopBarKontext {
  einstellungenOffen: boolean;
  seitenladeOffen: boolean;
  spielprotokollOffen: boolean;
  wirdGeladen: boolean;
  onToggleEinstellungen: () => void;
  onToggleSeitenlade: () => void;
  onToggleSpielprotokoll: () => void;
  onToggleHilfe: () => void;
}

export function renderHud(
  szene: Phaser.Scene,
  ebene: Phaser.GameObjects.Container,
  modell: TischAnsichtModell,
  breite: number,
  hoehe: number
): void {
  const hudW = Math.round(breite * 0.18);
  const hudX = 0;
  const hudY = 40;
  const hudH = hoehe - hudY;
  ebene.add(szene.add.rectangle(hudX + hudW / 2, hudY + hudH / 2, hudW, hudH, 0x0b3d24, 0.95).setStrokeStyle(1, 0xd8f3dc, 0.2));
  let currentY = hudY + 20;
  const schriftName = Math.round(Math.max(13, breite * 0.010));
  const schriftInfo = Math.round(Math.max(10, breite * 0.008));
  const zeilenAbstand = 35;
  ebene.add(szene.add.text(hudX + 15, currentY, 'SPIELER', { fontFamily: FONT_FAMILY, color: '#a3c4a8', fontSize: `${schriftInfo}px` }));
  currentY += 25;
  modell.spieler.forEach((spieler) => {
    const farbe = spieler.istSelbst ? '#ffd166' : '#f8f9fa';
    ebene.add(szene.add.text(hudX + 15, currentY, spieler.anzeigeName, { fontFamily: FONT_FAMILY, color: farbe, fontSize: `${schriftName}px`, fontStyle: spieler.istSelbst ? 'bold' : 'normal' }));
    const info = `${spieler.stiche} Stiche${spieler.partei ? ' · ' + spieler.partei : ''}`;
    ebene.add(szene.add.text(hudX + 15, currentY + 16, info, { fontFamily: FONT_FAMILY, color: '#a3c4a8', fontSize: `${schriftInfo}px` }));
    currentY += zeilenAbstand + 10;
  });
  currentY += 10;
  if (modell.gesamtpunktestand.length > 0) {
    ebene.add(szene.add.text(hudX + 15, currentY, 'PUNKTESTAND', { fontFamily: FONT_FAMILY, color: '#a3c4a8', fontSize: `${schriftInfo}px` }));
    currentY += 25;
    modell.gesamtpunktestand.forEach((eintrag) => {
      ebene.add(szene.add.text(hudX + 15, currentY, `${eintrag.name}: ${eintrag.punkte >= 0 ? '+' : ''}${eintrag.punkte}`, { fontFamily: FONT_FAMILY, color: '#f8f9fa', fontSize: `${schriftName}px` }));
      currentY += 22;
    });
  }
  currentY += 15;
  if (modell.ansageHistorie.length > 0) {
    ebene.add(szene.add.text(hudX + 15, currentY, 'HISTORIE', { fontFamily: FONT_FAMILY, color: '#a3c4a8', fontSize: `${schriftInfo}px` }));
    currentY += 25;
    modell.ansageHistorie.slice(-6).reverse().forEach((ansage) => {
      ebene.add(szene.add.text(hudX + 15, currentY, `${ansage.name}: ${formatiereAnsage(ansage.ansage)}`, { fontFamily: FONT_FAMILY, color: '#d8f3dc', fontSize: `${schriftInfo}px` }));
      currentY += 18;
    });
  }
  currentY += 15;
  const letzteStiche = modell.letzteAbgeschlosseneStiche.slice(-3).reverse();
  if (letzteStiche.length > 0) {
    ebene.add(szene.add.text(hudX + 15, currentY, 'LETZTE STICHE', { fontFamily: FONT_FAMILY, color: '#a3c4a8', fontSize: `${schriftInfo}px` }));
    currentY += 25;
    letzteStiche.forEach((stich) => {
      ebene.add(szene.add.text(hudX + 15, currentY, `${stich.gewinnerName}: ${stich.augen} Augen`, { fontFamily: FONT_FAMILY, color: '#ffd166', fontSize: `${schriftInfo}px` }));
      currentY += 18;
    });
  }
}

export function renderTopBar(
  szene: Phaser.Scene,
  ebene: Phaser.GameObjects.Container,
  modell: TischAnsichtModell,
  zustand: AppZustand,
  breite: number,
  kontext: TischHudTopBarKontext
): void {
  const barH = 40;
  const barColor = 0x0d1f12;
  ebene.add(szene.add.rectangle(breite / 2, barH / 2, breite, barH, barColor, 1).setStrokeStyle(1, 0xd8f3dc, 0.15));
  const schriftM = Math.round(Math.max(12, breite * 0.011));
  const iconSize = Math.round(Math.max(16, breite * 0.014));
  const stichAnzahl = modell.spieler.reduce((sum, s) => sum + s.stiche, 0);
  const maxStiche = zustand.aktuellerTisch?.konfiguration.ohneNeunen ? 10 : 12;
  const stichInfo = modell.spieltyp ? `Stich ${stichAnzahl}/${maxStiche}` : '';
  ebene.add(szene.add.text(15, barH / 2, stichInfo, { fontFamily: FONT_FAMILY, color: '#a3c4a8', fontSize: `${schriftM}px` }).setOrigin(0, 0.5));
  const tisch = zustand.aktuellerTisch;
  const spiel = zustand.partieStand?.laufendesSpiel;
  let zentrumsText = tisch?.name ?? '';
  if (spiel) {
    zentrumsText += ` · Spiel ${spiel.spielNummer}/${zustand.partieStand?.anzahlSpiele ?? '?'}`;
    if (modell.spieltyp) zentrumsText += ` · ${modell.spieltyp}`;
  } else if (tisch) {
    const statusMap: Record<string, string> = { WARTEND: 'Wartend', IM_SPIEL: 'Im Spiel', BEENDET: 'Beendet' };
    zentrumsText += ` · ${statusMap[tisch.status] ?? tisch.status}`;
  }
  ebene.add(szene.add.text(breite / 2, barH / 2, zentrumsText, { fontFamily: FONT_FAMILY, color: '#f8f9fa', fontSize: `${schriftM}px` }).setOrigin(0.5));
  let rightX = breite - 15;
  const debugIcon = szene.add.text(rightX, barH / 2, '🐛', { fontFamily: FONT_FAMILY, fontSize: `${iconSize}px` }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
  debugIcon.on('pointerdown', () => appStore.toggleDebugModus());
  rightX -= 35;
  const settingsIcon = szene.add.text(rightX, barH / 2, '⚙', { fontFamily: FONT_FAMILY, fontSize: `${iconSize}px` }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
  settingsIcon.on('pointerdown', kontext.onToggleEinstellungen);
  rightX -= 35;
  const sidebarIcon = szene.add.text(rightX, barH / 2, '≡', { fontFamily: FONT_FAMILY, fontSize: `${iconSize}px` }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
  sidebarIcon.on('pointerdown', kontext.onToggleSeitenlade);
  rightX -= 35;
  const protokollIcon = szene.add.text(rightX, barH / 2, '📋', { fontFamily: FONT_FAMILY, fontSize: `${iconSize}px` }).setOrigin(1, 0.5).setAlpha(kontext.spielprotokollOffen ? 1 : 0.6).setInteractive({ useHandCursor: true });
  protokollIcon.on('pointerdown', kontext.onToggleSpielprotokoll);
  rightX -= 35;
  const hilfeIcon = szene.add.text(rightX, barH / 2, '?', { fontFamily: FONT_FAMILY, fontSize: `${iconSize}px`, color: '#f8c94e' }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
  hilfeIcon.on('pointerdown', kontext.onToggleHilfe);
  rightX -= 35;
  const leaveIcon = szene.add.text(rightX, barH / 2, '←', { fontFamily: FONT_FAMILY, fontSize: `${iconSize}px`, color: '#ef4444' }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
  leaveIcon.on('pointerdown', () => {
    const istImSpiel = appStore.snapshot().aktuellerTisch?.status === 'IM_SPIEL';
    if (istImSpiel && !window.confirm('Partie abbrechen und Tisch verlassen?')) return;
    void appStore.verlasseAktuellenTisch();
  });
  rightX -= 35;
  const startBtnSichtbar = tisch?.status === 'WARTEND' && zustand.spieler?.spielerId === tisch.erstelltVonSpielerId;
  if (startBtnSichtbar) {
    const startBtnW = 100;
    erstellePhaserButton(szene, ebene, rightX - startBtnW / 2, barH / 2, startBtnW, 28, 'START', () => { void appStore.starteAktuellenTisch(); }, kontext.wirdGeladen);
    rightX -= startBtnW + 15;
  }
  if (tisch?.einladungsCode) {
    const shareBtnW = 110;
    erstellePhaserButton(szene, ebene, rightX - shareBtnW / 2, barH / 2, shareBtnW, 28, '🔗 LINK', () => {
      const url = `${window.location.origin}#join/${tisch.einladungsCode}`;
      void navigator.clipboard.writeText(url);
    }, false, true);
  }
}

export interface TischEinstellungsModalKontext {
  animationsGeschwindigkeit: AnimationsGeschwindigkeit;
  onEinstellungenSchliessen: () => void;
  onAnimationsGeschwindigkeitAendern: (v: AnimationsGeschwindigkeit) => void;
}

export function renderEinstellungsModal(
  szene: Phaser.Scene,
  ebene: Phaser.GameObjects.Container,
  modell: TischAnsichtModell,
  zustand: AppZustand,
  breite: number,
  hoehe: number,
  kontext: TischEinstellungsModalKontext
): void {
  const dialogW = Math.round(Math.min(420, breite * 0.35));
  const dialogH = Math.round(Math.min(480, hoehe * 0.7));
  const dialogX = breite / 2;
  const dialogY = hoehe / 2;
  const backdrop = szene.add.rectangle(dialogX, dialogY, breite, hoehe, 0x000000, 0.6).setInteractive();
  backdrop.on('pointerdown', kontext.onEinstellungenSchliessen);
  ebene.add(backdrop);
  // Balatro-Purpur-Modal (Neo-Brutalism): harter Offset-Schatten, scharfe Ecken, gold-Titel.
  ebene.add(szene.add.rectangle(dialogX + 4, dialogY + 4, dialogW, dialogH, 0x000000, 1));
  const panel = szene.add.rectangle(dialogX, dialogY, dialogW, dialogH, PANEL_BG).setStrokeStyle(2, BORDER_PANEL);
  ebene.add(panel);
  const schriftH2 = Math.round(Math.max(18, breite * 0.016));
  const schriftHint = Math.round(Math.max(11, breite * 0.009));
  const zeilenAbstand = 70;
  let currentY = dialogY - dialogH / 2 + 40;
  ebene.add(szene.add.text(dialogX, currentY, 'Einstellungen', { fontFamily: FONT_FAMILY, color: '#ffd700', fontSize: `${schriftH2}px` }).setOrigin(0.5));
  currentY += 50;
  const tisch = zustand.aktuellerTisch;
  const darfKonf = zustand.spieler?.spielerId === tisch?.erstelltVonSpielerId && tisch?.status === 'WARTEND';
  ebene.add(szene.add.text(dialogX, currentY, 'Tischhintergrund', { fontFamily: FONT_FAMILY, color: '#f0e6ff', fontSize: `${schriftHint}px` }).setOrigin(0.5));
  currentY += 25;
  const bgOptionen: Tischhintergrund[] = ['FILZ_GRUEN', 'HOLZ_DUNKEL', 'BLAU_GRAFIK', 'RECHTECK_1', 'RECHTECK_2', 'OVAL_1', 'OVAL_2', 'RUND_1'];
  const aktuellerBgIdx = bgOptionen.indexOf(modell.tischhintergrund);
  erstellePhaserButton(szene, ebene, dialogX, currentY, dialogW - 60, 34, modell.tischhintergrund.replace(/_/g, ' '), () => {
    const naechsterIdx = (aktuellerBgIdx + 1) % bgOptionen.length;
    void appStore.aktualisiereAktuellenTischhintergrund(bgOptionen[naechsterIdx]);
  }, zustand.wirdGeladen || !darfKonf, true, false, undefined, true);
  currentY += zeilenAbstand - 20;
  ebene.add(szene.add.text(dialogX, currentY, 'KI-Schwierigkeit', { fontFamily: FONT_FAMILY, color: '#f0e6ff', fontSize: `${schriftHint}px` }).setOrigin(0.5));
  currentY += 25;
  const kiOptionen: Array<'LEICHT' | 'STANDARD' | 'SCHWER'> = ['LEICHT', 'STANDARD', 'SCHWER'];
  const aktuelleKi = tisch?.konfiguration.kiSchwierigkeit ?? 'STANDARD';
  const kiIdx = kiOptionen.indexOf(aktuelleKi as 'LEICHT' | 'STANDARD' | 'SCHWER');
  erstellePhaserButton(szene, ebene, dialogX, currentY, dialogW - 60, 34, aktuelleKi, () => {
    const naechsterIdx = (kiIdx + 1) % kiOptionen.length;
    void appStore.aktualisiereAktuelleKiSchwierigkeit(kiOptionen[naechsterIdx]);
  }, zustand.wirdGeladen || !darfKonf, true, false, undefined, true);
  currentY += zeilenAbstand - 20;
  ebene.add(szene.add.text(dialogX, currentY, 'Animationen', { fontFamily: FONT_FAMILY, color: '#f0e6ff', fontSize: `${schriftHint}px` }).setOrigin(0.5));
  currentY += 25;
  const geschw = kontext.animationsGeschwindigkeit;
  const label = geschw === Infinity ? 'Geschw.: sofort' : `Geschw.: ${geschw}x`;
  erstellePhaserButton(szene, ebene, dialogX, currentY, dialogW - 60, 34, label, () => {
    const naechste: AnimationsGeschwindigkeit = geschw === 1 ? 2 : geschw === 2 ? Infinity : 1;
    kontext.onAnimationsGeschwindigkeitAendern(naechste);
  }, false, true, false, undefined, true);
  const btnW = Math.round(dialogW * 0.4);
  erstellePhaserButton(szene, ebene, dialogX - btnW / 2 - 10, dialogY + dialogH / 2 - 40, btnW, 40, 'Zur Lobby', () => { void szene.scene.start('SpielverwaltungsSzene'); }, false, true, false, undefined, true);
  erstellePhaserButton(szene, ebene, dialogX + btnW / 2 + 10, dialogY + dialogH / 2 - 40, btnW, 40, 'Schließen', kontext.onEinstellungenSchliessen, false, false, false, undefined, true);
}
