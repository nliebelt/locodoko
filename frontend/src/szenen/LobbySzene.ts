import Phaser from 'phaser';
import { TEXTUR_FILZ } from '../assets/AssetLoader';
import { appStore } from '../anwendung';
import type { AppZustand } from '../store/AppStore';

function holeUiRoot(): HTMLElement {
  const wurzel = document.getElementById('ui-root');
  if (!wurzel) {
    throw new Error('Die UI-Wurzel #ui-root wurde nicht gefunden.');
  }
  return wurzel;
}

export class LobbySzene extends Phaser.Scene {
  private abmeldenStore?: () => void;

  private panel?: HTMLDivElement;

  private nameInput?: HTMLInputElement;

  private listenContainer?: HTMLUListElement;

  private statusText?: HTMLParagraphElement;

  private spielerText?: Phaser.GameObjects.Text;

  constructor() {
    super('LobbySzene');
  }

  create(): void {
    this.add.tileSprite(640, 360, 1280, 720, TEXTUR_FILZ).setAlpha(0.95);
    this.add.text(640, 90, 'Lobby', {
      color: '#f8f9fa',
      fontSize: '34px',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this.add.text(640, 140, 'Offene Tische in Echtzeit via REST + WebSocket', {
      color: '#d8f3dc',
      fontSize: '18px'
    }).setOrigin(0.5);
    this.spielerText = this.add.text(640, 190, '', {
      color: '#f8f9fa',
      fontSize: '20px'
    }).setOrigin(0.5);

    this.baueUi();
    this.abmeldenStore = appStore.abonnieren((zustand) => {
      this.aktualisiere(zustand);
      if (zustand.bereich === 'TISCH' && zustand.aktuellerTisch) {
        this.scene.start('TischSzene');
      }
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

    const panel = document.createElement('div');
    panel.className = 'ui-panel';
    panel.innerHTML = `
      <h1>Spielverwaltung</h1>
      <p class="ui-panel__muted">Erstelle einen Tisch oder tritt einer vorhandenen Runde bei.</p>
      <div class="ui-form-row">
        <input class="ui-input" type="text" maxlength="100" placeholder="Neuer Tischname" />
        <button class="ui-button" type="button">Tisch erstellen</button>
      </div>
      <div class="ui-action-row">
        <button class="ui-button ui-button--secondary" type="button">Liste aktualisieren</button>
      </div>
      <p class="ui-panel__muted"></p>
      <ul class="ui-list"></ul>
      <p class="ui-hint">Hinweis: Der Dev-Server leitet <code>/api</code> und <code>/ws</code> auf das Spring-Backend weiter.</p>
    `;

    const input = panel.querySelector('input');
    const buttons = panel.querySelectorAll('button');
    const statusText = panel.querySelectorAll('p')[1];
    const liste = panel.querySelector('ul');

    if (!(input instanceof HTMLInputElement) || !(statusText instanceof HTMLParagraphElement) || !(liste instanceof HTMLUListElement)) {
      throw new Error('Lobby-UI konnte nicht aufgebaut werden.');
    }

    const createButton = buttons.item(0);
    const refreshButton = buttons.item(1);
    if (!(createButton instanceof HTMLButtonElement) || !(refreshButton instanceof HTMLButtonElement)) {
      throw new Error('Lobby-Buttons konnten nicht aufgebaut werden.');
    }

    createButton.addEventListener('click', () => {
      void appStore.erstelleTisch(input.value);
      input.select();
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        createButton.click();
      }
    });
    refreshButton.addEventListener('click', () => {
      void appStore.aktualisiereTischliste();
    });

    this.panel = panel;
    this.nameInput = input;
    this.listenContainer = liste;
    this.statusText = statusText;
    uiRoot.append(panel);
  }

  private aktualisiere(zustand: AppZustand): void {
    if (this.spielerText) {
      const spielerName = zustand.spieler?.name ?? 'Unbekannter Spieler';
      this.spielerText.setText(`Aktive Session: ${spielerName}`);
    }

    if (this.statusText) {
      const statusTexte = [
        `${zustand.tische.length} offener Tisch${zustand.tische.length === 1 ? '' : 'e'}`,
        `Verbindung: ${zustand.verbindung}`,
        zustand.wirdGeladen ? 'Aktion wird verarbeitet ...' : 'Bereit'
      ];
      if (zustand.meldung?.typ === 'fehler') {
        statusTexte.push(`Fehler: ${zustand.meldung.text}`);
      }
      this.statusText.textContent = statusTexte.join(' · ');
    }

    if (this.nameInput && !this.nameInput.value) {
      this.nameInput.value = `Tisch von ${zustand.spieler?.name ?? 'mir'}`;
    }

    if (!this.listenContainer) {
      return;
    }

    this.listenContainer.innerHTML = '';
    if (zustand.tische.length === 0) {
      const leer = document.createElement('li');
      leer.className = 'ui-list-item';
      leer.textContent = 'Noch keine offenen Tische. Lege einfach den ersten an.';
      this.listenContainer.append(leer);
      return;
    }

    zustand.tische.forEach((tisch) => {
      const eintrag = document.createElement('li');
      eintrag.className = 'ui-list-item';
      eintrag.innerHTML = `
        <div class="ui-list-item__headline">
          <strong>${tisch.name}</strong>
          <span class="ui-badge">${tisch.status}</span>
        </div>
        <div class="ui-list-item__meta ui-grid">
          <span>${tisch.spielerAnzahl}/4 Spieler</span>
          <span>${tisch.kurzKonfiguration.ohneNeunen ? 'ohne Neunen' : 'mit Neunen'} · ${tisch.kurzKonfiguration.anzahlSpiele} Spiele</span>
        </div>
      `;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ui-button';
      button.disabled = zustand.wirdGeladen || tisch.status !== 'WARTEND';
      button.textContent = tisch.status === 'WARTEND' ? 'Beitreten' : 'Laufend';
      button.addEventListener('click', () => {
        void appStore.betreteTisch(tisch.id);
      });
      eintrag.append(button);
      this.listenContainer?.append(eintrag);
    });
  }

  private aufraeumen(): void {
    this.abmeldenStore?.();
    this.abmeldenStore = undefined;
    if (this.panel?.parentElement) {
      this.panel.parentElement.removeChild(this.panel);
    }
    this.panel = undefined;
  }
}
