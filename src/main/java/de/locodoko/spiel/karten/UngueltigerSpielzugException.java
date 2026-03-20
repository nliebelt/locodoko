package de.locodoko.spiel.karten;

public class UngueltigerSpielzugException extends RuntimeException {

    public UngueltigerSpielzugException(String nachricht) {
        super(nachricht);
    }
}
