import Phaser from 'phaser';
import { TEXTUR_FILZ } from '../assets/AssetLoader';
import { appStore } from '../anwendung';
import type { AppZustand } from '../store/AppStore';
import type { TischKonfigurationDto, KiSchwierigkeit, Tischhintergrund } from '../modelle/SpielverwaltungDto';

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
    window.addEventListener('keydown', this.handleSceneKeyDown.bind(this));
  }

  shutdown(): void {
    this.aufraeumen();
    // Remove keyboard listener
    window.removeEventListener('keydown', this.handleSceneKeyDown.bind(this));
  }

  destroy(): void {
    this.aufraeumen();
    // Remove keyboard listener (though shutdown should cover this)
    window.removeEventListener('keydown', this.handleSceneKeyDown.bind(this));
  }

  private baueUi(): void {
    const uiRoot = holeUiRoot();
    uiRoot.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'spielverwaltung-container';
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
      recoveryBtn.style.marginBottom = '20px';
      this.uiContainer.append(recoveryBtn);
    }

    // 2. Quick Game
    const quickGameBtn = this.erstelleNeoButton('▶  Quick Game', 'primary', () => {
      void appStore.erstelleQuickGame();
    });
    this.uiContainer.append(quickGameBtn);

    // 3. Neuen Tisch erstellen
    const erstelleTischBtn = this.erstelleNeoButton('+ Neuen Tisch erstellen', 'secondary', () => {
      this.oeffneKonfigurationsModal(zustand);
    });
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
    this.uiContainer.append(listeBtn);

    // 5. Tischliste (wenn offen)
    if (this.tischListeOffen) {
      const listeDiv = this.baueTischliste(zustand);
      this.uiContainer.append(listeDiv);
    }
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
    
    const modal = document.createElement('div');
    modal.className = 'neo-modal';
    modal.innerHTML = `
      <h2>Neuen Tisch erstellen</h2>
      <div class="neo-form-group">
        <label>Tischname</label>
        <input type="text" id="tisch-name" class="neo-input" maxlength="50" value="Tisch von ${zustand.spieler?.name ?? 'mir'}">
      </div>
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
          <option value="FILZ_GRUEN" selected>Grüner Filz</option>
          <option value="HOLZ_DUNKEL">Dunkles Holz</option>
          <option value="BLAU_GRAFIK">Blaue Grafik</option>
        </select>
      </div>
      <div class="neo-form-group neo-form-group--muted">
        <label>Sonderregeln</label>
        <p>Detail-Konfiguration folgt...</p>
      </div>
      <div class="neo-modal-actions">
        <button id="modal-cancel" class="neo-button neo-button--secondary">Abbrechen</button>
        <button id="modal-submit" class="neo-button neo-button--primary">Tisch erstellen</button>
      </div>
    `;

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

      const konfig: Partial<TischKonfigurationDto> = {
        anzahlSpiele: parseInt(rundenSelect.value, 10),
        kiSchwierigkeit: kiSelect.value as KiSchwierigkeit,
        tischhintergrund: hintergrundSelect.value as Tischhintergrund
      };

      void appStore.erstelleKonfiguriertenTisch(nameInput.value, konfig);
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
      
      const info = document.createElement('div');
      info.className = 'neo-list-item-info';
      info.innerHTML = `
        <strong>${escapeHtml(tisch.name)}</strong>
        <span class="neo-badge">${tisch.spielerAnzahl}/4 Spieler · KI: ${tisch.kurzKonfiguration.anzahlSpiele} Spiele</span>
      `;
      item.append(info);

      const actionBtn = document.createElement('button');
      actionBtn.className = 'neo-button neo-button--small';
      if (tisch.id === zustand.spieler?.aktiverTischId) {
        actionBtn.textContent = 'Zurückkehren';
        actionBtn.classList.add('neo-button--primary');
        actionBtn.addEventListener('click', () => appStore.reconnecteTisch(tisch.id));
      } else {
        actionBtn.textContent = 'Beitreten';
        actionBtn.addEventListener('click', () => void appStore.betreteTisch(tisch.id));
        if (tisch.status !== 'WARTEND') {
          actionBtn.disabled = true;
          actionBtn.textContent = 'Voll';
        }
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