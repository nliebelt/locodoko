import type { AppZustand } from '../store/AppStore';
import type { TischPresetAntwort } from '../modelle/SpielverwaltungDto';
import { appStore } from '../anwendung';
import { installiereDialogA11y } from '../ui/dialogHelper';

export function zeigeTischErstellenDialog(
  zustand: AppZustand,
  presets: TischPresetAntwort[],
  startPresetIndex = 0,
): void {
  if (document.getElementById('tisch-erstellen-backdrop')) return;

  let presetIndex = presets.length > 0
    ? Math.min(startPresetIndex, presets.length - 1)
    : 0;

  const standardAnzahlSpiele = (idx: number) =>
    presets[idx]?.konfiguration?.anzahlSpiele ?? 24;

  let anzahlSpiele = standardAnzahlSpiele(presetIndex);

  const backdrop = document.createElement('div');
  backdrop.id = 'tisch-erstellen-backdrop';
  backdrop.className = 'ui-modal-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-labelledby', 'tisch-erstellen-titel');

  const defaultName = 'Tisch ' + (zustand.spieler?.name ?? 'Gast');

  const modal = document.createElement('div');
  modal.className = 'ui-modal';
  modal.style.maxWidth = '480px';

  modal.innerHTML = [
    '<h2 id="tisch-erstellen-titel" style="margin:0;color:#ffd700;font-size:18px;">Neuen Tisch erstellen</h2>',
    '<div>',
    '  <label for="tisch-name" style="display:block;margin-bottom:4px;font-size:13px;color:#7a5a9a;">Tischname</label>',
    `  <input id="tisch-name" type="text" value="${defaultName.replace(/["&<>]/g, (c) => ({ '"': '&quot;', '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)}"`,
    '    style="width:100%;box-sizing:border-box;padding:8px;background:#221530;color:#f0e6ff;',
    '           border:1px solid #4a2d6a;border-radius:4px;font-size:14px;" />',
    '</div>',
    '<div>',
    '  <label style="display:block;margin-bottom:6px;font-size:13px;color:#7a5a9a;">Regel-Preset</label>',
    '  <div style="display:flex;align-items:center;gap:8px;">',
    '    <button id="tisch-preset-prev"',
    '      style="padding:6px 12px;background:#221530;color:#f0e6ff;border:1px solid #4a2d6a;',
    '             border-radius:4px;cursor:pointer;font-size:16px;">&lt;</button>',
    '    <span id="tisch-preset-label"',
    '      style="flex:1;text-align:center;color:#f0e6ff;font-size:14px;min-height:20px;">',
    `      ${presets[presetIndex]?.label ?? 'Lädt…'}`,
    '    </span>',
    '    <button id="tisch-preset-next"',
    '      style="padding:6px 12px;background:#221530;color:#f0e6ff;border:1px solid #4a2d6a;',
    '             border-radius:4px;cursor:pointer;font-size:16px;">&gt;</button>',
    '  </div>',
    '</div>',
    '<div>',
    '  <label style="display:block;margin-bottom:6px;font-size:13px;color:#7a5a9a;">Anzahl Spiele</label>',
    '  <div style="display:flex;align-items:center;gap:8px;">',
    '    <button id="tisch-anzahl-minus"',
    '      style="padding:6px 12px;background:#221530;color:#f0e6ff;border:1px solid #4a2d6a;',
    '             border-radius:4px;cursor:pointer;font-size:16px;">−</button>',
    `    <span id="tisch-anzahl-label"`,
    '      style="flex:1;text-align:center;color:#f0e6ff;font-size:14px;">',
    `      ${anzahlSpiele} Spiele`,
    '    </span>',
    '    <button id="tisch-anzahl-plus"',
    '      style="padding:6px 12px;background:#221530;color:#f0e6ff;border:1px solid #4a2d6a;',
    '             border-radius:4px;cursor:pointer;font-size:16px;">+</button>',
    '  </div>',
    '</div>',
    '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px;color:#f0e6ff;">',
    '  <input id="tisch-privat" type="checkbox" style="width:16px;height:16px;cursor:pointer;" />',
    '  Privater Tisch',
    '</label>',
    '<p id="tisch-erstellen-status" style="margin:0;min-height:20px;font-size:13px;color:#ff4455;"></p>',
    '<div style="display:flex;gap:12px;justify-content:flex-end;">',
    '  <button id="tisch-abbrechen"',
    '    style="padding:8px 16px;background:transparent;color:#b8a8d0;border:1px solid #7a5a9a;',
    '           border-radius:4px;cursor:pointer;">Abbrechen</button>',
    '  <button id="tisch-erstellen-btn"',
    '    style="padding:8px 16px;background:#ffd700;color:#1a1020;border:none;',
    '           border-radius:4px;cursor:pointer;font-weight:bold;">Tisch erstellen</button>',
    '</div>',
  ].join('');

  backdrop.appendChild(modal);
  const uiRoot = document.getElementById('ui-root');
  if (!uiRoot) return;
  uiRoot.appendChild(backdrop);

  const nameInput = modal.querySelector<HTMLInputElement>('#tisch-name')!;
  const presetLabelEl = modal.querySelector<HTMLSpanElement>('#tisch-preset-label')!;
  const anzahlLabelEl = modal.querySelector<HTMLSpanElement>('#tisch-anzahl-label')!;
  const privatCheckbox = modal.querySelector<HTMLInputElement>('#tisch-privat')!;
  const statusEl = modal.querySelector<HTMLParagraphElement>('#tisch-erstellen-status')!;
  const erstellenBtn = modal.querySelector<HTMLButtonElement>('#tisch-erstellen-btn')!;
  const abbrechenBtn = modal.querySelector<HTMLButtonElement>('#tisch-abbrechen')!;
  const prevBtn = modal.querySelector<HTMLButtonElement>('#tisch-preset-prev')!;
  const nextBtn = modal.querySelector<HTMLButtonElement>('#tisch-preset-next')!;
  const minusBtn = modal.querySelector<HTMLButtonElement>('#tisch-anzahl-minus')!;
  const plusBtn = modal.querySelector<HTMLButtonElement>('#tisch-anzahl-plus')!;

  const aktualisiereAnzahlLabel = () => {
    anzahlLabelEl.textContent = `${anzahlSpiele} Spiele`;
  };

  let aufraeuemen: () => void = () => {};
  const schliessen = () => {
    aufraeuemen();
    backdrop.remove();
  };
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) schliessen(); });
  abbrechenBtn.addEventListener('click', schliessen);

  prevBtn.addEventListener('click', () => {
    if (presets.length === 0) return;
    presetIndex = (presetIndex - 1 + presets.length) % presets.length;
    presetLabelEl.textContent = presets[presetIndex]?.label ?? '';
    anzahlSpiele = standardAnzahlSpiele(presetIndex);
    aktualisiereAnzahlLabel();
  });
  nextBtn.addEventListener('click', () => {
    if (presets.length === 0) return;
    presetIndex = (presetIndex + 1) % presets.length;
    presetLabelEl.textContent = presets[presetIndex]?.label ?? '';
    anzahlSpiele = standardAnzahlSpiele(presetIndex);
    aktualisiereAnzahlLabel();
  });

  minusBtn.addEventListener('click', () => {
    if (anzahlSpiele > 1) {
      anzahlSpiele--;
      aktualisiereAnzahlLabel();
    }
  });
  plusBtn.addEventListener('click', () => {
    if (anzahlSpiele < 240) {
      anzahlSpiele++;
      aktualisiereAnzahlLabel();
    }
  });

  erstellenBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (!name) {
      statusEl.textContent = 'Bitte einen Tischnamen eingeben.';
      return;
    }
    statusEl.textContent = '';
    erstellenBtn.disabled = true;

    const preset = presets[presetIndex] ?? null;
    const privat = privatCheckbox.checked;

    const versprechen = preset?.name
      ? appStore.erstelleTischMitPreset(name, preset.name, privat, anzahlSpiele)
      : appStore.erstelleTisch(name);

    versprechen
      .then(() => schliessen())
      .catch(() => {
        statusEl.style.color = '#ff4455';
        statusEl.textContent = 'Tisch konnte nicht erstellt werden. Bitte erneut versuchen.';
        erstellenBtn.disabled = false;
      });
  });

  aufraeuemen = installiereDialogA11y(backdrop, schliessen);
  nameInput.focus();
  nameInput.select();
}
