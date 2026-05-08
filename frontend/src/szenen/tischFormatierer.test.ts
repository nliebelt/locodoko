// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { 
  escapeHtml, 
  kuerzelFuerKarte, 
  formatiereAnsage, 
  formatiereVorbehalt, 
  formatiereSonderpunkt,
  kiSchwierigkeitLabel,
  formatiereEreignisSonderpunktFeedback,
  formatiereCountdownText
} from './tischFormatierer';

describe('tischFormatierer', () => {
  it('escapeHtml maskiert Sonderzeichen', () => {
    expect(escapeHtml('<b>"test"</b>')).toBe('&lt;b&gt;&quot;test&quot;&lt;/b&gt;');
  });

  it('kuerzelFuerKarte liefert kompakte Namen', () => {
    expect(kuerzelFuerKarte({ farbe: 'KREUZ', wert: 'AS', id: 'k1' })).toBe('KA');
    expect(kuerzelFuerKarte({ farbe: 'HERZ', wert: '10', id: 'k2' })).toBe('H10');
    expect(kuerzelFuerKarte({ farbe: 'PIK', wert: 'BUBE', id: 'k3' })).toBe('PB');
    expect(kuerzelFuerKarte({ farbe: 'KARO', wert: 'DAME', id: 'k4' })).toBe('DD');
  });

  it('formatiereAnsage liefert lesbare Texte', () => {
    expect(formatiereAnsage('RE')).toBe('Re');
    expect(formatiereAnsage('KONTRA')).toBe('Kontra');
    expect(formatiereAnsage('KEINE_90')).toBe('Keine 90');
  });

  it('formatiereVorbehalt liefert lesbare Texte', () => {
    expect(formatiereVorbehalt('GESUND')).toBe('Gesund');
    expect(formatiereVorbehalt('SOLO_DAME')).toBe('Damensolo');
    expect(formatiereVorbehalt('SCHMEISSEN_FUENF_NEUNEN')).toBe('Schm. (5 Neunen)');
  });

  it('formatiereSonderpunkt liefert detaillierte Infos', () => {
    const sp = { art: 'FUCHS_GEFANGEN' as const, taeter: 's1', opfer: 's2' };
    const namen = new Map([['s1', 'Nora'], ['s2', 'Bob']]);
    
    expect(formatiereSonderpunkt(sp)).toBe('Fuchs gefangen');
    expect(formatiereSonderpunkt(sp, namen)).toBe('Fuchs gefangen (Nora fängt Bobs Fuchs)');
    
    expect(formatiereSonderpunkt({ art: 'KARLCHEN' as const, taeter: 's1' }, namen)).toBe('Karlchen (Nora)');
  });

  it('kiSchwierigkeitLabel liefert lesbare Labels', () => {
    expect(kiSchwierigkeitLabel('LEICHT')).toBe('Leicht');
    expect(kiSchwierigkeitLabel('STANDARD')).toBe('Standard');
    expect(kiSchwierigkeitLabel('SCHWER')).toBe('Schwer');
  });

  it('formatiereEreignisSonderpunktFeedback liefert Feedback-Texte', () => {
    expect(formatiereEreignisSonderpunktFeedback({ typ: 'DOPPELKOPF', gewinner: 'SUED' })).toBe('Doppelkopf!');
  });

  it('formatiereCountdownText liefert Countdown-Texte', () => {
    expect(formatiereCountdownText(5)).toBe('Neue Partie startet in 5…');
    expect(formatiereCountdownText(0)).toBe('');
    expect(formatiereCountdownText(null)).toBe('');
  });
});
