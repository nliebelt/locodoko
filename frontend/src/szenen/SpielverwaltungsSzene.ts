import Phaser from 'phaser';
import { TEXTUR_FILZ, registriereBasisTexturen } from '../assets/AssetLoader';
import { appStore } from '../anwendung';
import type { AppZustand } from '../store/AppStore';
import type { TischListenEintragAntwort, TischPresetAntwort, TischKonfigurationDto } from '../modelle/SpielverwaltungDto';
import { REGEL_PRESETS } from '../modelle/regelPresets';

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

    const boolFelder: Array<[keyof TischKonfigurationDto, string]> = [
      ['ohneNeunen', 'Ohne Neunen (10er-Deck)'],
      ['hochzeitErlaubt', 'Hochzeit erlaubt'],
      ['armutErlaubt', 'Armut erlaubt'],
      ['damensoloErlaubt', 'Damen-Solo erlaubt'],
      ['bubensoloErlaubt', 'Buben-Solo erlaubt'],
      ['fleischlosErlaubt', 'Fleischlos erlaubt'],
      ['trumpfsoloErlaubt', 'Trumpf-Solo erlaubt'],
      ['zweiteDulleSticht', 'Zweite Dulle sticht'],
      ['fuchsGefangenAktiv', 'Fuchs gefangen'],
      ['karlchenAktiv', 'Karlchen'],
      ['doppelkopfAktiv', 'Doppelkopf'],
      ['bockrundenAktiv', 'Bockrunden aktiv'],
      ['schweinchenAktiv', 'Schweinchen aktiv'],
      ['dreissigAugenPflichtAktiv', '30-Augen-Pflichtansage'],
      ['schmeissenAktiv', 'Schmeißen erlaubt'],
      ['herzDurchgegangenNurHoch', 'Herz nur bei reinen Herz-As-Stichen'],
    ];

    const zahlFelder: Array<[keyof TischKonfigurationDto, string, number, number]> = [
      ['mindestkartenReKontra', 'Re / Kontra', 1, 11],
      ['mindestkartenKeine90', 'Keine 90', 1, 11],
      ['mindestkartenKeine60', 'Keine 60', 1, 11],
      ['mindestkartenKeine30', 'Keine 30', 1, 11],
      ['mindestkartenSchwarz', 'Schwarz', 1, 11],
    ];

    const boolHtml = boolFelder.map(([feld, label]) =>
      `<div class="ui-form-row"><input type="checkbox" id="bd-${feld}" data-field="${feld}"><label for="bd-${feld}" class="ui-selection">${label}</label></div>`
    ).join('');

    const zahlHtml = zahlFelder.map(([feld, label, min, max]) =>
      `<div class="ui-form-row" style="gap:8px"><label for="bd-${feld}" class="ui-hint" style="flex:1">${label}</label><input type="number" id="bd-${feld}" data-field="${feld}" class="ui-input" style="width:60px;text-align:center" min="${min}" max="${max}" required></div>`
    ).join('');

    const modal = document.createElement('div');
    modal.id = 'erstelle-tisch-modal';
    modal.className = 'ui-modal-backdrop';
    modal.innerHTML = `
      <div class="ui-modal">
        <h2>Neuen Tisch erstellen</h2>
        <div class="ui-section">
          <label class="ui-hint" for="tisch-name">Name des Tisches</label>
          <input type="text" id="tisch-name" data-testid="input-tischname" class="ui-input" placeholder="z.B. Gemütliche Runde" maxlength="100">
        </div>
        <div class="ui-section">
          <label class="ui-hint" for="tisch-preset">Regel-Preset</label>
          <select id="tisch-preset" class="ui-input ui-input--select">
            <option value="LADEN" disabled selected>Presets werden geladen...</option>
          </select>
          <p id="preset-beschreibung" class="ui-hint" style="margin-top:8px"></p>
        </div>
        <div id="benutzerdefiniert-panel" class="ui-section" style="display:none;max-height:260px;overflow-y:auto;border-top:1px solid rgba(255,255,255,0.15);padding-top:8px">
          <p class="ui-hint" style="font-weight:600;margin-bottom:6px">Regeloptionen</p>
          ${boolHtml}
          <p class="ui-hint" style="font-weight:600;margin-top:10px;margin-bottom:6px">Ansagegrenzen (Karten auf Hand)</p>
          ${zahlHtml}
        </div>
        <div class="ui-form-row">
          <input type="checkbox" id="tisch-privat">
          <label for="tisch-privat" class="ui-selection">Privater Tisch (nur via Link)</label>
        </div>
        <div class="ui-action-row">
          <button id="btn-abbrechen" class="ui-button ui-button--secondary">Abbrechen</button>
          <button id="btn-erstellen" data-testid="btn-tisch-erstellen" class="ui-button" disabled>Erstellen</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.setAttribute('data-testid', 'tisch-config-modal');

    const nameInput = modal.querySelector('#tisch-name') as HTMLInputElement;
    const presetSelect = modal.querySelector('#tisch-preset') as HTMLSelectElement;
    const descText = modal.querySelector('#preset-beschreibung') as HTMLParagraphElement;
    const panel = modal.querySelector('#benutzerdefiniert-panel') as HTMLDivElement;
    const createBtn = modal.querySelector('#btn-erstellen') as HTMLButtonElement;
    const cancelBtn = modal.querySelector('#btn-abbrechen') as HTMLButtonElement;
    const privateCheck = modal.querySelector('#tisch-privat') as HTMLInputElement;

    let presets: TischPresetAntwort[] = [];
    let letztesPreset: TischPresetAntwort | null = null;
    let presetsGeladen = false;

    function aktualisiereErstellenBtn(): void {
      createBtn.disabled = !presetsGeladen || !nameInput.value.trim();
    }

    function setzeFelder(konfiguration: Partial<TischKonfigurationDto>): void {
      panel.querySelectorAll<HTMLInputElement>('input[type="checkbox"][data-field]').forEach(cb => {
        const feld = cb.dataset['field'] as keyof TischKonfigurationDto;
        const wert = konfiguration[feld];
        if (typeof wert === 'boolean') cb.checked = wert;
      });
      panel.querySelectorAll<HTMLInputElement>('input[type="number"][data-field]').forEach(inp => {
        const feld = inp.dataset['field'] as keyof TischKonfigurationDto;
        const wert = konfiguration[feld];
        if (typeof wert === 'number') inp.value = String(wert);
      });
    }

    function leseFelder(): Partial<TischKonfigurationDto> {
      const konfiguration: Partial<TischKonfigurationDto> = {};
      panel.querySelectorAll<HTMLInputElement>('input[type="checkbox"][data-field]').forEach(cb => {
        const feld = cb.dataset['field'] as keyof TischKonfigurationDto;
        Object.assign(konfiguration, { [feld]: cb.checked });
      });
      panel.querySelectorAll<HTMLInputElement>('input[type="number"][data-field]').forEach(inp => {
        const feld = inp.dataset['field'] as keyof TischKonfigurationDto;
        const wert = inp.valueAsNumber;
        if (Number.isFinite(wert) && Number.isInteger(wert)) {
          Object.assign(konfiguration, { [feld]: wert });
        }
      });
      return konfiguration;
    }

    function zeigePreset(preset: TischPresetAntwort | null): void {
      panel.style.display = 'none';
      descText.style.display = '';
      descText.textContent = preset?.beschreibung ?? '';
    }

    function zeigeBenutzerdefiniertPanel(): void {
      descText.style.display = 'none';
      panel.style.display = '';
      const basis: Partial<TischKonfigurationDto> = letztesPreset?.konfiguration ?? REGEL_PRESETS.LOCO_BLAT;
      setzeFelder(basis);
    }

    appStore.ladePresets().then(p => {
      presets = p;
      presetSelect.innerHTML = p.map(preset =>
        `<option value="${preset.name}">${preset.label}</option>`
      ).join('') + '<option value="BENUTZERDEFINIERT">Benutzerdefiniert</option>';
      if (p.length > 0) {
        presetSelect.value = p[0].name ?? '';
        letztesPreset = p[0];
        descText.textContent = p[0].beschreibung ?? '';
      }
      presetsGeladen = true;
      aktualisiereErstellenBtn();
    }).catch(() => {
      presetSelect.innerHTML = '<option value="">Fehler beim Laden</option>';
    });

    presetSelect.addEventListener('change', () => {
      const wert = presetSelect.value;
      if (wert === 'BENUTZERDEFINIERT') {
        zeigeBenutzerdefiniertPanel();
      } else {
        letztesPreset = presets.find(p => p.name === wert) ?? null;
        zeigePreset(letztesPreset);
      }
    });

    nameInput.addEventListener('input', aktualisiereErstellenBtn);

    cancelBtn.onclick = () => modal.remove();
    createBtn.onclick = () => {
      const name = nameInput.value.trim();
      if (!name) return;
      if (presetSelect.value === 'BENUTZERDEFINIERT') {
        const zahlenGueltig = Array.from(
          panel.querySelectorAll<HTMLInputElement>('input[type="number"]')
        ).every(inp => inp.validity.valid);
        if (!zahlenGueltig) return;
        void appStore.erstelleKonfiguriertenTisch(name, leseFelder(), privateCheck.checked)
          .then(() => modal.remove());
      } else {
        void appStore.erstelleTischMitPreset(name, presetSelect.value, privateCheck.checked)
          .then(() => modal.remove());
      }
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
