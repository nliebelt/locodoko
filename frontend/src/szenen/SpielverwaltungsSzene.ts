import Phaser from 'phaser';
import { TEXTUR_FILZ } from '../assets/AssetLoader';
import { appStore } from '../anwendung';
import type { AppZustand } from '../store/AppStore';
import type { TischKonfigurationDto, KiSchwierigkeit, Tischhintergrund } from '../modelle/SpielverwaltungDto';
import {
  REGEL_PRESETS,
  PRESET_BEZEICHNUNGEN,
  standardMindestkarten,
  type RegelPresetName,
  type RegelFelder,
} from '../modelle/regelPresets';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function holeUiRoot(): HTMLElement {
  const wurzel = document.getElementById('ui-root');
  if (!wurzel) {
    throw new Error('Die UI-Wurzel #ui-root wurde nicht gefunden.');
  }
  return wurzel;
}

/**
 * Spielverwaltungs-Szene (Start-Screen).
 * Ersetzt die bisherige LobbySzene und bietet Quick Game, Tisch-Erstellung und Tisch-Liste.
 */
export class SpielverwaltungsSzene extends Phaser.Scene {
  private abmeldenStore?: () => void;
  private boundHandleSceneKeyDown?: (e: KeyboardEvent) => void;

  private uiContainer?: HTMLDivElement;

  private tischListeOffen = false;

  private pollingInterval?: number;

  constructor() {
    super('SpielverwaltungsSzene');
  }

  create(): void {
    // Hintergrund
    this.add.tileSprite(640, 360, 1280, 720, TEXTUR_FILZ).setAlpha(0.95);

    // Logo & Slogan (Phaser GameObjects für bessere Performance/Skalierung)
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

    this.baueUi();
    this.abmeldenStore = appStore.abonnieren((zustand) => {
      this.aktualisiere(zustand);
      if (zustand.bereich === 'TISCH' && zustand.aktuellerTisch) {
        this.scene.start('TischSzene');
      }
    });
    
    // Add keyboard listener for scene navigation
    this.boundHandleSceneKeyDown = this.handleSceneKeyDown.bind(this);
    window.addEventListener('keydown', this.boundHandleSceneKeyDown);
  }

  shutdown(): void {
    this.aufraeumen();
    if (this.boundHandleSceneKeyDown) {
      window.removeEventListener('keydown', this.boundHandleSceneKeyDown);
      this.boundHandleSceneKeyDown = undefined;
    }
  }

  destroy(): void {
    this.aufraeumen();
    if (this.boundHandleSceneKeyDown) {
      window.removeEventListener('keydown', this.boundHandleSceneKeyDown);
      this.boundHandleSceneKeyDown = undefined;
    }
  }

  private baueUi(): void {
    const uiRoot = holeUiRoot();
    uiRoot.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'spielverwaltung-container';
    container.dataset['testid'] = 'startscreen';
    // Zentrales Layout via CSS (styles.css muss angepasst werden)
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'center';
    container.style.gap = '20px';
    container.style.marginTop = '240px'; // Platz für Logo/Slogan

    this.uiContainer = container;
    uiRoot.append(container);
  }

