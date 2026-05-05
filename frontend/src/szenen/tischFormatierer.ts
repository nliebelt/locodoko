/**
 * Reine Formatierungs-Hilfsfunktionen fuer die Tischdarstellung.
 * Werden sowohl von TischSzene (Phaser-Rendering) als auch von TischUIManager (DOM) genutzt.
 * Funktionen sind zustandslos und dienen der einheitlichen Darstellung von Spieldaten.
 */
import type { Ansage, KarteAntwort, KiSchwierigkeit, Sonderpunkt, SonderpunktEreignis, SonderpunktEreignisAntwortDto, VorbehaltAnsage } from '../modelle/SpielverwaltungDto';

export const KARTEN_BREITE = 96;
export const KARTEN_HOEHE = 144;

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

export function kuerzelFuerKarte(karte: KarteAntwort): string {
  const wert = ({
    AS: 'A',
    ZEHN: '10',
    KOENIG: 'K',
    DAME: 'D',
    BUBE: 'B',
    NEUN: '9'
  } as Record<string, string>)[karte.wert] ?? karte.wert.slice(0, 2);
  const farbe = ({
    KREUZ: 'K',
    PIK: 'P',
    HERZ: 'H',
    KARO: 'D'
  } as Record<string, string>)[karte.farbe] ?? karte.farbe.slice(0, 1);
  return `${farbe}${wert}`;
}

export function formatiereAnsage(ansage: Ansage): string {
  return ({
    RE: 'Re',
    KONTRA: 'Kontra',
    KEINE_90: 'Keine 90',
    KEINE_60: 'Keine 60',
    KEINE_30: 'Keine 30',
    SCHWARZ: 'Schwarz'
  } as Record<Ansage, string>)[ansage];
}

export function formatiereVorbehalt(vorbehalt: VorbehaltAnsage): string {
  return ({
    GESUND: 'Gesund',
    SOLO_DAME: 'Damensolo',
    SOLO_BUBE: 'Bubensolo',
    SOLO_TRUMPF: 'Karosolo',
    SOLO_TRUMPF_HERZ: 'Herzsolo',
    SOLO_TRUMPF_PIK: 'Piksolo',
    SOLO_TRUMPF_KREUZ: 'Kreuzsolo',
    SOLO_FLEISCHLOS: 'Fleischlos',
    HOCHZEIT: 'Hochzeit',
    ARMUT: 'Armut',
    SCHMEISSEN: 'Schmeißen',
    SCHMEISSEN_FUENF_NEUNEN: 'Schm. (5 Neunen)',
    SCHMEISSEN_WENIG_TRUMPF: 'Schm. (wenig Trumpf)'
  } as Record<VorbehaltAnsage, string>)[vorbehalt];
}

export function formatiereSonderpunkt(ereignis: SonderpunktEreignis, spielerNamen?: Map<string, string>): string {
  const basisText = ({
    FUCHS_GEFANGEN: 'Fuchs gefangen',
    KARLCHEN: 'Karlchen',
    DOPPELKOPF: 'Doppelkopf'
  } as Record<Sonderpunkt, string>)[ereignis.art];
  if (!spielerNamen) {
    return basisText;
  }
  const taeter = spielerNamen.get(ereignis.taeter) ?? ereignis.taeter;
  if (ereignis.art === 'FUCHS_GEFANGEN' && ereignis.opfer) {
    const opfer = spielerNamen.get(ereignis.opfer) ?? ereignis.opfer;
    return `${basisText} (${taeter} fängt ${opfer}s Fuchs)`;
  }
  if (ereignis.art === 'KARLCHEN') {
    return `${basisText} (${taeter})`;
  }
  return basisText;
}

/** Lesbares Label fuer die KI-Schwierigkeitsstufe (fuer Badges und Anzeige). */
export function kiSchwierigkeitLabel(schwierigkeit: KiSchwierigkeit): string {
  return ({ LEICHT: 'Leicht', STANDARD: 'Standard', SCHWER: 'Schwer' } as Record<KiSchwierigkeit, string>)[schwierigkeit] ?? 'Standard';
}

/** Kurzes Feedback-Label fuer ein Sonderpunkt-Ereignis in der Animations-Queue. */
export function formatiereEreignisSonderpunktFeedback(sp: SonderpunktEreignisAntwortDto): string {
  return ({ FUCHS_GEFANGEN: 'Fuchs gefangen!', DOPPELKOPF: 'Doppelkopf!', KARLCHEN: 'Karlchen!' } as Record<string, string>)[sp.typ] ?? sp.typ;
}

/** Countdown-Text fuer das Partie-Ende-Modal. Leerstring wenn kein aktiver Countdown. */
export function formatiereCountdownText(sekunden: number | null | undefined): string {
  if (sekunden == null || sekunden <= 0) return '';
  return `Neue Partie startet in ${sekunden}…`;
}
