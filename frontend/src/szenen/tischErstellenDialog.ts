import type { AppZustand } from '../store/AppStore';
import type {
  TischKonfigurationDto,
  TischPresetAntwort,
  Tischhintergrund,
  KiSchwierigkeit,
} from '../modelle/SpielverwaltungDto';
import { appStore } from '../anwendung';
import { installiereDialogA11y } from '../ui/dialogHelper';

interface FeldInfo {
  feld: string;
  label: string;
}

const TISCHHINTERGRUENDE: { value: Tischhintergrund; label: string }[] = [
  { value: 'FILZ_GRUEN', label: 'Filz Grün' },
  { value: 'BLAU_GRAFIK', label: 'Blau Grafik' },
  { value: 'HOLZ_DUNKEL', label: 'Holz Dunkel' },
  { value: 'RECHTECK_1', label: 'Rechteck 1' },
  { value: 'RECHTECK_2', label: 'Rechteck 2' },
  { value: 'OVAL_1', label: 'Oval 1' },
  { value: 'OVAL_2', label: 'Oval 2' },
  { value: 'RUND_1', label: 'Rund 1' },
];

const KI_SCHWIERIGKEITEN: { value: KiSchwierigkeit; label: string }[] = [
  { value: 'LEICHT', label: 'Leicht' },
  { value: 'STANDARD', label: 'Standard' },
  { value: 'SCHWER', label: 'Schwer' },
];

const STANDARD_KONFIG: TischKonfigurationDto = {
  ohneNeunen: false,
  anzahlSpiele: 24,
  tischhintergrund: 'FILZ_GRUEN',
  hochzeitErlaubt: true,
  armutErlaubt: true,
  damensoloErlaubt: true,
  bubensoloErlaubt: true,
  fleischlosErlaubt: true,
  trumpfsoloErlaubt: true,
  zweiteDulleSticht: true,
  fuchsGefangenAktiv: true,
  karlchenAktiv: true,
  doppelkopfAktiv: true,
  mindestkartenReKontra: 11,
  mindestkartenKeine90: 10,
  mindestkartenKeine60: 9,
  mindestkartenKeine30: 8,
  mindestkartenSchwarz: 7,
  bockrundenAktiv: true,
  schweinchenAktiv: true,
  dreissigAugenPflichtAktiv: true,
  schmeissenAktiv: true,
  herzDurchgegangenNurHoch: false,
  kiSchwierigkeit: 'STANDARD',
};

const BOOLEAN_FELDER_REGELN: FeldInfo[] = [
  { feld: 'ohneNeunen', label: 'Ohne Neunen' },
  { feld: 'zweiteDulleSticht', label: 'Zweite Dulle sticht' },
  { feld: 'herzDurchgegangenNurHoch', label: 'Herz durchg. nur hoch' },
  { feld: 'dreissigAugenPflichtAktiv', label: '30 Augen Pflicht' },
  { feld: 'schmeissenAktiv', label: 'Schmeißen' },
  { feld: 'doppelkopfAktiv', label: 'Doppelkopf' },
  { feld: 'bockrundenAktiv', label: 'Bockrunden' },
];

const BOOLEAN_FELDER_SONDERSPIELE: FeldInfo[] = [
  { feld: 'hochzeitErlaubt', label: 'Hochzeit' },
  { feld: 'armutErlaubt', label: 'Armut' },
  { feld: 'damensoloErlaubt', label: 'Damensolo' },
  { feld: 'bubensoloErlaubt', label: 'Bubensolo' },
  { feld: 'fleischlosErlaubt', label: 'Fleischlos' },
  { feld: 'trumpfsoloErlaubt', label: 'Trumpfsolo' },
  { feld: 'schweinchenAktiv', label: 'Schweinchen' },
  { feld: 'fuchsGefangenAktiv', label: 'Fuchs gefangen' },
  { feld: 'karlchenAktiv', label: 'Karlchen' },
];

const MINDESTKARTEN_FELDER: FeldInfo[] = [
  { feld: 'mindestkartenReKontra', label: 'Re/Kontra' },
  { feld: 'mindestkartenKeine90', label: 'Keine 90' },
  { feld: 'mindestkartenKeine60', label: 'Keine 60' },
  { feld: 'mindestkartenKeine30', label: 'Keine 30' },
  { feld: 'mindestkartenSchwarz', label: 'Schwarz' },
];

