import Phaser from 'phaser';
import { TEXTUR_FILZ, registriereBasisTexturen } from '../assets/AssetLoader';
import { appStore } from '../anwendung';
import type { AppZustand } from '../store/AppStore';
import type { TischListenEintragAntwort, TischPresetAntwort } from '../modelle/SpielverwaltungDto';

function escapiereHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Spielverwaltungs-Szene (Start-Screen).
 * Rein Phaser-basiert für maximale Stabilität und "Phaser, Phaser, Phaser" Strategie.
 */
export class SpielverwaltungsSzene extends Phaser.Scene {
  private abmeldenStore?: () => void;
  private uiElemente: Phaser.GameObjects.GameObject[] = [];
  private offeneTischeAufgeklappt = false;
  private offeneTischeListe: HTMLElement | null = null;

  constructor() {
    super('SpielverwaltungsSzene');
  }

  create(): void {
    registriereBasisTexturen(this);

    // Hintergrund
    this.add.tileSprite(640, 360, 1280, 720, TEXTUR_FILZ).setAlpha(0.95);

    // Logo
    this.add.text(640, 120, 'LOCO DOKO', {
      fontFamily: '"Space Grotesk", sans-serif',
      fontSize: '80px',
      color: '#f8f9fa'
    }).setOrigin(0.5).setShadow(3, 3, '#000', 0);

    this.add.text(640, 190, 'Dullen. Füchse. Wahnsinn.', {
      fontFamily: '"Space Grotesk", sans-serif',
      fontSize: '24px',
      color: '#a3c4a8'
    }).setOrigin(0.5);

    this.abmeldenStore = appStore.abonnieren((zustand) => {
      this.renderUi(zustand);
      if (zustand.bereich === 'TISCH' && zustand.aktuellerTisch) {
        this.abmeldenStore?.();
        this.abmeldenStore = undefined;
        this.scene.start('TischSzene');
      }
    });

    // UI initial rendern
    this.renderUi(appStore.snapshot());
  }

  private renderUi(zustand: AppZustand): void {
    const root = document.getElementById('ui-root');
    if (!root) return;

    // Bestehenden Container entfernen oder leeren
    let container = document.querySelector('.spielverwaltung-container') as HTMLElement;
    if (!container) {
      container = document.createElement('div');
      container.className = 'spielverwaltung-container';
      container.setAttribute('data-testid', 'startscreen');
      // Zentrierung via CSS oder inline (hier inline für Schnelligkeit, sollte in CSS)
      container.style.cssText = 'display: flex; flex-direction: column; align-items: center; gap: 20px; margin-top: 240px;';
      root.appendChild(container);
    }
    container.innerHTML = '';

    // 1. Session-Recovery
    const aktiverTischId = zustand.spieler?.aktiverTischId;
    if (aktiverTischId) {
      const btn = document.createElement('button');
      btn.className = 'ui-button'; // Neo-Button Style
      btn.setAttribute('data-testid', 'btn-session-recovery');
      btn.textContent = 'Zurück zum Spiel';
      btn.onclick = () => void appStore.reconnecteTisch(aktiverTischId);
      container.appendChild(btn);
    }

    // 2. Quick Game
    const quickGameBtn = document.createElement('button');
    quickGameBtn.className = 'ui-button ui-button--primary';
    quickGameBtn.setAttribute('data-testid', 'btn-quick-game');
    quickGameBtn.textContent = '▶  Quick Game';
    quickGameBtn.onclick = () => void appStore.erstelleQuickGame();
    container.appendChild(quickGameBtn);

    // 3. Neuen Tisch
    const erstelleTischBtn = document.createElement('button');
    erstelleTischBtn.className = 'ui-button ui-button--secondary';
    erstelleTischBtn.setAttribute('data-testid', 'btn-neuer-tisch');
    erstelleTischBtn.textContent = '+ Neuen Tisch erstellen';
    erstelleTischBtn.onclick = () => this.zeigeErstelleTischModal();
    container.appendChild(erstelleTischBtn);

    // 4. Offene Tische (Toggle)
    const offeneTischeText = this.offeneTischeAufgeklappt ? '⊞  Offene Tische ▲' : '⊞  Offene Tische ▼';
    const offeneTischeBtn = document.createElement('button');
    offeneTischeBtn.className = 'ui-button ui-button--secondary';
    offeneTischeBtn.setAttribute('data-testid', 'btn-offene-tische');
    offeneTischeBtn.textContent = offeneTischeText;
    offeneTischeBtn.onclick = () => {
      this.offeneTischeAufgeklappt = !this.offeneTischeAufgeklappt;
      this.renderUi(appStore.snapshot());
    };
    container.appendChild(offeneTischeBtn);

    if (this.offeneTischeAufgeklappt) {
      this.aktualisiereOffeneTischeListe(zustand.tische, zustand.spieler?.spielerId ?? null, zustand.spieler?.aktiverTischId ?? null);
    } else {
      this.offeneTischeListe?.remove();
      this.offeneTischeListe = null;
    }

    // 5. Abmelden
    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'ui-button ui-button--secondary';
    logoutBtn.setAttribute('data-testid', 'btn-logout');
    logoutBtn.style.marginTop = '20px';
    logoutBtn.style.opacity = '0.7';
    logoutBtn.textContent = '🚪  Abmelden';
    logoutBtn.onclick = () => {
      void appStore.ausloggen().then(() => this.scene.start('LoginSzene'));
    };
    container.appendChild(logoutBtn);
  }

