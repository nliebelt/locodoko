// @vitest-environment node
/**
 * Tests fuer die Regel-Preset-Definitionen.
 *
 * Wichtig: Diese Tests sichern ab dass Preset-Werte (LOCO_BLAT, DKV) exakt den
 * Backend-Spielregeln entsprechen. Eine Abweichung wuerde dazu fuehren, dass
 * Spieler ein Preset auswaehlen, aber andere Regeln als erwartet erhalten.
 * Kein jsdom noetig — reine Datenlogik.
 */
import { describe, it, expect } from 'vitest';
import { REGEL_PRESETS, PRESET_BEZEICHNUNGEN, standardMindestkarten } from './regelPresets';

describe('LOCO_BLAT-Preset', () => {
  const preset = REGEL_PRESETS.LOCO_BLAT;

  it('spielt mit Neunen (12-Karten-Spiel)', () => {
    expect(preset.ohneNeunen).toBe(false);
  });

  it('aktiviert alle Sonderregeln', () => {
    expect(preset.bockrundenAktiv).toBe(true);
    expect(preset.schweinchenAktiv).toBe(true);
    expect(preset.dreissigAugenPflichtAktiv).toBe(true);
    expect(preset.schmeissenAktiv).toBe(true);
    expect(preset.fuchsGefangenAktiv).toBe(true);
    expect(preset.karlchenAktiv).toBe(true);
    expect(preset.doppelkopfAktiv).toBe(true);
  });

  it('aktiviert alle Vorbehalts-Varianten', () => {
    expect(preset.hochzeitErlaubt).toBe(true);
    expect(preset.armutErlaubt).toBe(true);
    expect(preset.damensoloErlaubt).toBe(true);
    expect(preset.bubensoloErlaubt).toBe(true);
    expect(preset.trumpfsoloErlaubt).toBe(true);
    expect(preset.fleischlosErlaubt).toBe(true);
    expect(preset.zweiteDulleSticht).toBe(true);
  });

  it('hat korrekte Ansagegrenzen fuer Mit-Neunen-Spiel (11/10/9/8/7)', () => {
    expect(preset.mindestkartenReKontra).toBe(11);
    expect(preset.mindestkartenKeine90).toBe(10);
    expect(preset.mindestkartenKeine60).toBe(9);
    expect(preset.mindestkartenKeine30).toBe(8);
    expect(preset.mindestkartenSchwarz).toBe(7);
  });
});

describe('OHNE_NEUNEN-Preset', () => {
    const preset = REGEL_PRESETS.OHNE_NEUNEN;
  
    it('aktiviert ohneNeunen (10-Karten-Spiel)', () => {
      expect(preset.ohneNeunen).toBe(true);
    });
  
    it('aktiviert alle Loco-Sonderregeln', () => {
      expect(preset.bockrundenAktiv).toBe(true);
      expect(preset.schweinchenAktiv).toBe(true);
      expect(preset.dreissigAugenPflichtAktiv).toBe(true);
      expect(preset.schmeissenAktiv).toBe(true);
    });
  
    it('hat korrekte Ansagegrenzen fuer Ohne-Neunen-Spiel (9/8/7/6/5)', () => {
      expect(preset.mindestkartenReKontra).toBe(9);
      expect(preset.mindestkartenKeine90).toBe(8);
      expect(preset.mindestkartenKeine60).toBe(7);
      expect(preset.mindestkartenKeine30).toBe(6);
      expect(preset.mindestkartenSchwarz).toBe(5);
    });
});

describe('DKV-Preset', () => {
  const preset = REGEL_PRESETS.DKV;

  it('spielt mit Neunen (12-Karten-Spiel)', () => {
    expect(preset.ohneNeunen).toBe(false);
  });

  it('deaktiviert Loco-Sonderregeln (Bockrunden, Schweinchen, 30-Augen-Pflicht, Schmeißen)', () => {
    expect(preset.bockrundenAktiv).toBe(false);
    expect(preset.schweinchenAktiv).toBe(false);
    expect(preset.dreissigAugenPflichtAktiv).toBe(false);
    expect(preset.schmeissenAktiv).toBe(false);
  });

  it('behaelt DKV-konforme Sonderpunkte bei', () => {
    expect(preset.fuchsGefangenAktiv).toBe(true);
    expect(preset.karlchenAktiv).toBe(true);
    expect(preset.doppelkopfAktiv).toBe(true);
  });

  it('hat korrekte Ansagegrenzen fuer Mit-Neunen-Spiel (11/10/9/8/7)', () => {
    expect(preset.mindestkartenReKontra).toBe(11);
    expect(preset.mindestkartenKeine90).toBe(10);
    expect(preset.mindestkartenKeine60).toBe(9);
    expect(preset.mindestkartenKeine30).toBe(8);
    expect(preset.mindestkartenSchwarz).toBe(7);
  });
});

describe('standardMindestkarten()', () => {
  it('gibt Ohne-Neunen-Grenzen (9-5) bei ohneNeunen=true zurueck', () => {
    const m = standardMindestkarten(true);
    expect(m.mindestkartenReKontra).toBe(9);
    expect(m.mindestkartenSchwarz).toBe(5);
  });

  it('gibt Mit-Neunen-Grenzen (11-7) bei ohneNeunen=false zurueck', () => {
    const m = standardMindestkarten(false);
    expect(m.mindestkartenReKontra).toBe(11);
    expect(m.mindestkartenSchwarz).toBe(7);
  });
});

describe('PRESET_BEZEICHNUNGEN', () => {
  it('enthaelt lesbare Labels fuer alle Presets', () => {
    expect(PRESET_BEZEICHNUNGEN.LOCO_BLAT).toBe('Loco Blatt');
    expect(PRESET_BEZEICHNUNGEN.OHNE_NEUNEN).toBe('Ohne Neunen');
    expect(PRESET_BEZEICHNUNGEN.DKV).toBe('DKV-Turnier');
    expect(PRESET_BEZEICHNUNGEN.BENUTZERDEFINIERT).toBe('Benutzerdefiniert');
  });
});
