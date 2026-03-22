package de.locodoko.session;

/**
 * Wird geworfen, wenn eine gesuchte Ressource nicht existiert (HTTP 404).
 *
 * <p>Typische Faelle: Tisch-ID oder Partie-ID nicht in der Datenbank gefunden.
 * Wird durch {@link SpielverwaltungExceptionHandler} als strukturierte {@link ApiFehlerAntwort}
 * mit Status 404 zurueckgegeben.</p>
 */
public class SpielverwaltungNichtGefundenException extends RuntimeException {

    private final String fehlerCode;

    public SpielverwaltungNichtGefundenException(String fehlerCode, String nachricht) {
        super(nachricht);
        this.fehlerCode = fehlerCode;
    }

    public String fehlerCode() {
        return fehlerCode;
    }
}
