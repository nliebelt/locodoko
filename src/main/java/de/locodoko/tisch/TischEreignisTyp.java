package de.locodoko.tisch;

/**
 * Typ eines WebSocket-Tisch-Ereignisses auf {@code /topic/tisch/{id}}.
 *
 * <p>Unterscheidet zwischen vollstaendigem Snapshot, Lobby-Aenderungen (Beitreten, Verlassen,
 * Konfigurationsaenderung), Spielstart und Tisch-Entfernung.</p>
 */
public enum TischEreignisTyp {
    TISCH_SNAPSHOT,
    TISCH_ERSTELLT,
    SPIELER_BEIGETRETEN,
    SPIELER_VERLASSEN,
    TISCH_KONFIGURATION_AKTUALISIERT,
    SPIEL_GESTARTET,
    TISCH_ENTFERNT,
    /** Ein Spieler hat den Tisch waehrend einer laufenden Partie verlassen — Partie abgebrochen. */
    PARTIE_ABGEBROCHEN,
    /** Der Gastgeber hat einen Spieler vom Tisch entfernt. */
    SPIELER_GEKICKT,
    /** Countdown-Tick vor automatischem Start einer neuen Partie. */
    COUNTDOWN_TICK
}
