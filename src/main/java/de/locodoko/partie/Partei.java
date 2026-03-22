package de.locodoko.partie;

public enum Partei {
    RE,
    KONTRA;

    public Partei gegenpartei() {
        return this == RE ? KONTRA : RE;
    }
}
