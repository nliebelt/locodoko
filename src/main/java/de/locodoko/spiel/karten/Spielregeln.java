package de.locodoko.spiel.karten;

public record Spielregeln(boolean ohneNeunen, boolean zweiteDulleSticht) {

    public static Spielregeln standardRegeln() {
        return new Spielregeln(false, true);
    }

    public static Spielregeln ohneNeunenRegeln() {
        return new Spielregeln(true, true);
    }
}
