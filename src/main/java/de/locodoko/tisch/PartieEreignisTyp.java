package de.locodoko.tisch;

/**
 * Typ eines WebSocket-Partie-Ereignisses.
 *
 * <p>Nur Typen, die tatsaechlich per WebSocket gesendet werden. Interne Domain-Events
 * (z.B. {@code SchweinchenGemeldet}, {@code SpielGestartet}) sind hier nicht aufgefuehrt —
 * sie leben im Paket {@code partie.ereignisse} und werden ggf. kuenftig in WebSocket-Events
 * umgewandelt.
 */
public enum PartieEreignisTyp {
    /** Vollstaendiger Partiestand-Snapshot (nach Beitritt, Reconnect oder explizitem Request). */
    SNAPSHOT,
    /** Eine Karte wurde gespielt (Mensch oder KI). */
    KARTE_GESPIELT,
    /** Stich abgeschlossen, ggf. mit Sonderpunkten. */
    STICH_ABGESCHLOSSEN,
    /** Spiel beendet und ausgewertet. */
    SPIEL_BEENDET,
    /** Eine Ansage wurde gemacht (z.B. Re, Kontra). */
    ANSAGE_ERFOLGT,
    /** Ein Schweinchen wurde gemeldet. */
    SCHWEINCHEN_GEMELDET,
    /** Das Spiel wurde gestartet. */
    SPIEL_GESTARTET,
    /** Eine Spieleraktion wurde abgelehnt (z.B. ungueltiger Kartenzug). */
    AKTION_ABGELEHNT
}