  private aktualisiere(zustand: AppZustand): void {
    if (!this.uiContainer) {
      return;
    }

    this.uiContainer.innerHTML = '';

    // 1. Session-Recovery
    const aktiverTischId = zustand.spieler?.aktiverTischId;
    if (aktiverTischId) {
      const recoveryBtn = this.erstelleNeoButton(`↩ Zurück zu Spiel`, 'primary', () => {
        appStore.reconnecteTisch(aktiverTischId);
      });
      recoveryBtn.dataset['testid'] = 'btn-session-recovery';
      recoveryBtn.style.marginBottom = '20px';
      this.uiContainer.append(recoveryBtn);
      // Tischname asynchron nachladen und Button-Text aktualisieren
      void appStore.ladeTischName(aktiverTischId).then((name) => {
        recoveryBtn.textContent = `↩ Zurück zu ${name}`;
      }).catch(() => { /* Fallback: generischer Text bleibt */ });
    }

    // 2. Quick Game
    const quickGameBtn = this.erstelleNeoButton('▶  Quick Game', 'primary', () => {
      void appStore.erstelleQuickGame();
    });
    quickGameBtn.dataset['testid'] = 'btn-quick-game';
    this.uiContainer.append(quickGameBtn);

    // 3. Neuen Tisch erstellen
    const erstelleTischBtn = this.erstelleNeoButton('+ Neuen Tisch erstellen', 'secondary', () => {
      this.oeffneKonfigurationsModal(zustand);
    });
    erstelleTischBtn.dataset['testid'] = 'btn-neuer-tisch';
    this.uiContainer.append(erstelleTischBtn);

    // 4. Offene Tische
    const listeBtn = this.erstelleNeoButton(
      this.tischListeOffen ? '⊟  Tischliste schließen' : '⊞  Offene Tische',
      'secondary',
      () => {
        this.tischListeOffen = !this.tischListeOffen;
        if (this.tischListeOffen) {
          void appStore.aktualisiereTischliste();
          this.startePolling();
        } else {
          this.stoppePolling();
        }
        this.aktualisiere(appStore.snapshot());
      }
    );
    listeBtn.dataset['testid'] = 'btn-offene-tische';
    this.uiContainer.append(listeBtn);

    // 5. Tischliste (wenn offen)
    if (this.tischListeOffen) {
      const listeDiv = this.baueTischliste(zustand);
      this.uiContainer.append(listeDiv);
    }

    // 6. Logout-Button
    const logoutBtn = this.erstelleNeoButton('🚪  Abmelden', 'secondary', () => {
      void appStore.ausloggen().then(() => {
        this.scene.start('LoginSzene');
      });
    });
    logoutBtn.dataset['testid'] = 'btn-logout';
    logoutBtn.style.marginTop = '20px';
    logoutBtn.style.opacity = '0.7';
    this.uiContainer.append(logoutBtn);
  }

  private erstelleNeoButton(text: string, typ: 'primary' | 'secondary', onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = `neo-button neo-button--${typ}`;
    btn.textContent = text;
    btn.type = 'button';
    btn.addEventListener('click', onClick);
    return btn;
  }

