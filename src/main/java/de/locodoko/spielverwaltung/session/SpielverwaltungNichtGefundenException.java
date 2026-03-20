package de.locodoko.spielverwaltung.session;

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
