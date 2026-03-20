package de.locodoko.spielverwaltung.session;

public class SpielerNameAenderungNichtErlaubtException extends RuntimeException {

    public SpielerNameAenderungNichtErlaubtException(String message) {
        super(message);
    }
}
