package de.locodoko.tisch;

/**
 * Typ eines WebSocket-Partie-Ereignisses.
 *
 * <p>Enthaelt ausschliesslich Typen, die tatsaechlich per WebSocket gesendet werden
 * (als {@code PartieEreignisAntwort}-Records). Interne Domain-Events leben getrennt davon
 * im Paket {@code partie.ereignisse} und ueberqueren nie die WebSocket-Grenze.</p>
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
    /** Der Hochzeit-Partner wurde gefunden. */
    HOCHZEIT_PARTNER_GEFUNDEN,
    /** Das Spiel wurde gestartet. */
    SPIEL_GESTARTET,
    /** Eine Spieleraktion wurde abgelehnt (z.B. ungueltiger Kartenzug). */
    AKTION_ABGELEHNT
}
