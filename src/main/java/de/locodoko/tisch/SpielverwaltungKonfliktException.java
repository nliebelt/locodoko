package de.locodoko.tisch;

/**
 * Wird geworfen, wenn eine Aktion wegen eines Konflikts nicht ausgefuehrt werden kann (HTTP 409).
 *
 * <p>Typische Faelle: Tisch ist voll, Partie laeuft bereits, Spieler ist bereits am Tisch.
 * Wird durch {@link SpielverwaltungExceptionHandler} als strukturierte {@link ApiFehlerAntwort}
 * mit Status 409 zurueckgegeben.</p>
 */
public class SpielverwaltungKonfliktException extends RuntimeException {

    private final String fehlerCode;

    public SpielverwaltungKonfliktException(String fehlerCode, String nachricht) {
        super(nachricht);
        this.fehlerCode = fehlerCode;
    }

    public String fehlerCode() {
        return fehlerCode;
    }
}
