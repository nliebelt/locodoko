package de.locodoko.spiel.karten;

import java.util.Objects;

public record Bedienfarbe(boolean trumpf, Farbe farbe) {

    public Bedienfarbe {
        if (!trumpf) {
            Objects.requireNonNull(farbe, "farbe darf fuer Fehl nicht null sein");
        }
    }

    public static Bedienfarbe alsTrumpf() {
        return new Bedienfarbe(true, null);
    }

    public static Bedienfarbe fehl(Farbe farbe) {
        return new Bedienfarbe(false, farbe);
    }

    public boolean passtZu(Karte karte, TrumpfOrdnung trumpfOrdnung) {
        return equals(trumpfOrdnung.bedienfarbeVon(karte));
    }
}
