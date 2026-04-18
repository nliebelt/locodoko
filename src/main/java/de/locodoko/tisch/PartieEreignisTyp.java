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
    /** Eine Karte wurde gespielt (Mensch oder KI-Einzelkarte). */
    KARTE_GESPIELT,
    /** KI hat mehrere Karten in Folge gespielt — Liste fuer animierte Wiedergabe. */
    KI_ZUG_SEQUENZ,
    /** Stich abgeschlossen, ggf. mit Sonderpunkten. */
    STICH_ABGESCHLOSSEN,
    /** Spiel beendet und ausgewertet. */
    SPIEL_BEENDET
}
