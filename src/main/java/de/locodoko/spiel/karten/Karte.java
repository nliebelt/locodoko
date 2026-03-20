package de.locodoko.spiel.karten;

import java.util.Objects;

public record Karte(Farbe farbe, Kartenwert wert, int exemplarIndex) {

    public Karte {
        Objects.requireNonNull(farbe, "farbe darf nicht null sein");
        Objects.requireNonNull(wert, "wert darf nicht null sein");
        if (exemplarIndex < 1) {
            throw new IllegalArgumentException("exemplarIndex muss groesser gleich 1 sein");
        }
    }

    public int augen() {
        return wert.augen();
    }

    public boolean gleicheAuspraegungWie(Karte andereKarte) {
        return farbe == andereKarte.farbe() && wert == andereKarte.wert();
    }
}
