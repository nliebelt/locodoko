import Phaser from 'phaser';
import { TEXTUR_FILZ, TEXTUR_KARTE_OFFEN, TEXTUR_KARTE_VERDECKT } from '../assets/AssetLoader';
import { appStore } from '../anwendung';
import { erstelleTischAnsichtAusStatus, type SpielerPosition } from '../model/TischAnsichtModell';
import type { AppZustand } from '../store/AppStore';

const POSITIONEN: Record<SpielerPosition, { x: number; y: number; kartenX: number; kartenY: number; kartenWinkel: number }> = {
  SUED: { x: 640, y: 610, kartenX: 390, kartenY: 632, kartenWinkel: 0 },
  WEST: { x: 172, y: 360, kartenX: 142, kartenY: 310, kartenWinkel: 90 },
  NORD: { x: 640, y: 110, kartenX: 390, kartenY: 86, kartenWinkel: 0 },
  OST: { x: 1108, y: 360, kartenX: 1138, kartenY: 310, kartenWinkel: 90 }
};

function holeUiRoot(): HTMLElement {
  const wurzel = document.getElementById('ui-root');
  if (!wurzel) {
    throw new Error('Die UI-Wurzel #ui-root wurde nicht gefunden.');
  }
  return wurzel;
}

export class TischSzene extends Phaser.Scene {
  private abmeldenStore?: () => void;

  private tischEbene?: Phaser.GameObjects.Container;

  private panel?: HTMLDivElement;

  private statusElement?: HTMLParagraphElement;

  private spielerListe?: HTMLUListElement;

  constructor() {
    super('TischSzene');
  }

  create(): void {
    this.add.tileSprite(640, 360, 1280, 720, TEXTUR_FILZ);
    this.baueUi();
    this.abmeldenStore = appStore.abonnieren((zustand) => {
      this.aktualisiereUi(zustand);
      if (zustand.bereich === 'LOBBY') {
        this.scene.start('LobbySzene');
        return;
      }
      this.renderTisch(zustand);
    });
  }

  shutdown(): void {
    this.aufraeumen();
  }

  destroy(): void {
    this.aufraeumen();
  }

  private baueUi(): void {
    const uiRoot = holeUiRoot();
    uiRoot.innerHTML = '';

    const links = document.createElement('div');
    links.className = 'ui-panel ui-panel--compact';
    links.innerHTML = `
      <h2>Tischsteuerung</h2>
      <p class="ui-panel__muted"></p>
      <div class="ui-action-row">
        <button class="ui-button ui-button--secondary" type="button">Zur Lobby</button>
        <button class="ui-button ui-button--danger" type="button">Tisch verlassen</button>
        <button class="ui-button" type="button">Spiel starten</button>
      </div>
      <h3>Spieler am Tisch</h3>
      <ul class="ui-list"></ul>
    `;

    const statusElement = links.querySelector('p');
    const spielerListe = links.querySelector('ul');
    const buttons = links.querySelectorAll('button');
    const lobbyButton = buttons.item(0);
    const leaveButton = buttons.item(1);
    const startButton = buttons.item(2);
    if (!(statusElement instanceof HTMLParagraphElement) || !(spielerListe instanceof HTMLUListElement) || !(lobbyButton instanceof HTMLButtonElement) || !(leaveButton instanceof HTMLButtonElement) || !(startButton instanceof HTMLButtonElement)) {
      throw new Error('Tisch-UI konnte nicht aufgebaut werden.');
    }

    lobbyButton.addEventListener('click', () => {
      this.scene.start('LobbySzene');
    });
    leaveButton.addEventListener('click', () => {
      void appStore.verlasseAktuellenTisch();
    });
    startButton.addEventListener('click', () => {
      void appStore.starteAktuellenTisch();
    });

    const toastStack = document.createElement('div');
    toastStack.className = 'ui-toast-stack';

    this.panel = links;
    this.statusElement = statusElement;
    this.spielerListe = spielerListe;
    uiRoot.append(links, toastStack);
  }

  private aktualisiereUi(zustand: AppZustand): void {
    const tisch = zustand.aktuellerTisch;
    if (!tisch || !this.statusElement || !this.spielerListe || !this.panel) {
      return;
    }

    const buttons = this.panel.querySelectorAll('button');
    const leaveButton = buttons.item(1);
    const startButton = buttons.item(2);
    if (leaveButton instanceof HTMLButtonElement) {
      leaveButton.disabled = zustand.wirdGeladen || tisch.status !== 'WARTEND';
    }
    if (startButton instanceof HTMLButtonElement) {
      const darfStarten = zustand.spieler?.spielerId === tisch.erstelltVonSpielerId && tisch.status === 'WARTEND';
      startButton.disabled = zustand.wirdGeladen || !darfStarten;
    }

    const statusZeile = [
      `${tisch.name} · ${tisch.status}`,
      `${tisch.spieler.length}/4 Spieler`,
      tisch.partieId ? `Partie ${tisch.partieId}` : 'Noch keine Partie gestartet'
    ];
    if (zustand.partieStand) {
      statusZeile.push(`Gesamtstand ${zustand.partieStand.gespielteSpiele}/${zustand.partieStand.anzahlSpiele}`);
    }
    if (zustand.meldung?.typ === 'fehler') {
      statusZeile.push(`Fehler: ${zustand.meldung.text}`);
    }
    this.statusElement.textContent = statusZeile.join(' · ');

    this.spielerListe.innerHTML = '';
    tisch.spieler.forEach((spieler) => {
      const eintrag = document.createElement('li');
      eintrag.className = 'ui-list-item';
      const istEigenerSpieler = spieler.spielerId === zustand.spieler?.spielerId;
      eintrag.innerHTML = `
        <div class="ui-list-item__headline">
          <strong>${spieler.name}</strong>
          <span class="ui-badge ${istEigenerSpieler ? 'ui-badge--highlight' : ''}">${istEigenerSpieler ? 'Du' : spieler.istKi ? 'KI' : 'Mensch'}</span>
        </div>
        <div class="ui-list-item__meta">
          <span>${spieler.spielerId === tisch.erstelltVonSpielerId ? 'Ersteller' : 'Mitspieler'}</span>
        </div>
      `;
      this.spielerListe?.append(eintrag);
    });
  }

