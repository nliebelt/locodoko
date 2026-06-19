// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { TischKonfigurationDto, TischPresetAntwort } from '../modelle/SpielverwaltungDto';
import type { AppZustand } from '../store/AppStore';

const mockAppStore = {
  erstelleTischMitPreset: vi.fn(() => Promise.resolve()),
  erstelleKonfiguriertenTisch: vi.fn(() => Promise.resolve()),
};

vi.mock('../anwendung', () => ({
  get appStore() {
    return mockAppStore;
  },
}));

vi.mock('../ui/dialogHelper', () => ({
  installiereDialogA11y: vi.fn(() => vi.fn()),
}));

const { zeigeTischErstellenDialog } = await import('./tischErstellenDialog');

const KONFIG_A: TischKonfigurationDto = {
  ohneNeunen: false,
  anzahlSpiele: 12,
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
  schweinchenAktiv: false,
  dreissigAugenPflichtAktiv: true,
  schmeissenAktiv: false,
  herzDurchgegangenNurHoch: false,
  kiSchwierigkeit: 'STANDARD',
};

const KONFIG_B: TischKonfigurationDto = {
  ...KONFIG_A,
  ohneNeunen: true,
  anzahlSpiele: 24,
  bockrundenAktiv: false,
  kiSchwierigkeit: 'SCHWER',
  tischhintergrund: 'BLAU_GRAFIK',
};

const PRESETS: TischPresetAntwort[] = [
  { name: 'LOCO_BLATT', label: 'Loco Blatt', konfiguration: KONFIG_A },
  { name: 'DKV', label: 'DKV-Turnier', konfiguration: KONFIG_B },
];

const SPIELER_ZUSTAND = { spieler: { name: 'Testnutzer' } } as unknown as AppZustand;

function holeDialog(): HTMLElement | null {
  return document.getElementById('tisch-erstellen-backdrop');
}

function klick(id: string): void {
  document.getElementById(id)?.click();
}

beforeEach(() => {
  vi.clearAllMocks();
  const uiRoot = document.createElement('div');
  uiRoot.id = 'ui-root';
  document.body.appendChild(uiRoot);
});

afterEach(() => {
  document.getElementById('tisch-erstellen-backdrop')?.remove();
  document.getElementById('ui-root')?.remove();
});