const CTRL_STYLE =
  'padding:4px;background:#221530;color:#f0e6ff;border:1px solid #4a2d6a;border-radius:4px;font-size:13px;';

function checkboxGitter(felder: FeldInfo[]): string {
  return (
    `<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;margin-bottom:4px;">` +
    felder
      .map(
        (f) =>
          `<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;color:#f0e6ff;">` +
          `<input type="checkbox" data-feld="${f.feld}" style="cursor:pointer;" />${f.label}</label>`,
      )
      .join('') +
    `</div>`
  );
}

function abschnittHeader(titel: string): string {
  return `<div style="font-size:12px;color:#7a5a9a;margin-top:8px;margin-bottom:4px;font-weight:bold;">${titel}</div>`;
}

function auswahlHTML(id: string, optionen: { value: string; label: string }[]): string {
  return (
    `<select id="${id}" style="${CTRL_STYLE}">` +
    optionen.map((o) => `<option value="${o.value}">${o.label}</option>`).join('') +
    `</select>`
  );
}

function erweitertAbschnittHTML(): string {
  const mindestkarten = MINDESTKARTEN_FELDER.map(
    (f) =>
      `<span style="font-size:13px;color:#f0e6ff;">${f.label}</span>` +
      `<input type="number" data-feld="${f.feld}" min="1" max="12" style="width:60px;${CTRL_STYLE}" />`,
  ).join('');

  return [
    '<details id="tisch-erweitert" style="border:1px solid #4a2d6a;border-radius:4px;padding:4px 10px;">',
    '<summary style="cursor:pointer;color:#b8a8d0;font-size:13px;user-select:none;padding:4px 0;">Erweitert</summary>',
    '<div style="margin-top:8px;">',
    abschnittHeader('Spielregeln'),
    checkboxGitter(BOOLEAN_FELDER_REGELN),
    abschnittHeader('Sonderspiele'),
    checkboxGitter(BOOLEAN_FELDER_SONDERSPIELE),
    abschnittHeader('Mindestkarten für Ansagen'),
    `<div style="display:grid;grid-template-columns:auto 60px;gap:4px 8px;align-items:center;margin-bottom:8px;">${mindestkarten}</div>`,
    '<div style="display:flex;flex-direction:column;gap:6px;margin-top:4px;">',
    `<div style="display:flex;align-items:center;gap:8px;">` +
      `<span style="font-size:13px;color:#7a5a9a;min-width:120px;">KI-Schwierigkeit</span>` +
      auswahlHTML('tisch-ki-schwierigkeit', KI_SCHWIERIGKEITEN) +
      `</div>`,
    `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">` +
      `<span style="font-size:13px;color:#7a5a9a;min-width:120px;">Tischhintergrund</span>` +
      auswahlHTML('tisch-hintergrund', TISCHHINTERGRUENDE) +
      `</div>`,
    '</div>',
    '</div>',
    '</details>',
  ].join('');
}

