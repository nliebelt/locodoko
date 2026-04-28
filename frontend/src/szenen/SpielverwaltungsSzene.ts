import Phaser from 'phaser';
import { TEXTUR_FILZ } from '../assets/AssetLoader';
import { appStore } from '../anwendung';
import type { AppZustand } from '../store/AppStore';
import { PhaserButton } from './PhaserButton';
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

    // E2E-Marker fuer Playwright
    this.erstelleE2EMarker('startscreen');
    this.erstelleE2EMarker('btn-neuer-tisch');
    this.erstelleE2EMarker('btn-offene-tische');
    this.erstelleE2EMarker('btn-session-recovery');

    this.renderUi(appStore.snapshot());
  }

  private erstelleE2EMarker(testId: string): void {
    const root = document.getElementById('ui-root');
    if (!root) return;
    let marker = document.querySelector(`[data-testid="${testId}"]`);
    if (!marker) {
      marker = document.createElement('div');
      (marker as HTMLElement).dataset['testid'] = testId;
      (marker as HTMLElement).style.cssText = 'position:absolute;width:1px;height:1px;left:-9999px;top:-9999px;pointer-events:none';
      root.appendChild(marker);
    }
  }

  private renderUi(zustand: AppZustand): void {
    // Alte Elemente entfernen
    this.uiElemente.forEach(el => el.destroy());
    this.uiElemente = [];

    let currentY = 300;
    const spacing = 70;

    // 1. Session-Recovery
    const aktiverTischId = zustand.spieler?.aktiverTischId;
    if (aktiverTischId) {
      const btn = new PhaserButton(this, {
        x: 640, y: currentY,
        text: 'Zurück zum Spiel',
        typ: 'primary',
        callback: () => appStore.reconnecteTisch(aktiverTischId)
      });
      this.uiElemente.push(btn);
      currentY += spacing;

      void appStore.ladeTischName(aktiverTischId).then(() => {
          // Da wir neu rendern, wird der Name beim nächsten Store-Update (oder manuell) gesetzt
          // Für jetzt reicht der generische Text oder wir triggern ein Re-Render
      });
    }

    // 2. Quick Game
    const quickGameBtn = new PhaserButton(this, {
      x: 640, y: currentY,
      text: '▶  Quick Game',
      typ: 'primary',
      callback: () => void appStore.erstelleQuickGame()
    });
    this.uiElemente.push(quickGameBtn);
    currentY += spacing;

    // 3. Neuen Tisch
    const erstelleTischBtn = new PhaserButton(this, {
      x: 640, y: currentY,
      text: '+ Neuen Tisch erstellen',
      typ: 'secondary',
      callback: () => {
        this.zeigeErstelleTischModal();
      }
    });
    this.uiElemente.push(erstelleTischBtn);
    currentY += spacing;

    // 4. Offene Tische (Toggle)
    const offeneTischeText = this.offeneTischeAufgeklappt ? '⊞  Offene Tische ▲' : '⊞  Offene Tische ▼';
    const offeneTischeBtn = new PhaserButton(this, {
      x: 640, y: currentY,
      text: offeneTischeText,
      typ: 'secondary',
      callback: () => {
        this.offeneTischeAufgeklappt = !this.offeneTischeAufgeklappt;
        this.renderUi(appStore.snapshot());
      }
    });
    this.uiElemente.push(offeneTischeBtn);
    currentY += spacing;

    if (this.offeneTischeAufgeklappt) {
      this.aktualisiereOffeneTischeListe(zustand.tische, zustand.spieler?.spielerId ?? null, zustand.spieler?.aktiverTischId ?? null);
    } else {
      this.offeneTischeListe?.remove();
      this.offeneTischeListe = null;
    }

    // 5. Abmelden
    const logoutBtn = new PhaserButton(this, {
      x: 640, y: currentY + 50,
      text: 'Abmelden',
      typ: 'secondary',
      breite: 200,
      callback: () => {
        void appStore.ausloggen().then(() => this.scene.start('LoginSzene'));
      }
    });
    this.uiElemente.push(logoutBtn);
  }

  private zeigeErstelleTischModal(): void {
    const existing = document.getElementById('erstelle-tisch-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'erstelle-tisch-modal';
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-content">
        <h2>Neuen Tisch erstellen</h2>
        <div class="form-group">
          <label for="tisch-name">Name des Tisches</label>
          <input type="text" id="tisch-name" placeholder="z.B. Gemuetliche Runde" maxlength="100">
        </div>
        <div class="form-group">
          <label for="tisch-preset">Regel-Preset</label>
          <select id="tisch-preset">
            <option value="LADEN" disabled selected>Presets werden geladen...</option>
          </select>
          <p id="preset-beschreibung" class="hint-text"></p>
        </div>
        <div class="form-group checkbox-group">
          <input type="checkbox" id="tisch-privat">
          <label for="tisch-privat">Privater Tisch (nur via Link)</label>
        </div>
        <div class="modal-actions">
          <button id="btn-abbrechen" class="btn-secondary">Abbrechen</button>
          <button id="btn-erstellen" class="btn-primary" disabled>Erstellen</button>
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