describe('zeigeTischErstellenDialog', () => {
  it('rendert Dialog mit Preset-Label und Erweitert-Bereich', () => {
    zeigeTischErstellenDialog(SPIELER_ZUSTAND, PRESETS);

    const backdrop = holeDialog();
    expect(backdrop).not.toBeNull();
    expect(backdrop!.textContent).toContain('Loco Blatt');
    expect(document.getElementById('tisch-erweitert')).not.toBeNull();
  });

  it('öffnet Dialog nicht doppelt (ID-Guard)', () => {
    zeigeTischErstellenDialog(SPIELER_ZUSTAND, PRESETS);
    zeigeTischErstellenDialog(SPIELER_ZUSTAND, PRESETS);

    expect(document.querySelectorAll('#tisch-erstellen-backdrop').length).toBe(1);
  });

  it('Preset-Navigation wechselt Label und setzt Erweitert-Bereich zurück', () => {
    zeigeTischErstellenDialog(SPIELER_ZUSTAND, PRESETS);

    klick('tisch-preset-next');

    const label = document.getElementById('tisch-preset-label')!.textContent?.trim();
    expect(label).toBe('DKV-Turnier');

    const ohneNeunen = document.querySelector<HTMLInputElement>('[data-feld="ohneNeunen"]');
    expect(ohneNeunen?.checked).toBe(true);
  });

  it('Prev-Button springt zirkulär zum letzten Preset', () => {
    zeigeTischErstellenDialog(SPIELER_ZUSTAND, PRESETS);

    klick('tisch-preset-prev');

    const label = document.getElementById('tisch-preset-label')!.textContent?.trim();
    expect(label).toBe('DKV-Turnier');
  });

  it('Abbrechen-Button entfernt den Dialog', () => {
    zeigeTischErstellenDialog(SPIELER_ZUSTAND, PRESETS);

    klick('tisch-abbrechen');

    expect(holeDialog()).toBeNull();
  });

  it('Klick außerhalb schließt den Dialog', () => {
    zeigeTischErstellenDialog(SPIELER_ZUSTAND, PRESETS);
    const backdrop = holeDialog()!;

    backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(holeDialog()).toBeNull();
  });

  it('Anzahl-Spiele ± ändert Anzeige', () => {
    zeigeTischErstellenDialog(SPIELER_ZUSTAND, PRESETS);

    klick('tisch-anzahl-plus');
    expect(document.getElementById('tisch-anzahl-label')!.textContent).toContain('13');

    klick('tisch-anzahl-minus');
    klick('tisch-anzahl-minus');
    expect(document.getElementById('tisch-anzahl-label')!.textContent).toContain('11');
  });

  it('ruft erstelleTischMitPreset auf, wenn keine Regel geändert wurde', async () => {
    zeigeTischErstellenDialog(SPIELER_ZUSTAND, PRESETS);

    klick('tisch-erstellen-btn');

    await vi.waitFor(() => expect(mockAppStore.erstelleTischMitPreset).toHaveBeenCalledOnce());
    expect(mockAppStore.erstelleKonfiguriertenTisch).not.toHaveBeenCalled();
    expect(mockAppStore.erstelleTischMitPreset).toHaveBeenCalledWith(
      expect.any(String),
      'LOCO_BLATT',
      false,
      12,
    );
  });

  it('ruft erstelleKonfiguriertenTisch auf, wenn eine Checkbox geändert wurde', async () => {
    zeigeTischErstellenDialog(SPIELER_ZUSTAND, PRESETS);

    const cb = document.querySelector<HTMLInputElement>('[data-feld="bockrundenAktiv"]')!;
    cb.checked = false;
    cb.dispatchEvent(new Event('change', { bubbles: true }));

    klick('tisch-erstellen-btn');

    await vi.waitFor(() =>
      expect(mockAppStore.erstelleKonfiguriertenTisch).toHaveBeenCalledOnce(),
    );
    expect(mockAppStore.erstelleTischMitPreset).not.toHaveBeenCalled();
    const konfig = (mockAppStore.erstelleKonfiguriertenTisch.mock.calls[0] as unknown[])[1] as TischKonfigurationDto;
    expect(konfig.bockrundenAktiv).toBe(false);
  });

  it('ruft erstelleKonfiguriertenTisch auf, wenn Mindestkarten geändert wurden', async () => {
    zeigeTischErstellenDialog(SPIELER_ZUSTAND, PRESETS);

    const inp = document.querySelector<HTMLInputElement>('[data-feld="mindestkartenReKontra"]')!;
    inp.value = '9';
    inp.dispatchEvent(new Event('change', { bubbles: true }));

    klick('tisch-erstellen-btn');

    await vi.waitFor(() =>
      expect(mockAppStore.erstelleKonfiguriertenTisch).toHaveBeenCalledOnce(),
    );
    const konfig = (mockAppStore.erstelleKonfiguriertenTisch.mock.calls[0] as unknown[])[1] as TischKonfigurationDto;
    expect(konfig.mindestkartenReKontra).toBe(9);
  });

  it('zeigt Fehler wenn Tischname leer ist', () => {
    zeigeTischErstellenDialog(SPIELER_ZUSTAND, PRESETS);

    const nameInput = document.getElementById('tisch-name') as HTMLInputElement;
    nameInput.value = '   ';

    klick('tisch-erstellen-btn');

    expect(document.getElementById('tisch-erstellen-status')!.textContent).not.toBe('');
    expect(mockAppStore.erstelleTischMitPreset).not.toHaveBeenCalled();
  });

  it('zeigt Fehlermeldung wenn erstelleKonfiguriertenTisch wirft', async () => {
    mockAppStore.erstelleTischMitPreset.mockRejectedValueOnce(new Error('Netzwerkfehler'));
    zeigeTischErstellenDialog(SPIELER_ZUSTAND, PRESETS);

    klick('tisch-erstellen-btn');

    await vi.waitFor(() => {
      const text = document.getElementById('tisch-erstellen-status')!.textContent ?? '';
      if (!text.includes('nicht erstellt werden')) throw new Error('Fehlermeldung noch nicht sichtbar');
    });
  });

  it('Erweitert-Bereich zeigt korrekte Startwerte aus Preset', () => {
    zeigeTischErstellenDialog(SPIELER_ZUSTAND, PRESETS);

    const schweinchenCb = document.querySelector<HTMLInputElement>('[data-feld="schweinchenAktiv"]');
    expect(schweinchenCb?.checked).toBe(false);

    const schmeissenCb = document.querySelector<HTMLInputElement>('[data-feld="schmeissenAktiv"]');
    expect(schmeissenCb?.checked).toBe(false);

    const kiSelect = document.getElementById('tisch-ki-schwierigkeit') as HTMLSelectElement;
    expect(kiSelect.value).toBe('STANDARD');
  });

  it('Preset-Wechsel setzt istGeaendert zurück → erstelleTischMitPreset statt konfiguriert', async () => {
    zeigeTischErstellenDialog(SPIELER_ZUSTAND, PRESETS);

    const cb = document.querySelector<HTMLInputElement>('[data-feld="bockrundenAktiv"]')!;
    cb.checked = false;
    cb.dispatchEvent(new Event('change', { bubbles: true }));

    klick('tisch-preset-next');
    klick('tisch-preset-prev');

    klick('tisch-erstellen-btn');

    await vi.waitFor(() => expect(mockAppStore.erstelleTischMitPreset).toHaveBeenCalledOnce());
    expect(mockAppStore.erstelleKonfiguriertenTisch).not.toHaveBeenCalled();
  });
});
