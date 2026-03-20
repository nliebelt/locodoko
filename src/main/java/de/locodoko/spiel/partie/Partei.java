package de.locodoko.spiel.partie;

public enum Partei {
    RE,
    KONTRA;

    public Partei gegenpartei() {
        return this == RE ? KONTRA : RE;
    }
}
