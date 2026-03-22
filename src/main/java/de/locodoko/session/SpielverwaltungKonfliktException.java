package de.locodoko.session;

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
