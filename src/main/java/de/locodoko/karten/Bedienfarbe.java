package de.locodoko.karten;

import java.util.Objects;

/**
 * Angefragte Farbe eines Stichs — entscheidet ueber die Bedienpflicht.
 *
 * <p>Ein Stich kann entweder Trumpf (wenn die erste Karte Trumpf ist) oder eine der
 * vier Fehlfarben (Kreuz, Pik, Herz, Karo) anfragen. Alle Spieler muessen bedienen,
 * sofern sie eine passende Karte auf der Hand haben. Die Methode
 * {@link #passtZu(Karte, TrumpfOrdnung)} prueft, ob eine bestimmte Karte die angefragte
 * Bedienfarbe erfuellt.</p>
 */
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
