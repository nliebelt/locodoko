// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SpielerProfilModal } from './SpielerProfilModal';
import type { SpielerProfilAntwortGenerated } from '../generated/schema-types';

function erstelleTestProfil(ueberschreiben: Partial<SpielerProfilAntwortGenerated> = {}): SpielerProfilAntwortGenerated {
  return {
    spielerId: 'test-id-123',
    anzeigeName: 'TestSpieler',
    avatarFarbe: '#ff5733',
    erstelltAm: '2026-01-01T00:00:00Z',
    statistik: {
      anzahlSpiele: 10,
      anzahlSiege: 6,
      gesamtPunkte: 42,
      fuchsGefangen: 3,
      fuchsVerloren: 1,
      karlchenGespielt: 2,
      doppelkoepfe: 1,
      solosSiege: 2,
      solosNiederlagen: 1
    },
    letztePartien: [],
    ...ueberschreiben
  };
}

describe('SpielerProfilModal', () => {
  let uiRoot: HTMLElement;

  beforeEach(() => {
    uiRoot = document.createElement('div');
    uiRoot.id = 'ui-root';
    document.body.appendChild(uiRoot);
  });

  afterEach(() => {
    uiRoot.remove();
  });

  it('zeigt Spielernamen im Modal an', () => {
    // Spielername muss sichtbar sein, damit Spieler sich identifizieren kann
    const modal = SpielerProfilModal.oeffnenMitDaten(erstelleTestProfil({ anzeigeName: 'KarlchenMax' }));
    expect(uiRoot.innerHTML).toContain('KarlchenMax');
    modal.schliessen();
  });

  it('zeigt Spielstatistiken mit Anzahl Spiele und Siege an', () => {
    // Kern-KPIs müssen für Überblick vorhanden sein
    const modal = SpielerProfilModal.oeffnenMitDaten(erstelleTestProfil());
    expect(uiRoot.innerHTML).toContain('10'); // anzahlSpiele
    expect(uiRoot.innerHTML).toContain('6');  // anzahlSiege
    expect(uiRoot.innerHTML).toContain('42'); // gesamtPunkte
    modal.schliessen();
  });

  it('berechnet Win-Rate korrekt aus Siege/Spiele', () => {
    // Falsche Win-Rate würde Spieler über Leistung täuschen
    const modal = SpielerProfilModal.oeffnenMitDaten(erstelleTestProfil({
      statistik: { anzahlSpiele: 4, anzahlSiege: 1, gesamtPunkte: 10 }
    }));
    expect(uiRoot.innerHTML).toContain('25%');
    modal.schliessen();
  });

  it('zeigt 0% Win-Rate wenn noch keine Spiele gespielt', () => {
    // Division durch 0 darf nicht zu NaN oder Crash führen
    const modal = SpielerProfilModal.oeffnenMitDaten(erstelleTestProfil({
      statistik: { anzahlSpiele: 0, anzahlSiege: 0, gesamtPunkte: 0 }
    }));
    expect(uiRoot.innerHTML).toContain('0%');
    modal.schliessen();
  });

  it('zeigt Sonderpunkte-Bilanz mit Fuchs, Karlchen und Doppelkopf', () => {
    // Sonderpunkte sind spielrelevante Informationen
    const modal = SpielerProfilModal.oeffnenMitDaten(erstelleTestProfil());
    expect(uiRoot.innerHTML).toContain('Fuchs gefangen');
    expect(uiRoot.innerHTML).toContain('Karlchen');
    expect(uiRoot.innerHTML).toContain('Doppelköpfe');
    modal.schliessen();
  });

  it('zeigt Leer-Hinweis wenn keine Statistiken vorhanden', () => {
    // Leerer Zustand muss kommuniziert werden, nicht einfach fehlen
    const modal = SpielerProfilModal.oeffnenMitDaten(erstelleTestProfil({ statistik: undefined }));
    expect(uiRoot.innerHTML).toContain('Noch keine Statistiken vorhanden');
    modal.schliessen();
  });

  it('zeigt Leer-Hinweis wenn noch keine Partien gespielt', () => {
    // Leerer Verlauf darf nicht abstürzen
    const modal = SpielerProfilModal.oeffnenMitDaten(erstelleTestProfil({ letztePartien: [] }));
    expect(uiRoot.innerHTML).toContain('Noch keine Partien gespielt');
    modal.schliessen();
  });

  it('zeigt Partie-Verlauf mit Tischnamen, Punkten und Platzierung', () => {
    // Verlauf ist zentrales Feature des Profils
    const modal = SpielerProfilModal.oeffnenMitDaten(erstelleTestProfil({
      letztePartien: [{
        tischName: 'Gemütliche Runde',
        datum: '2026-05-01T14:00:00Z',
        endPunktestand: 24,
        rangplatz: 1,
        spielanzahl: 12
      }]
    }));
    expect(uiRoot.innerHTML).toContain('Gemütliche Runde');
    expect(uiRoot.innerHTML).toContain('#1');
    expect(uiRoot.innerHTML).toContain('24');
    modal.schliessen();
  });

  it('istOffen gibt true zurück solange Modal im DOM ist', () => {
    // istOffen wird im Test-Setup und für E2E-Quiescence genutzt
    const modal = SpielerProfilModal.oeffnenMitDaten(erstelleTestProfil());
    expect(modal.istOffen()).toBe(true);
    modal.schliessen();
    expect(modal.istOffen()).toBe(false);
  });

  it('Schließen-Button entfernt das Modal aus dem DOM', () => {
    // Benutzer muss Modal schließen können
    SpielerProfilModal.oeffnenMitDaten(erstelleTestProfil());
    const btn = uiRoot.querySelector('.ui-profil-schliessen') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    btn.click();
    expect(uiRoot.querySelector('.ui-modal-backdrop')).toBeNull();
  });

  it('schützt gegen XSS im Spielernamen via escapeHtml', () => {
    // Bösartige Namen dürfen kein JavaScript ausführen
    const modal = SpielerProfilModal.oeffnenMitDaten(erstelleTestProfil({
      anzeigeName: '<script>alert(1)</script>'
    }));
    expect(uiRoot.innerHTML).not.toContain('<script>');
    expect(uiRoot.innerHTML).toContain('&lt;script&gt;');
    modal.schliessen();
  });
});
