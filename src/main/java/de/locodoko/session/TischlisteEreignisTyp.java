package de.locodoko.session;

/**
 * Typ eines WebSocket-Tischlisten-Ereignisses auf {@code /topic/tische}.
 *
 * <p>{@code SNAPSHOT}: vollstaendige Liste aller Tische auf Anfrage;
 * {@code AKTUALISIERT}: inkrementelles Update nach einer Lobby-Aenderung.</p>
 */
public enum TischlisteEreignisTyp {
    SNAPSHOT,
    AKTUALISIERT
}
