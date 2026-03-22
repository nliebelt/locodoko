package de.locodoko.karten;

public enum Kartenwert {
    NEUN(0, 1),
    BUBE(2, 2),
    DAME(3, 3),
    KOENIG(4, 4),
    ZEHN(10, 5),
    AS(11, 6);

    private final int augen;
    private final int fehlRang;

    Kartenwert(int augen, int fehlRang) {
        this.augen = augen;
        this.fehlRang = fehlRang;
    }

    public int augen() {
        return augen;
    }

    public int fehlRang() {
        return fehlRang;
    }
}
