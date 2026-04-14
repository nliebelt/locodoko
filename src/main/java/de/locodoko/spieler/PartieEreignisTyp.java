package de.locodoko.spieler;

/**
 * Typ eines WebSocket-Partie-Ereignisses.
 *
 * <p>{@code PARTIE_SNAPSHOT}: vollstaendiger Zustand auf explizite Anfrage;
 * {@code PARTIE_AKTUALISIERT}: inkrementelles Update nach einer Spielaktion.</p>
 */
public enum PartieEreignisTyp {
    PARTIE_SNAPSHOT,
    PARTIE_AKTUALISIERT
}
