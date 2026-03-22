package de.locodoko.partie;

/**
 * Aktueller Zustand einer Partie.
 *
 * <p>Eine Partie laeuft ({@code LAUFEND}), solange noch Spiele zu spielen sind.
 * Nach dem letzten Spiel wechselt sie in {@code BEENDET}.
 * Wenn ein Spieler den Tisch waehrend einer laufenden Partie verlaesst,
 * wechselt sie in {@code ABGEBROCHEN}.</p>
 */
public enum PartieStatus {
    LAUFEND,
    BEENDET,
    /** Partie wurde abgebrochen, weil ein Spieler den Tisch verlassen hat. */
    ABGEBROCHEN
}
