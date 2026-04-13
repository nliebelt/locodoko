package de.locodoko.partie;

/**
 * Spielpunkte eines Spielers nach einer Runde als typsicheres Value Object.
 *
 * <p>Verhindert versehentliche Zuweisung von Spielpunkten an Augen oder umgekehrt.
 * Spielpunkte koennen negativ sein (Verlierer).</p>
 */
public record Spielpunkte(int wert) {

    public Spielpunkte mal(int faktor) {
        return new Spielpunkte(wert * faktor);
    }

    public Spielpunkte plus(Spielpunkte andere) {
        return new Spielpunkte(wert + andere.wert);
    }

    public Spielpunkte negiert() {
        return new Spielpunkte(-wert);
    }
}
