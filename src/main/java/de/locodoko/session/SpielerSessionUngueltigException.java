package de.locodoko.session;

/** Wird geworfen, wenn die HTTP-Session des Spielers unbekannt oder abgelaufen ist. */
public class SpielerSessionUngueltigException extends RuntimeException {

    /** Eindeutiger Fehler-Code fuer den API-Vertrag; wird von Exception-Handlern direkt gelesen. */
    private static final String FEHLER_CODE = "SPIELER_SESSION_UNGUELTIG";

    public SpielerSessionUngueltigException(String message) {
        super(message);
    }

    /** Liefert den stabilen Fehler-Code fuer REST- und WebSocket-Antworten. */
    public String fehlerCode() {
        return FEHLER_CODE;
    }
}
