package de.locodoko.spieler;

/** Wird geworfen, wenn ein Spieler versucht, eine Ressource zu aendern, die ihm nicht gehoert. */
public class SpielerZugriffVerweigertException extends RuntimeException {

    private static final String FEHLER_CODE = "ZUGRIFF_VERWEIGERT";

    public SpielerZugriffVerweigertException(String message) {
        super(message);
    }

    public String fehlerCode() {
        return FEHLER_CODE;
    }
}
