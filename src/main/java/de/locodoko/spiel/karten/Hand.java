package de.locodoko.spiel.karten;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Objects;

public final class Hand {

    private final List<Karte> karten;

    public Hand(Collection<Karte> karten) {
        Objects.requireNonNull(karten, "karten duerfen nicht null sein");
        this.karten = List.copyOf(karten);
    }

    public List<Karte> karten() {
        return karten;
    }

    public boolean enthaelt(Karte karte) {
        return karten.contains(karte);
    }

    public boolean kannBedienen(Bedienfarbe bedienfarbe, TrumpfOrdnung trumpfOrdnung) {
        return karten.stream().anyMatch(karte -> bedienfarbe.passtZu(karte, trumpfOrdnung));
    }

    public List<Karte> gueltigeKarten(Bedienfarbe bedienfarbe, TrumpfOrdnung trumpfOrdnung) {
        if (!kannBedienen(bedienfarbe, trumpfOrdnung)) {
            return karten;
        }
        List<Karte> passendeKarten = new ArrayList<>();
        for (Karte karte : karten) {
            if (bedienfarbe.passtZu(karte, trumpfOrdnung)) {
                passendeKarten.add(karte);
            }
        }
        return List.copyOf(passendeKarten);
    }
}
