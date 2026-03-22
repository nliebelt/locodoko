package de.locodoko.karten;

public class UngueltigerSpielzugException extends RuntimeException {

    public UngueltigerSpielzugException(String nachricht) {
        super(nachricht);
    }
}
