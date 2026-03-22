package de.locodoko.session;

/** Wird geworfen, wenn ein Spieler seinen Namen aendern will, obwohl er bereits an einem Tisch sitzt. */
public class SpielerNameAenderungNichtErlaubtException extends RuntimeException {

    /** Eindeutiger Fehler-Code fuer den API-Vertrag; wird von Exception-Handlern direkt gelesen. */
    private static final String FEHLER_CODE = "SPIELER_NAME_AENDERUNG_NICHT_ERLAUBT";

    public SpielerNameAenderungNichtErlaubtException(String message) {
        super(message);
    }

    /** Liefert den stabilen Fehler-Code fuer REST-Antworten. */
    public String fehlerCode() {
        return FEHLER_CODE;
    }
}
