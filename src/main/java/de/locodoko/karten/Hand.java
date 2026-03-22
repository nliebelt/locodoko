package de.locodoko.karten;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Objects;

/**
 * Handkarten eines Spielers.
 *
 * <p>Eine Hand ist eine unveraenderliche, geordnete Menge von Karten. Sie kapselt die
 * Bedienpflicht-Logik: {@link #gueltigeKarten(Bedienfarbe, TrumpfOrdnung)} liefert
 * ausschliesslich die laut Spielregeln erlaubten Karten fuer den naechsten Zug.
 * Alle Mutationen (Karte spielen oder tauschen) erzeugen eine neue Hand-Instanz.</p>
 */
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

    public Hand ohne(Karte karte) {
        Objects.requireNonNull(karte, "karte darf nicht null sein");
        if (!enthaelt(karte)) {
            throw new IllegalArgumentException("Die Karte " + karte + " ist nicht auf der Hand");
        }
        List<Karte> verbleibendeKarten = new ArrayList<>(karten);
        verbleibendeKarten.remove(karte);
        return new Hand(verbleibendeKarten);
    }

    public Hand ohneAlle(Collection<Karte> zuEntfernendeKarten) {
        Objects.requireNonNull(zuEntfernendeKarten, "zuEntfernendeKarten duerfen nicht null sein");
        Hand aktuelleHand = this;
        for (Karte karte : zuEntfernendeKarten) {
            aktuelleHand = aktuelleHand.ohne(karte);
        }
        return aktuelleHand;
    }

    public Hand mitAllen(Collection<Karte> neueKarten) {
        Objects.requireNonNull(neueKarten, "neueKarten duerfen nicht null sein");
        List<Karte> erweiterteKarten = new ArrayList<>(karten);
        erweiterteKarten.addAll(neueKarten);
        return new Hand(erweiterteKarten);
    }
}
