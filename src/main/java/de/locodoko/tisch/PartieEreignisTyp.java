package de.locodoko.tisch;

/**
 * Typ eines WebSocket-Partie-Ereignisses.
 */
public enum PartieEreignisTyp {
    SNAPSHOT,
    PARTIE_AKTUALISIERT,
    KARTE_GESPIELT,
    KI_ZUG_SEQUENZ,
    STICH_ABGESCHLOSSEN
}