  private oeffneKonfigurationsModal(zustand: AppZustand): void {
    const uiRoot = holeUiRoot();
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.dataset['testid'] = 'tisch-config-modal';

    const modal = document.createElement('div');
    modal.className = 'neo-modal';
    modal.innerHTML = `
      <h2>Neuen Tisch erstellen</h2>
      <div class="neo-form-group">
        <label>Tischname</label>
        <input type="text" id="tisch-name" class="neo-input" maxlength="50" value="Tisch von ${escapeHtml(zustand.spieler?.name ?? 'mir')}" data-testid="input-tischname">
      </div>
      <div class="neo-form-group">
        <label>Regelkatalog</label>
        <select id="regel-preset" class="neo-select">
          <option value="LOCO_BLAT" selected>${PRESET_BEZEICHNUNGEN.LOCO_BLAT}</option>
          <option value="DKV">${PRESET_BEZEICHNUNGEN.DKV}</option>
          <option value="BENUTZERDEFINIERT">${PRESET_BEZEICHNUNGEN.BENUTZERDEFINIERT}</option>
        </select>
      </div>
      <div id="regel-details-container"></div>
      <div class="neo-form-group">
        <label>Rundenanzahl</label>
        <select id="runden-anzahl" class="neo-select">
          <option value="12">12 Spiele</option>
          <option value="24" selected>24 Spiele</option>
          <option value="36">36 Spiele</option>
          <option value="48">48 Spiele</option>
        </select>
      </div>
      <div class="neo-form-group">
        <label>KI-Schwierigkeit</label>
        <select id="ki-schwierigkeit" class="neo-select">
          <option value="LEICHT">Leicht</option>
          <option value="STANDARD" selected>Standard</option>
          <option value="SCHWER">Schwer</option>
        </select>
      </div>
      <div class="neo-form-group">
        <label>Tischhintergrund</label>
        <select id="tisch-hintergrund" class="neo-select">
          <option value="FILZ_GRUEN">Grüner Filz</option>
          <option value="HOLZ_DUNKEL">Dunkles Holz</option>
          <option value="BLAU_GRAFIK">Blaue Grafik</option>
          <option value="RECHTECK_1">Rechteck 1</option>
          <option value="RECHTECK_2">Rechteck 2</option>
          <option value="OVAL_1">Oval 1</option>
          <option value="OVAL_2" selected>Oval 2</option>
          <option value="RUND_1">Rund 1</option>
        </select>
      </div>
      <div class="neo-form-group">
        <label class="neo-checkbox-label" style="display:flex;align-items:center;gap:8px;cursor:pointer;">
          <input type="checkbox" id="tisch-privat" data-testid="checkbox-privat">
          Privater Tisch (nur per Einladungslink betretbar)
        </label>
      </div>
      <div class="neo-modal-actions">
        <button id="modal-cancel" class="neo-button neo-button--secondary">Abbrechen</button>
        <button id="modal-submit" class="neo-button neo-button--primary" data-testid="btn-tisch-erstellen">Tisch erstellen</button>
      </div>
    `;

    const regelFelder: Array<{ feld: keyof RegelFelder; label: string }> = [
      { feld: 'bockrundenAktiv', label: 'Bockrunden' },
      { feld: 'schweinchenAktiv', label: 'Schweinchen' },
      { feld: 'dreissigAugenPflichtAktiv', label: '30-Augen-Pflicht' },
      { feld: 'schmeissenAktiv', label: 'Schmeißen (5 Könige)' },
      { feld: 'fuchsGefangenAktiv', label: 'Fuchs gefangen' },
      { feld: 'karlchenAktiv', label: 'Karlchen' },
      { feld: 'doppelkopfAktiv', label: 'Doppelkopf' },
      { feld: 'hochzeitErlaubt', label: 'Hochzeit' },
      { feld: 'armutErlaubt', label: 'Armut' },
      { feld: 'damensoloErlaubt', label: 'Damen-Solo' },
      { feld: 'bubensoloErlaubt', label: 'Buben-Solo' },
      { feld: 'trumpfsoloErlaubt', label: 'Trumpf-Solo' },
      { feld: 'fleischlosErlaubt', label: 'Fleischlos' },
      { feld: 'zweiteDulleSticht', label: 'Zweite Dulle sticht' },
      { feld: 'ohneNeunen', label: 'Ohne Neunen' },
    ];

    const aktualisiereRegelDetails = (presetName: RegelPresetName): void => {
      const container = modal.querySelector('#regel-details-container') as HTMLDivElement;
      container.innerHTML = '';
      const isCustom = presetName === 'BENUTZERDEFINIERT';
      const werte: RegelFelder = isCustom
        ? { ...REGEL_PRESETS.LOCO_BLAT }
        : REGEL_PRESETS[presetName as Exclude<RegelPresetName, 'BENUTZERDEFINIERT'>];

      const gruppe = document.createElement('div');
      gruppe.className = 'neo-form-group';
      const labelEl = document.createElement('label');
      labelEl.textContent = 'Sonderregeln';
      gruppe.appendChild(labelEl);

      const grid = document.createElement('div');
      grid.className = 'neo-checkbox-grid';
      grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;margin-top:6px;';

      regelFelder.forEach(({ feld, label }) => {
        const checkLabel = document.createElement('label');
        checkLabel.className = 'neo-checkbox-label';
        checkLabel.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:13px;cursor:' + (isCustom ? 'pointer' : 'default');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `regel-${feld}`;
        checkbox.name = feld;
        checkbox.checked = werte[feld] as boolean;
        checkbox.disabled = !isCustom;

        checkLabel.appendChild(checkbox);
        checkLabel.appendChild(document.createTextNode(label));
        grid.appendChild(checkLabel);
      });

      gruppe.appendChild(grid);
      container.appendChild(gruppe);
    };

    const leseRegelKonfig = (presetName: RegelPresetName): RegelFelder => {
      if (presetName !== 'BENUTZERDEFINIERT') {
        return REGEL_PRESETS[presetName as Exclude<RegelPresetName, 'BENUTZERDEFINIERT'>];
      }
      const ohneNeunenCb = modal.querySelector('#regel-ohneNeunen') as HTMLInputElement | null;
      const ohneNeunen = ohneNeunenCb?.checked ?? false;
      const boolFelder = Object.fromEntries(
        regelFelder.map(({ feld }) => {
          const cb = modal.querySelector(`#regel-${feld}`) as HTMLInputElement | null;
          return [feld, cb?.checked ?? false];
        })
      ) as Record<keyof RegelFelder, boolean>;
      return { ...boolFelder, ...standardMindestkarten(ohneNeunen) };
    };

    const presetSelect = modal.querySelector('#regel-preset') as HTMLSelectElement;
    aktualisiereRegelDetails('LOCO_BLAT');

    presetSelect.addEventListener('change', () => {
      aktualisiereRegelDetails(presetSelect.value as RegelPresetName);
    });

    const schliesseModal = (): void => {
      backdrop.remove();
    };

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        schliesseModal();
      }
    });

    modal.querySelector('#modal-cancel')?.addEventListener('click', schliesseModal);
    modal.querySelector('#modal-submit')?.addEventListener('click', () => {
      const nameInput = modal.querySelector('#tisch-name') as HTMLInputElement;
      const rundenSelect = modal.querySelector('#runden-anzahl') as HTMLSelectElement;
      const kiSelect = modal.querySelector('#ki-schwierigkeit') as HTMLSelectElement;
      const hintergrundSelect = modal.querySelector('#tisch-hintergrund') as HTMLSelectElement;
      const privatCheckbox = modal.querySelector('#tisch-privat') as HTMLInputElement;

      const regelKonfig = leseRegelKonfig(presetSelect.value as RegelPresetName);
      const konfig: Partial<TischKonfigurationDto> = {
        ...regelKonfig,
        anzahlSpiele: parseInt(rundenSelect.value, 10),
        kiSchwierigkeit: kiSelect.value as KiSchwierigkeit,
        tischhintergrund: hintergrundSelect.value as Tischhintergrund,
      };

      void appStore.erstelleKonfiguriertenTisch(nameInput.value, konfig, privatCheckbox.checked);
      schliesseModal();
    });

    // Keyboard Support für Modal
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        schliesseModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown, { once: true });

    backdrop.append(modal);
    uiRoot.append(backdrop);

    // Focus auf Name-Input
    setTimeout(() => (modal.querySelector('#tisch-name') as HTMLInputElement)?.focus(), 50);
  }

  private baueTischliste(zustand: AppZustand): HTMLDivElement {
    const div = document.createElement('div');
    div.className = 'tischliste-container';
    div.style.width = '600px';
    div.style.marginTop = '20px';

    if (zustand.tische.length === 0) {
      div.innerHTML = '<p class="neo-text--muted" style="text-align: center;">Keine offenen Tische. Starte ein Quick Game!</p>';
      return div;
    }

    const liste = document.createElement('ul');
    liste.className = 'neo-list';

    // Filtern: WARTEND oder eigene IM_SPIEL Tische
    const sichtbareTische = zustand.tische.filter(t => 
      t.status === 'WARTEND' || (t.status === 'IM_SPIEL' && t.id === zustand.spieler?.aktiverTischId)
    );

    sichtbareTische.forEach(tisch => {
      const item = document.createElement('li');
      item.className = 'neo-list-item';
      item.dataset['testid'] = 'tischliste-eintrag';

      const info = document.createElement('div');
      info.className = 'neo-list-item-info';
      const statusLabel = tisch.status === 'WARTEND' ? 'Wartend' : 'Im Spiel';
      const konfigLabel = `${tisch.kurzKonfiguration.anzahlSpiele} Spiele · ${tisch.kurzKonfiguration.ohneNeunen ? 'Ohne Neunen' : 'Mit Neunen'}`;
      info.innerHTML = `
        <strong>${escapeHtml(tisch.name)}</strong>
        <span class="neo-badge">${tisch.spielerAnzahl}/4 Spieler · ${escapeHtml(statusLabel)} · ${escapeHtml(konfigLabel)}</span>
      `;
      item.append(info);

      const actionBtn = document.createElement('button');
      actionBtn.className = 'neo-button neo-button--small';
      if (tisch.id === zustand.spieler?.aktiverTischId) {
        actionBtn.textContent = 'Zurückkehren';
        actionBtn.classList.add('neo-button--primary');
        actionBtn.dataset['testid'] = 'btn-tisch-zurueckkehren';
        actionBtn.addEventListener('click', () => appStore.reconnecteTisch(tisch.id));
      } else if (tisch.status === 'WARTEND') {
        actionBtn.textContent = 'Beitreten';
        actionBtn.dataset['testid'] = 'btn-tisch-beitreten';
        actionBtn.addEventListener('click', () => void appStore.betreteTisch(tisch.id));
      } else {
        actionBtn.textContent = 'Voll';
        actionBtn.disabled = true;
        actionBtn.dataset['testid'] = 'btn-tisch-voll';
      }
      item.append(actionBtn);
      liste.append(item);
    });

    div.append(liste);
    return div;
  }

  private startePolling(): void {
    this.stoppePolling();
    this.pollingInterval = window.setInterval(() => {
      void appStore.aktualisiereTischliste();
    }, 5000);
  }

  private stoppePolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }
  }

  private aufraeumen(): void {
    this.stoppePolling();
    this.abmeldenStore?.();
    this.abmeldenStore = undefined;
    const uiRoot = holeUiRoot();
    uiRoot.innerHTML = '';
    this.uiContainer = undefined;
  }

  // New methods for keyboard navigation
  private handleSceneKeyDown(e: KeyboardEvent): void {
    const focusableElements = this.getFocusableUiElements();
    if (!focusableElements.length) {
      return; // No interactive elements found
    }

    const currentIndex = focusableElements.findIndex(el => el === document.activeElement);

    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault(); // Prevent default scrolling
      const nextIndex = (currentIndex + 1) % focusableElements.length;
      focusableElements[nextIndex].focus();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault(); // Prevent default scrolling
      const prevIndex = (currentIndex - 1 + focusableElements.length) % focusableElements.length;
      focusableElements[prevIndex].focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const currentElement = focusableElements[currentIndex];
      if (currentElement instanceof HTMLButtonElement) {
        currentElement.click();
      }
    } else if (e.key === 'Escape') {
      // If modal is open, Escape is handled there. Otherwise, close table list.
      if (this.tischListeOffen) {
        this.tischListeOffen = false;
        this.stoppePolling();
        this.aktualisiere(appStore.snapshot());
      }
    }
  }

  private getFocusableUiElements(): HTMLElement[] {
    if (!this.uiContainer) {
      return [];
    }
    // Return interactive elements within the uiContainer
    const elements = Array.from(this.uiContainer.querySelectorAll<HTMLElement>('button, input, select'));
    return elements.filter(el => !(el as HTMLButtonElement | HTMLInputElement | HTMLSelectElement).disabled && el.tabIndex !== -1);
  }
}