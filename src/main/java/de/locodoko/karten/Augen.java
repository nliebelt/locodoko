package de.locodoko.karten;

/**
 * Augen-Summe eines Stichs oder einer Partie als typsicheres Value Object.
 *
 * <p>Verhindert versehentliche Zuweisung von Augen an Spielpunkte oder umgekehrt.
 * Invariante: {@code wert >= 0}.</p>
 */
public record Augen(int wert) {

    public Augen {
        if (wert < 0) {
            throw new IllegalArgumentException("Augen muessen >= 0 sein, war " + wert);
        }
    }

    public static Augen null_() {
        return new Augen(0);
    }

    public Augen plus(Augen andere) {
        return new Augen(this.wert + andere.wert);
    }

    public boolean ueberschreitet(int schwellenwert) {
        return wert > schwellenwert;
    }

    public boolean mindestens(int schwellenwert) {
        return wert >= schwellenwert;
    }
}
