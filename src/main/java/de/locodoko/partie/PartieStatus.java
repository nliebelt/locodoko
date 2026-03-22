package de.locodoko.partie;

/**
 * Aktueller Zustand einer Partie.
 *
 * <p>Eine Partie laeuft ({@code LAUFEND}), solange noch Spiele zu spielen sind.
 * Nach dem letzten Spiel wechselt sie in {@code BEENDET}.</p>
 */
public enum PartieStatus {
    LAUFEND,
    BEENDET
}