  private zeigeErstelleTischModal(): void {
    const existing = document.getElementById('erstelle-tisch-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'erstelle-tisch-modal';
    modal.className = 'ui-modal-backdrop';
    modal.innerHTML = `
      <div class="ui-modal">
        <h2>Neuen Tisch erstellen</h2>
        <div class="ui-section">
          <label class="ui-hint" for="tisch-name">Name des Tisches</label>
          <input type="text" id="tisch-name" class="ui-input" placeholder="z.B. Gemütliche Runde" maxlength="100">
        </div>
        <div class="ui-section">
          <label class="ui-hint" for="tisch-preset">Regel-Preset</label>
          <select id="tisch-preset" class="ui-input ui-input--select">
            <option value="LADEN" disabled selected>Presets werden geladen...</option>
          </select>
          <p id="preset-beschreibung" class="ui-hint" style="margin-top: 8px;"></p>
        </div>
        <div class="ui-form-row">
          <input type="checkbox" id="tisch-privat">
          <label for="tisch-privat" class="ui-selection">Privater Tisch (nur via Link)</label>
        </div>
        <div class="ui-action-row">
          <button id="btn-abbrechen" class="ui-button ui-button--secondary">Abbrechen</button>
          <button id="btn-erstellen" class="ui-button" disabled>Erstellen</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const nameInput = modal.querySelector('#tisch-name') as HTMLInputElement;
    const presetSelect = modal.querySelector('#tisch-preset') as HTMLSelectElement;
    const descText = modal.querySelector('#preset-beschreibung') as HTMLParagraphElement;
    const createBtn = modal.querySelector('#btn-erstellen') as HTMLButtonElement;
    const cancelBtn = modal.querySelector('#btn-abbrechen') as HTMLButtonElement;
    const privateCheck = modal.querySelector('#tisch-privat') as HTMLInputElement;

    let presets: TischPresetAntwort[] = [];

    appStore.ladePresets().then(p => {
      presets = p;
      presetSelect.innerHTML = p.map(preset => `
        <option value="${preset.name}">${preset.label}</option>
      `).join('');
      if (p.length > 0) {
        presetSelect.value = p[0].name || '';
        descText.textContent = p[0].beschreibung || '';
        createBtn.disabled = false;
      }
    }).catch(() => {
      presetSelect.innerHTML = '<option value="">Fehler beim Laden</option>';
    });

    presetSelect.addEventListener('change', () => {
      const selected = presets.find(p => p.name === presetSelect.value);
      descText.textContent = selected?.beschreibung || '';
    });

    cancelBtn.onclick = () => modal.remove();
    createBtn.onclick = () => {
      const name = nameInput.value.trim();
      if (!name) return;
      void appStore.erstelleTischMitPreset(name, presetSelect.value, privateCheck.checked)
        .then(() => modal.remove());
    };
  }

  private aktualisiereOffeneTischeListe(tische: TischListenEintragAntwort[], _spielerId: string | null, aktiverTischId: string | null): void {
    this.offeneTischeListe?.remove();
    this.offeneTischeListe = null;

    const root = document.getElementById('ui-root');
    if (!root) return;

    const wartendeTische = tische.filter(t => t.status === 'WARTEND');
    const eigeneLaufendeTische = tische.filter(t => t.status === 'IM_SPIEL' && aktiverTischId === t.id);

    const panel = document.createElement('div');
    panel.id = 'offene-tische-panel';
    panel.setAttribute('data-testid', 'offene-tische-panel');
    panel.className = 'ui-panel';
    panel.style.cssText = 'position:absolute;left:50%;bottom:20px;transform:translateX(-50%);width:min(500px,90%);max-height:240px;overflow-y:auto;';

    if (wartendeTische.length === 0 && eigeneLaufendeTische.length === 0) {
      const meldung = document.createElement('p');
      meldung.className = 'ui-panel__muted';
      meldung.setAttribute('data-testid', 'keine-offenen-tische');
      meldung.textContent = 'Keine offenen Tische. Starte ein Quick Game!';
      panel.appendChild(meldung);
    } else {
      if (wartendeTische.length > 0) {
        const ul = document.createElement('ul');
        ul.className = 'ui-list';
        for (const tisch of wartendeTische) {
          ul.appendChild(this.erstelleTischListenEintrag(tisch, 'Beitreten', () => void appStore.betreteTisch(tisch.id)));
        }
        panel.appendChild(ul);
      }
      if (eigeneLaufendeTische.length > 0) {
        const ul = document.createElement('ul');
        ul.className = 'ui-list';
        for (const tisch of eigeneLaufendeTische) {
          ul.appendChild(this.erstelleTischListenEintrag(tisch, 'Zurückkehren', () => appStore.reconnecteTisch(tisch.id), true));
        }
        panel.appendChild(ul);
      }
    }

    root.appendChild(panel);
    this.offeneTischeListe = panel;
  }

  private erstelleTischListenEintrag(
    tisch: TischListenEintragAntwort,
    buttonText: string,
    onClick: () => void,
    hervorgehoben = false
  ): HTMLElement {
    const li = document.createElement('li');
    li.className = 'ui-list-item';
    li.setAttribute('data-testid', `tisch-eintrag-${tisch.id}`);

    const headline = document.createElement('div');
    headline.className = 'ui-list-item__headline';

    const name = document.createElement('span');
    name.textContent = tisch.name;

    const badge = document.createElement('span');
    badge.className = hervorgehoben ? 'ui-badge ui-badge--highlight' : 'ui-badge';
    badge.setAttribute('data-testid', `tisch-spieleranzahl-${tisch.id}`);
    badge.textContent = hervorgehoben ? 'Laufend' : `${tisch.spielerAnzahl}/4`;

    headline.appendChild(name);
    headline.appendChild(badge);

    const btn = document.createElement('button');
    btn.className = hervorgehoben ? 'ui-button ui-button--secondary' : 'ui-button';
    btn.setAttribute('data-testid', `btn-${escapiereHtml(buttonText.toLowerCase().replace(/[äöüß]/g, c => ({ 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' }[c] ?? c)))}-${tisch.id}`);
    btn.textContent = buttonText;
    btn.onclick = onClick;

    li.appendChild(headline);
    li.appendChild(btn);
    return li;
  }

  shutdown(): void {
    this.abmeldenStore?.();
    this.uiElemente.forEach(el => el.destroy());
    this.offeneTischeListe?.remove();
    this.offeneTischeListe = null;
    const marker = document.querySelector('[data-testid="startscreen"]');
    if (marker) marker.remove();
  }
}