export function zeigeTischErstellenDialog(
  zustand: AppZustand,
  presets: TischPresetAntwort[],
  startPresetIndex = 0,
): void {
  if (document.getElementById('tisch-erstellen-backdrop')) return;

  let presetIndex = presets.length > 0 ? Math.min(startPresetIndex, presets.length - 1) : 0;

  const standardAnzahlSpiele = (idx: number) => presets[idx]?.konfiguration?.anzahlSpiele ?? 24;
  const presetKonfig = (idx: number): TischKonfigurationDto =>
    presets[idx]?.konfiguration ?? STANDARD_KONFIG;

  let anzahlSpiele = standardAnzahlSpiele(presetIndex);
  let aktuelleKonfig: TischKonfigurationDto = { ...presetKonfig(presetIndex) };
  let istGeaendert = false;

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
    erweitertAbschnittHTML(),
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
  const erweitertEl = modal.querySelector<HTMLDetailsElement>('#tisch-erweitert')!;

  const aktualisiereAnzahlLabel = () => {
    anzahlLabelEl.textContent = `${anzahlSpiele} Spiele`;
  };

  const aktualisiereErweitertBereich = (konfig: TischKonfigurationDto) => {
    const alleBoolean = [...BOOLEAN_FELDER_REGELN, ...BOOLEAN_FELDER_SONDERSPIELE];
    for (const { feld } of alleBoolean) {
      const cb = erweitertEl.querySelector<HTMLInputElement>(`[data-feld="${feld}"]`);
      if (cb) cb.checked = (konfig as unknown as Record<string, unknown>)[feld] as boolean;
    }
    for (const { feld } of MINDESTKARTEN_FELDER) {
      const inp = erweitertEl.querySelector<HTMLInputElement>(`[data-feld="${feld}"]`);
      if (inp) inp.value = String((konfig as unknown as Record<string, unknown>)[feld]);
    }
    const kiSelect = modal.querySelector<HTMLSelectElement>('#tisch-ki-schwierigkeit');
    if (kiSelect) kiSelect.value = konfig.kiSchwierigkeit;
    const hgSelect = modal.querySelector<HTMLSelectElement>('#tisch-hintergrund');
    if (hgSelect) hgSelect.value = konfig.tischhintergrund;
  };

  aktualisiereErweitertBereich(aktuelleKonfig);

  let aufraeuemen: () => void = () => {};
  const schliessen = () => {
    aufraeuemen();
    backdrop.remove();
  };
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) schliessen();
  });
  abbrechenBtn.addEventListener('click', schliessen);

  prevBtn.addEventListener('click', () => {
    if (presets.length === 0) return;
    presetIndex = (presetIndex - 1 + presets.length) % presets.length;
    presetLabelEl.textContent = presets[presetIndex]?.label ?? '';
    anzahlSpiele = standardAnzahlSpiele(presetIndex);
    aktualisiereAnzahlLabel();
    aktuelleKonfig = { ...presetKonfig(presetIndex) };
    istGeaendert = false;
    aktualisiereErweitertBereich(aktuelleKonfig);
  });
  nextBtn.addEventListener('click', () => {
    if (presets.length === 0) return;
    presetIndex = (presetIndex + 1) % presets.length;
    presetLabelEl.textContent = presets[presetIndex]?.label ?? '';
    anzahlSpiele = standardAnzahlSpiele(presetIndex);
    aktualisiereAnzahlLabel();
    aktuelleKonfig = { ...presetKonfig(presetIndex) };
    istGeaendert = false;
    aktualisiereErweitertBereich(aktuelleKonfig);
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

  const setzeCheckbox = (ziel: HTMLInputElement, feld: string) => {
    (aktuelleKonfig as unknown as Record<string, unknown>)[feld] = ziel.checked;
    istGeaendert = true;
  };
  const setzeZahl = (ziel: HTMLInputElement, feld: string) => {
    const wert = parseInt(ziel.value, 10);
    if (!isNaN(wert) && wert >= 1) {
      (aktuelleKonfig as unknown as Record<string, unknown>)[feld] = wert;
      istGeaendert = true;
    }
  };
  const setzeAuswahl = (ziel: HTMLSelectElement) => {
    if (ziel.id === 'tisch-ki-schwierigkeit') {
      aktuelleKonfig = { ...aktuelleKonfig, kiSchwierigkeit: ziel.value as KiSchwierigkeit };
      istGeaendert = true;
    } else if (ziel.id === 'tisch-hintergrund') {
      aktuelleKonfig = { ...aktuelleKonfig, tischhintergrund: ziel.value as Tischhintergrund };
      istGeaendert = true;
    }
  };

  erweitertEl.addEventListener('change', (e) => {
    const ziel = e.target as HTMLElement;
    const feld = (ziel as HTMLInputElement).dataset['feld'];
    if (feld && ziel instanceof HTMLInputElement) {
      if (ziel.type === 'checkbox') setzeCheckbox(ziel, feld);
      else if (ziel.type === 'number') setzeZahl(ziel, feld);
    } else if (!feld && ziel instanceof HTMLSelectElement) {
      setzeAuswahl(ziel);
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

    const versprechen =
      !istGeaendert && preset?.name
        ? appStore.erstelleTischMitPreset(name, preset.name, privat, anzahlSpiele)
        : appStore.erstelleKonfiguriertenTisch(name, { ...aktuelleKonfig, anzahlSpiele }, privat);

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
