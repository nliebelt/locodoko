import Phaser from 'phaser';
import { TEXTUR_FILZ, TEXTUR_KARTE_OFFEN, TEXTUR_KARTE_VERDECKT } from '../assets/AssetLoader';
import { appStore } from '../anwendung';
import { erstelleTischAnsichtAusStatus, type SpielerPosition } from '../model/TischAnsichtModell';
import type { KarteAntwort } from '../modelle/SpielverwaltungDto';
import type { AppZustand } from '../store/AppStore';

const POSITIONEN: Record<SpielerPosition, { x: number; y: number; kartenX: number; kartenY: number; kartenWinkel: number }> = {
  SUED: { x: 640, y: 610, kartenX: 390, kartenY: 632, kartenWinkel: 0 },
  WEST: { x: 172, y: 360, kartenX: 142, kartenY: 310, kartenWinkel: 90 },
  NORD: { x: 640, y: 110, kartenX: 390, kartenY: 86, kartenWinkel: 0 },
  OST: { x: 1108, y: 360, kartenX: 1138, kartenY: 310, kartenWinkel: 90 }
};

function kuerzelFuerKarte(karte: KarteAntwort): string {
  const wert = ({
    AS: 'A',
    ZEHN: '10',
    KOENIG: 'K',
    DAME: 'D',
    BUBE: 'B',
    NEUN: '9'
  } as Record<string, string>)[karte.wert] ?? karte.wert.slice(0, 2);
  const farbe = ({
    KREUZ: 'K',
    PIK: 'P',
    HERZ: 'H',
    KARO: 'D'
  } as Record<string, string>)[karte.farbe] ?? karte.farbe.slice(0, 1);
  return `${farbe}${wert}`;
}

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

  private toastStack?: HTMLDivElement;

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
        <button class="ui-button ui-button--secondary" type="button">Debug aus</button>
      </div>
      <div class="ui-grid">
        <div class="ui-stat-card"><span class="ui-hint">Spieltyp</span><strong data-spieltyp>-</strong></div>
        <div class="ui-stat-card"><span class="ui-hint">Phase</span><strong data-phase>-</strong></div>
        <div class="ui-stat-card"><span class="ui-hint">Aktiv</span><strong data-aktiv>-</strong></div>
        <div class="ui-stat-card"><span class="ui-hint">Optionen</span><strong data-optionen>-</strong></div>
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
    const debugButton = buttons.item(3);
    if (!(statusElement instanceof HTMLParagraphElement)
      || !(spielerListe instanceof HTMLUListElement)
      || !(lobbyButton instanceof HTMLButtonElement)
      || !(leaveButton instanceof HTMLButtonElement)
      || !(startButton instanceof HTMLButtonElement)
      || !(debugButton instanceof HTMLButtonElement)) {
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
    debugButton.addEventListener('click', () => {
      appStore.toggleDebugModus();
    });

    const toastStack = document.createElement('div');
    toastStack.className = 'ui-toast-stack';

    this.panel = links;
    this.statusElement = statusElement;
    this.spielerListe = spielerListe;
    this.toastStack = toastStack;
    uiRoot.append(links, toastStack);
  }

  private aktualisiereUi(zustand: AppZustand): void {
    const tisch = zustand.aktuellerTisch;
    if (!tisch || !this.statusElement || !this.spielerListe || !this.panel) {
      return;
    }

    const modell = erstelleTischAnsichtAusStatus(
      zustand.spieler?.spielerId ?? null,
      zustand.aktuellerTisch,
      zustand.partieStand,
      zustand.debugModus
    );

    const buttons = this.panel.querySelectorAll('button');
    const leaveButton = buttons.item(1);
    const startButton = buttons.item(2);
    const debugButton = buttons.item(3);
    if (leaveButton instanceof HTMLButtonElement) {
      leaveButton.disabled = zustand.wirdGeladen || tisch.status !== 'WARTEND';
    }
    if (startButton instanceof HTMLButtonElement) {
      const darfStarten = zustand.spieler?.spielerId === tisch.erstelltVonSpielerId && tisch.status === 'WARTEND';
      startButton.disabled = zustand.wirdGeladen || !darfStarten;
    }
    if (debugButton instanceof HTMLButtonElement) {
      debugButton.textContent = zustand.debugModus ? 'Debug an' : 'Debug aus';
      debugButton.disabled = zustand.wirdGeladen || !zustand.partieStand;
    }

    const statusZeile = [
      `${tisch.name} · ${tisch.status}`,
      `${tisch.spieler.length}/4 Spieler`,
      tisch.partieId ? `Partie ${tisch.partieId}` : 'Noch keine Partie gestartet'
    ];
    if (zustand.partieStand) {
      statusZeile.push(`Gesamtstand ${zustand.partieStand.gespielteSpiele}/${zustand.partieStand.anzahlSpiele}`);
      if (zustand.partieStand.laufendesSpiel) {
        statusZeile.push(`Phase ${zustand.partieStand.laufendesSpiel.phase}`);
      }
    }
    if (zustand.meldung?.typ === 'fehler') {
      statusZeile.push(`Fehler: ${zustand.meldung.text}`);
    }
    this.statusElement.textContent = statusZeile.join(' · ');
    this.aktualisiereStatistiken(modell);
    this.aktualisiereToasts(zustand);

    this.spielerListe.innerHTML = '';
    modell.spieler.forEach((spieler) => {
      const eintrag = document.createElement('li');
      eintrag.className = 'ui-list-item';
      const badge = spieler.position === 'SUED' ? 'Du' : spieler.istMensch ? 'Mensch' : 'KI';
      const parteiBadge = spieler.partei ? `<span class="ui-badge ui-badge--partei">${spieler.partei}</span>` : '';
      eintrag.innerHTML = `
        <div class="ui-list-item__headline">
          <strong>${spieler.name}</strong>
          <span class="ui-badge ${spieler.position === 'SUED' ? 'ui-badge--highlight' : ''}">${badge}</span>
        </div>
        <div class="ui-list-item__meta">
          <span>${spieler.istErsteller ? 'Ersteller' : spieler.statusText}</span>
          <span>${spieler.istGeber ? 'Geber' : `${spieler.stiche} Stiche`}</span>
          ${parteiBadge}
        </div>
      `;
      this.spielerListe?.append(eintrag);
    });
  }

  private renderTisch(zustand: AppZustand): void {
    this.tischEbene?.destroy(true);
    const modell = erstelleTischAnsichtAusStatus(
      zustand.spieler?.spielerId ?? null,
      zustand.aktuellerTisch,
      zustand.partieStand,
      zustand.debugModus
    );
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
    const mitteText = modell.aktuellerSpieler
      ? `Stichmitte\nAm Zug: ${modell.aktuellerSpieler}\n${modell.spieltyp ?? 'WARTEND'}`
      : 'Stichmitte';
    ebene.add(this.add.text(640, 360, mitteText, {
      color: '#f8f9fa',
      fontSize: '22px',
      align: 'center'
    }).setOrigin(0.5));
    if (modell.moeglicheAnsagen.length > 0) {
      ebene.add(this.add.text(640, 304, `Ansagen moeglich: ${modell.moeglicheAnsagen.join(', ')}`, {
        color: '#a5d6a7',
        fontSize: '16px'
      }).setOrigin(0.5));
    }
    if (modell.moeglicheVorbehalte.length > 0) {
      ebene.add(this.add.text(640, 420, `Vorbehalt moeglich: ${modell.moeglicheVorbehalte.join(', ')}`, {
        color: '#ffe082',
        fontSize: '16px'
      }).setOrigin(0.5));
    }

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
      if (spieler.partei) {
        ebene.add(this.add.text(position.x, position.y - 46, spieler.partei, {
          color: spieler.partei === 'RE' ? '#ffd166' : '#90caf9',
          fontSize: '14px',
          fontStyle: 'bold'
        }).setOrigin(0.5));
      }
      if (spieler.istGeber) {
        ebene.add(this.add.text(position.x + 44, position.y - 48, 'G', {
          color: '#f8f9fa',
          fontSize: '14px',
          fontStyle: 'bold',
          backgroundColor: '#14361f'
        }).setOrigin(0.5));
      }
      this.renderKartenFaecher(
        ebene,
        spieler.position,
        spieler.position === 'SUED' || (modell.debugModus && spieler.sichtbareHandkarten.length > 0),
        spieler.sichtbareHandkarten.length > 0 ? spieler.sichtbareHandkarten : undefined,
        spieler.verbleibendeKarten > 0 ? spieler.verbleibendeKarten : 4,
        modell.spielbareKarten
      );
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

  private aktualisiereStatistiken(modell: ReturnType<typeof erstelleTischAnsichtAusStatus>): void {
    if (!this.panel) {
      return;
    }
    this.setzeStatText('spieltyp', modell.spieltyp ?? 'Noch offen');
    this.setzeStatText('phase', modell.phase ?? 'Warten');
    this.setzeStatText('aktiv', modell.aktuellerSpieler ?? 'Niemand');
    const optionen = [...modell.moeglicheAnsagen, ...modell.moeglicheVorbehalte];
    this.setzeStatText('optionen', optionen.length > 0 ? optionen.join(', ') : 'Keine');
  }

  private setzeStatText(name: string, text: string): void {
    const element = this.panel?.querySelector(`[data-${name}]`);
    if (element) {
      element.textContent = text;
    }
  }

  private aktualisiereToasts(zustand: AppZustand): void {
    if (!this.toastStack) {
      return;
    }
    this.toastStack.innerHTML = '';
    if (!zustand.meldung) {
      return;
    }
    const toast = document.createElement('div');
    toast.className = `ui-toast ${zustand.meldung.typ === 'fehler' ? 'ui-toast--error' : ''}`;
    toast.innerHTML = `
      <strong>${zustand.meldung.typ === 'fehler' ? 'Fehler' : 'Info'}</strong>
      <div>${zustand.meldung.text}</div>
    `;
    this.toastStack.append(toast);
  }

  private renderKartenFaecher(
    ebene: Phaser.GameObjects.Container,
    spielerPosition: SpielerPosition,
    offen: boolean,
    sichtbareHandkarten: KarteAntwort[] | undefined,
    anzahl: number,
    spielbareKarten: string[]
  ): void {
    const position = POSITIONEN[spielerPosition];
    const textur = offen ? TEXTUR_KARTE_OFFEN : TEXTUR_KARTE_VERDECKT;
    const kartenAnzahl = sichtbareHandkarten?.length ?? anzahl;

    for (let index = 0; index < kartenAnzahl; index += 1) {
      const abstand = spielerPosition === 'SUED' || spielerPosition === 'NORD' ? index * 28 : index * 16;
      const x = (spielerPosition === 'SUED' || spielerPosition === 'NORD') ? position.kartenX + abstand : position.kartenX;
      const y = (spielerPosition === 'SUED' || spielerPosition === 'NORD') ? position.kartenY : position.kartenY + abstand;
      const winkel = spielerPosition === 'SUED'
        ? -12 + index * 3
        : spielerPosition === 'NORD'
          ? 12 - index * 3
          : position.kartenWinkel;
      const karte = sichtbareHandkarten?.[index];
      const istSpielbar = karte ? spielbareKarten.includes(karte.id) : false;
      const bild = this.add.image(x, y, textur)
        .setDisplaySize(82, 124)
        .setAngle(winkel)
        .setAlpha(offen ? (karte && !istSpielbar && spielbareKarten.length > 0 ? 0.6 : 1) : 0.92);
      ebene.add(bild);
      if (offen && karte) {
        ebene.add(this.add.text(x, y, kuerzelFuerKarte(karte), {
          color: istSpielbar || spielbareKarten.length === 0 ? '#14361f' : '#6c757d',
          fontSize: '18px',
          fontStyle: 'bold'
        }).setOrigin(0.5).setAngle(winkel));
      }
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
    this.toastStack = undefined;
  }
}
