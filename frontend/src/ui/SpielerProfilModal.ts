import type { SpielerProfilAntwortGenerated, StatistikAntwortGenerated, PartieErgebnisAntwortGenerated } from '../generated/schema-types';

/**
 * HTML-basiertes Modal für die Anzeige des Spieler-Profils mit Statistiken und Partie-Verlauf.
 * Wird in das #ui-root-Element eingehängt und nutzt die .ui-modal-backdrop / .ui-modal CSS-Klassen.
 */
export class SpielerProfilModal {
  private readonly element: HTMLElement;

  private constructor(element: HTMLElement) {
    this.element = element;
  }

  /**
   * Öffnet das Profil-Modal mit den übergebenen Daten.
   * Hängt das Modal in #ui-root ein.
   */
  static oeffnenMitDaten(profil: SpielerProfilAntwortGenerated): SpielerProfilModal {
    const backdrop = SpielerProfilModal.erstelleElement(profil);
    const uiRoot = document.getElementById('ui-root');
    if (!uiRoot) throw new Error('#ui-root nicht gefunden');
    uiRoot.appendChild(backdrop);
    return new SpielerProfilModal(backdrop);
  }

  /** Schließt das Modal und entfernt es aus dem DOM. */
  schliessen(): void {
    this.element.remove();
  }

  /** Gibt true zurück, wenn das Modal noch im DOM eingehängt ist. */
  istOffen(): boolean {
    return document.body.contains(this.element);
  }

  private static erstelleElement(profil: SpielerProfilAntwortGenerated): HTMLElement {
    const backdrop = document.createElement('div');
    backdrop.className = 'ui-modal-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-label', 'Spieler-Profil');

    const modal = document.createElement('div');
    modal.className = 'ui-modal ui-modal--profil';
    modal.innerHTML = SpielerProfilModal.erstelleInhalt(profil);
    backdrop.appendChild(modal);

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) backdrop.remove();
    });
    modal.querySelector('.ui-profil-schliessen')?.addEventListener('click', () => backdrop.remove());

    return backdrop;
  }

  private static erstelleInhalt(profil: SpielerProfilAntwortGenerated): string {
    const name = profil.anzeigeName ?? 'Unbekannt';
    const farbe = profil.avatarFarbe ?? '#4ade80';
    const datum = profil.erstelltAm
      ? new Date(profil.erstelltAm).toLocaleDateString('de-DE')
      : '—';

    return `
      <div class="ui-profil-header">
        <div class="ui-profil-avatar" style="background-color: ${farbe}"></div>
        <div class="ui-profil-header-info">
          <h2>${SpielerProfilModal.escapeHtml(name)}</h2>
          <span class="ui-profil-meta">Dabei seit ${datum}</span>
        </div>
        <button class="ui-profil-schliessen" aria-label="Profil schließen">✕</button>
      </div>
      ${profil.statistik
        ? SpielerProfilModal.erstelleStatistikAbschnitt(profil.statistik)
        : '<p class="ui-profil-leer">Noch keine Statistiken vorhanden.</p>'}
      ${SpielerProfilModal.erstellePartieVerlauf(profil.letztePartien ?? [])}
    `;
  }

  private static erstelleStatistikAbschnitt(statistik: StatistikAntwortGenerated): string {
    const anzahl = statistik.anzahlSpiele ?? 0;
    const siege = statistik.anzahlSiege ?? 0;
    const winRate = anzahl > 0 ? Math.round((siege / anzahl) * 100) : 0;

    return `
      <section class="ui-profil-abschnitt">
        <h3 class="ui-profil-abschnitt-titel">Statistiken</h3>
        <div class="ui-profil-karten">
          <div class="ui-profil-karte">${anzahl}<span>Spiele</span></div>
          <div class="ui-profil-karte">${siege}<span>Siege</span></div>
          <div class="ui-profil-karte ui-profil-karte--akzent">${winRate}%<span>Win-Rate</span></div>
          <div class="ui-profil-karte">${statistik.gesamtPunkte ?? 0}<span>Punkte</span></div>
        </div>
      </section>
      <section class="ui-profil-abschnitt">
        <h3 class="ui-profil-abschnitt-titel">Sonderpunkte</h3>
        <div class="ui-profil-karten">
          <div class="ui-profil-karte ui-profil-karte--positiv">+${statistik.fuchsGefangen ?? 0}<span>Fuchs gefangen</span></div>
          <div class="ui-profil-karte ui-profil-karte--negativ">-${statistik.fuchsVerloren ?? 0}<span>Fuchs verloren</span></div>
          <div class="ui-profil-karte">${statistik.karlchenGespielt ?? 0}<span>Karlchen</span></div>
          <div class="ui-profil-karte">${statistik.doppelkoepfe ?? 0}<span>Doppelköpfe</span></div>
        </div>
      </section>
      <section class="ui-profil-abschnitt">
        <h3 class="ui-profil-abschnitt-titel">Solos</h3>
        <div class="ui-profil-karten">
          <div class="ui-profil-karte ui-profil-karte--positiv">${statistik.solosSiege ?? 0}<span>Siege</span></div>
          <div class="ui-profil-karte ui-profil-karte--negativ">${statistik.solosNiederlagen ?? 0}<span>Niederlagen</span></div>
        </div>
      </section>
    `;
  }

  private static erstellePartieVerlauf(partien: PartieErgebnisAntwortGenerated[]): string {
    if (partien.length === 0) {
      return '<p class="ui-profil-leer">Noch keine Partien gespielt.</p>';
    }

    const zeilen = partien.map(p => {
      const datum = p.datum ? new Date(p.datum).toLocaleDateString('de-DE') : '—';
      const rangKlasse = p.rangplatz === 1 ? ' ui-profil-rang--gold' : '';
      return `<tr>
        <td>${SpielerProfilModal.escapeHtml(p.tischName ?? '—')}</td>
        <td>${datum}</td>
        <td>${p.spielanzahl ?? '—'}</td>
        <td class="ui-profil-punkte">${p.endPunktestand ?? '—'}</td>
        <td class="ui-profil-rang${rangKlasse}">#${p.rangplatz ?? '—'}</td>
      </tr>`;
    }).join('');

    return `
      <section class="ui-profil-abschnitt">
        <h3 class="ui-profil-abschnitt-titel">Letzte Partien</h3>
        <div class="ui-profil-tabelle-wrapper">
          <table class="ui-profil-tabelle">
            <thead><tr><th>Tisch</th><th>Datum</th><th>Spiele</th><th>Punkte</th><th>Platz</th></tr></thead>
            <tbody>${zeilen}</tbody>
          </table>
        </div>
      </section>
    `;
  }

  private static escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
