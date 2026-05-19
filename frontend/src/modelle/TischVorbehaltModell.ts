import type { KarteAntwort, LaufendesSpielAntwort, VorbehaltAnsage } from '../modelle/SpielverwaltungDto';
import { istTrumpfFuerSpieltyp, vergleicheKarten } from './TischKartenSortierung';

/**
 * Gibt den Spieltyp zurück der für die Preview-Sortierung im Vorbehalt-Modus
 * zu einer VorbehaltAnsage gehört. HOCHZEIT/ARMUT/SCHMEISSEN sortieren wie NORMALSPIEL.
 */
export function vorbehaltZuSpieltypFuerSortierung(v: VorbehaltAnsage): LaufendesSpielAntwort['spieltyp'] {
  switch (v) {
    case 'SOLO_DAME': return 'SOLO_DAME';
    case 'SOLO_BUBE': return 'SOLO_BUBE';
    case 'SOLO_FLEISCHLOS': return 'SOLO_FLEISCHLOS';
    case 'SOLO_TRUMPF': return 'SOLO_TRUMPF';
    case 'SOLO_TRUMPF_HERZ': return 'SOLO_TRUMPF_HERZ';
    case 'SOLO_TRUMPF_PIK': return 'SOLO_TRUMPF_PIK';
    case 'SOLO_TRUMPF_KREUZ': return 'SOLO_TRUMPF_KREUZ';
    default: return 'NORMALSPIEL';
  }
}

/**
 * Gibt true zurück wenn die Karte im Kontext des Vorbehalts visuell hervorgehoben
 * werden soll (nach oben ragen). Reine Darstellungslogik.
 */
export function istHervorgehobeneKarteImVorbehalt(karte: KarteAntwort, vorbehalt: VorbehaltAnsage): boolean {
  switch (vorbehalt) {
    case 'HOCHZEIT':
      return karte.farbe === 'KREUZ' && karte.wert === 'DAME';
    case 'SOLO_DAME':
      return karte.wert === 'DAME';
    case 'SOLO_BUBE':
      return karte.wert === 'BUBE';
    case 'SOLO_FLEISCHLOS':
      return false;
    case 'SCHMEISSEN':
    case 'SCHMEISSEN_FUENF_NEUNEN':
    case 'SCHMEISSEN_WENIG_TRUMPF':
      return false;
    default:
      return istTrumpfFuerSpieltyp(karte, vorbehaltZuSpieltypFuerSortierung(vorbehalt));
  }
}

/**
 * Sortiert Karten für die temporäre Vorbehalt-Preview.
 * Nutzt vergleicheKarten()-Logik mit gemapptem Spieltyp.
 */
export function sortiereKartenFuerVorbehalt(karten: KarteAntwort[], vorbehalt: VorbehaltAnsage): KarteAntwort[] {
  const spieltyp = vorbehaltZuSpieltypFuerSortierung(vorbehalt);
  return [...karten].sort((a, b) => vergleicheKarten(a, b, spieltyp, false));
}