  private renderTisch(zustand: AppZustand): void {
    this.tischEbene?.destroy(true);
    const modell = erstelleTischAnsichtAusStatus(zustand.spieler?.spielerId ?? null, zustand.aktuellerTisch, zustand.partieStand);
    const ebene = this.add.container(0, 0);

    ebene.add(this.add.rectangle(640, 360, 980, 530, 0x1d6b43, 0.96).setStrokeStyle(8, 0xd8f3dc, 0.42));
    ebene.add(this.add.text(640, 42, modell.titel, {
      color: '#f8f9fa',
      fontSize: '30px',
      fontStyle: 'bold'
    }).setOrigin(0.5));
    ebene.add(this.add.text(640, 76, `${modell.untertitel} · ${modell.statusText}`, {
      color: '#d8f3dc',
      fontSize: '16px'
    }).setOrigin(0.5));
    ebene.add(this.add.text(640, 360, 'Stichmitte\n(Live-Spielzustand folgt im naechsten Slice)', {
      color: '#f8f9fa',
      fontSize: '22px',
      align: 'center'
    }).setOrigin(0.5));

    modell.spieler.forEach((spieler) => {
      const position = POSITIONEN[spieler.position];
      const farbe = spieler.istAktivHervorgehoben ? 0xffe082 : 0xcfe6d6;
      ebene.add(this.add.circle(position.x, position.y, 62, farbe, 0.94).setStrokeStyle(4, 0x14361f, 0.35));
      ebene.add(this.add.text(position.x, position.y - 18, spieler.name, {
        color: '#14361f',
        fontSize: '18px',
        fontStyle: 'bold'
      }).setOrigin(0.5));
      ebene.add(this.add.text(position.x, position.y + 8, spieler.statusText, {
        color: '#14361f',
        fontSize: '15px'
      }).setOrigin(0.5));
      ebene.add(this.add.text(position.x, position.y + 28, spieler.istErsteller ? 'Ersteller' : spieler.verbleibendeKarten > 0 ? `${spieler.verbleibendeKarten} Karten` : 'Wartet', {
        color: '#14361f',
        fontSize: '13px'
      }).setOrigin(0.5));
      this.renderKartenFaecher(ebene, spieler.position, spieler.position === 'SUED' || modell.debugModus, spieler.verbleibendeKarten > 0 ? 8 : 4);
    });

    const stand = zustand.partieStand?.gesamtpunktestand;
    if (stand) {
      ebene.add(this.add.text(640, 675, `Gesamtstand - S: ${stand.SUED ?? 0} · W: ${stand.WEST ?? 0} · N: ${stand.NORD ?? 0} · O: ${stand.OST ?? 0}`, {
        color: '#f8f9fa',
        fontSize: '16px'
      }).setOrigin(0.5));
    }

    this.tischEbene = ebene;
  }

  private renderKartenFaecher(
    ebene: Phaser.GameObjects.Container,
    spielerPosition: SpielerPosition,
    offen: boolean,
    anzahl: number
  ): void {
    const position = POSITIONEN[spielerPosition];
    const textur = offen ? TEXTUR_KARTE_OFFEN : TEXTUR_KARTE_VERDECKT;

    for (let index = 0; index < anzahl; index += 1) {
      const abstand = spielerPosition === 'SUED' || spielerPosition === 'NORD' ? index * 28 : index * 16;
      const x = (spielerPosition === 'SUED' || spielerPosition === 'NORD') ? position.kartenX + abstand : position.kartenX;
      const y = (spielerPosition === 'SUED' || spielerPosition === 'NORD') ? position.kartenY : position.kartenY + abstand;
      const winkel = spielerPosition === 'SUED'
        ? -12 + index * 3
        : spielerPosition === 'NORD'
          ? 12 - index * 3
          : position.kartenWinkel;
      ebene.add(this.add.image(x, y, textur).setDisplaySize(82, 124).setAngle(winkel).setAlpha(offen ? 1 : 0.92));
    }
  }

  private aufraeumen(): void {
    this.abmeldenStore?.();
    this.abmeldenStore = undefined;
    this.tischEbene?.destroy(true);
    this.tischEbene = undefined;
    if (this.panel?.parentElement) {
      this.panel.parentElement.innerHTML = '';
    }
    this.panel = undefined;
  }
}
