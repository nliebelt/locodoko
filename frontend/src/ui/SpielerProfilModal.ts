import type { SpielerProfilAntwortGenerated, StatistikAntwortGenerated, PartieErgebnisAntwortGenerated } from '../generated/schema-types';
import { installiereDialogA11y } from './dialogHelper';

/**
 * HTML-basiertes Modal für die Anzeige des Spieler-Profils mit Statistiken und Partie-Verlauf.
 * Wird in das #ui-root-Element eingehängt und nutzt die .ui-modal-backdrop / .ui-modal CSS-Klassen.
 */
export class SpielerProfilModal {
  private readonly element: HTMLElement;
  private aufraeuemen: () => void = () => {};

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

    const instanz = new SpielerProfilModal(backdrop);
    instanz.aufraeuemen = installiereDialogA11y(backdrop, () => instanz.schliessen());

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) instanz.schliessen();
    });
    backdrop.querySelector('.ui-profil-schliessen')?.addEventListener('click', () => instanz.schliessen());

    (backdrop.querySelector<HTMLElement>('button:not([disabled])'))?.focus();

    return instanz;
  }

  /** Schließt das Modal und entfernt es aus dem DOM. */
  schliessen(): void {
    this.aufraeuemen();
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
    backdrop.setAttribute('aria-labelledby', 'profil-dialog-titel');

    const modal = document.createElement('div');
    modal.className = 'ui-modal ui-modal--profil';
    modal.innerHTML = SpielerProfilModal.erstelleInhalt(profil);
    backdrop.appendChild(modal);

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
          <h2 id="profil-dialog-titel">${SpielerProfilModal.escapeHtml(name)}</h2>
          <span class="ui-profil-meta">Dabei seit ${datum}</span>
        </div>
        <button class="ui-profil-schliessen" aria-label="Profil schließen">✕</button>
      </div>
      <div class="ui-profil-statistik-container">
        ${SpielerProfilModal.erstelleStatistikInhalt(profil.statistik)}
      </div>
      ${SpielerProfilModal.erstellePartieVerlauf(profil.letztePartien ?? [])}
    `;
  }

  private static berechneStatistikWerte(statistik: StatistikAntwortGenerated): {
    anzahl: number; siege: number; siegquote: number;
    punkteProSpiel: string; augenProSpiel: string; rating: string;
    reRate: number; kontraRate: number;
  } {
    const anzahl = statistik.anzahlSpiele ?? 0;
    const siege = statistik.anzahlSiege ?? 0;
    const siegquote = statistik.siegquote ?? (anzahl > 0 ? Math.round((siege / anzahl) * 100) : 0);
    const punkteProSpiel = statistik.durchschnittlichePunkteProSpiel?.toFixed(2) ?? '—';
    const augenProSpiel = statistik.durchschnittlicheAugenProSpiel?.toFixed(1) ?? '—';
    const rating = statistik.konservativesRating !== undefined ? String(Math.round(statistik.konservativesRating)) : '—';
    const reSpieleGesamt = (statistik.reSiege ?? 0) + (statistik.reNiederlagen ?? 0);
    const reRate = reSpieleGesamt > 0 ? Math.round(((statistik.reSiege ?? 0) / reSpieleGesamt) * 100) : 0;
    const kontraSpieleGesamt = (statistik.kontraSiege ?? 0) + (statistik.kontraNiederlagen ?? 0);
    const kontraRate = kontraSpieleGesamt > 0 ? Math.round(((statistik.kontraSiege ?? 0) / kontraSpieleGesamt) * 100) : 0;
    return { anzahl, siege, siegquote, punkteProSpiel, augenProSpiel, rating, reRate, kontraRate };
  }

  private static erstelleStatistikInhalt(statistik: StatistikAntwortGenerated | undefined): string {
    if (!statistik) {
      return '<p class="ui-profil-leer">Noch keine Statistiken vorhanden.</p>';
    }
    const { anzahl, siege, siegquote, punkteProSpiel, augenProSpiel, rating, reRate, kontraRate } = SpielerProfilModal.berechneStatistikWerte(statistik);
    return `
      <section class="ui-profil-abschnitt">
        <h3 class="ui-profil-abschnitt-titel">Statistiken</h3>
        <div class="ui-profil-karten">
          <div class="ui-profil-karte">${anzahl}<span>Spiele</span></div>
          <div class="ui-profil-karte">${siege}<span>Siege</span></div>
          <div class="ui-profil-karte ui-profil-karte--akzent">${Math.round(siegquote)}%<span>Win-Rate</span></div>
          <div class="ui-profil-karte">${statistik.gesamtPunkte ?? 0}<span>Punkte</span></div>
        </div>
        <div class="ui-profil-karten">
          <div class="ui-profil-karte">${punkteProSpiel}<span>Ø Pkt/Spiel</span></div>
          <div class="ui-profil-karte">${augenProSpiel}<span>Ø Augen/Spiel</span></div>
          <div class="ui-profil-karte ui-profil-karte--akzent" title="Wertung = geschätzte Spielstärke minus Unsicherheit (μ − 3σ). Steigt durch Siege gegen starke Gegner. Neue Spieler starten niedrig.">${rating}<span>TrueSkill</span></div>
        </div>
      </section>
      <section class="ui-profil-abschnitt">
        <h3 class="ui-profil-abschnitt-titel">Re / Kontra</h3>
        <div class="ui-profil-re-kontra">
          <div class="ui-profil-re-kontra-zeile">
            <span class="ui-profil-re-kontra-label">Re</span>
            <span>${statistik.reSiege ?? 0} Siege / ${statistik.reNiederlagen ?? 0} Niederlagen</span>
            <span class="ui-profil-re-kontra-rate">${reRate}%</span>
          </div>
          <div class="ui-profil-re-kontra-zeile">
            <span class="ui-profil-re-kontra-label">Kontra</span>
            <span>${statistik.kontraSiege ?? 0} Siege / ${statistik.kontraNiederlagen ?? 0} Niederlagen</span>
            <span class="ui-profil-re-kontra-rate">${kontraRate}%</span>
          </div>
        </div>
      </section>
      <section class="ui-profil-abschnitt">
        <h3 class="ui-profil-abschnitt-titel">Sonderpunkte</h3>
        <div class="ui-profil-karten">
          <div class="ui-profil-karte ui-profil-karte--positiv">+${statistik.fuchsGefangen ?? 0}<span>Fuchs gefangen</span></div>
          <div class="ui-profil-karte ui-profil-karte--negativ">-${statistik.fuchsVerloren ?? 0}<span>Fuchs verloren</span></div>
          <div class="ui-profil-karte">${statistik.karlchenGespielt ?? 0}<span>Karlchen</span></div>
          <div class="ui-profil-karte">${statistik.schweinchenGespielt ?? 0}<span>Schweinchen</span></div>
          <div class="ui-profil-karte">${statistik.doppelkoepfe ?? 0}<span>Doppelköpfe</span></div>
        </div>
      </section>
      <section class="ui-profil-abschnitt">
        <h3 class="ui-profil-abschnitt-titel">Hochzeiten &amp; Armuten</h3>
        <div class="ui-profil-karten">
          <div class="ui-profil-karte">${statistik.hochzeitenGespielt ?? 0}<span>Hochzeiten</span></div>
          <div class="ui-profil-karte">${statistik.armutenAngesagt ?? 0}<span>Armuten angesagt</span></div>
          <div class="ui-profil-karte">${statistik.armutenUebernommen ?? 0}<span>Armuten übernom.</span></div>
        </div>
      </section>
      <section class="ui-profil-abschnitt">
        <h3 class="ui-profil-abschnitt-titel">Solos</h3>
        <div class="ui-profil-karten">
          <div class="ui-profil-karte ui-profil-karte--positiv">${statistik.solosSiege ?? 0}<span>Siege</span></div>
          <div class="ui-profil-karte ui-profil-karte--negativ">${statistik.solosNiederlagen ?? 0}<span>Niederlagen</span></div>
        </div>
        ${SpielerProfilModal.erstelleSolosProTyp(statistik.solosProTypJson)}
      </section>
    `;
  }

  private static erstelleSolosProTyp(solosProTypJson: string | undefined): string {
    if (!solosProTypJson) return '';
    let eintraege: Record<string, { siege?: number; niederlagen?: number }>;
    try {
      eintraege = JSON.parse(solosProTypJson) as Record<string, { siege?: number; niederlagen?: number }>;
    } catch {
      return '';
    }
    const zeilen = Object.entries(eintraege)
      .filter(([, werte]) => (werte.siege ?? 0) + (werte.niederlagen ?? 0) > 0)
      .map(([typ, werte]) => `
        <li class="ui-profil-solo-eintrag">
          <span class="ui-profil-solo-typ">${SpielerProfilModal.escapeHtml(typ)}</span>
          <span>${werte.siege ?? 0}S / ${werte.niederlagen ?? 0}N</span>
        </li>
      `)
      .join('');
    return zeilen ? `<ul class="ui-profil-solos-liste" aria-label="Solos nach Typ">${zeilen}</ul>` : '';
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
          <table class="ui-profil-tabelle" aria-label="Partie-Verlauf">
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
