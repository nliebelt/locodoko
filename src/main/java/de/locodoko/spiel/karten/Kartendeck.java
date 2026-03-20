package de.locodoko.spiel.karten;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Random;

public final class Kartendeck {

    private final List<Karte> karten;

    private Kartendeck(Collection<Karte> karten) {
        this.karten = List.copyOf(karten);
    }

    public static Kartendeck neu(Spielregeln spielregeln) {
        List<Karte> karten = new ArrayList<>();
        for (Farbe farbe : Farbe.values()) {
            for (Kartenwert wert : Kartenwert.values()) {
                if (spielregeln.ohneNeunen() && wert == Kartenwert.NEUN) {
                    continue;
                }
                karten.add(new Karte(farbe, wert, 1));
                karten.add(new Karte(farbe, wert, 2));
            }
        }
        return new Kartendeck(karten);
    }

    public Kartendeck gemischt() {
        return gemischt(new SecureRandom());
    }

    public Kartendeck gemischt(Random zufall) {
        Objects.requireNonNull(zufall, "zufall darf nicht null sein");
        List<Karte> kopie = new ArrayList<>(karten);
        Collections.shuffle(kopie, zufall);
        return new Kartendeck(kopie);
    }

    public List<Karte> karten() {
        return karten;
    }

    public int gesamtaugen() {
        return karten.stream().mapToInt(Karte::augen).sum();
    }

    public Map<SpielerPosition, Hand> anVierSpielerAusteilen() {
        if (karten.size() % 4 != 0) {
            throw new IllegalStateException("Kartenzahl muss durch vier teilbar sein");
        }
        Map<SpielerPosition, List<Karte>> verteilung = new EnumMap<>(SpielerPosition.class);
        for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
            verteilung.put(position, new ArrayList<>());
        }
        List<SpielerPosition> reihenfolge = SpielerPosition.standardReihenfolge();
        for (int index = 0; index < karten.size(); index++) {
            SpielerPosition position = reihenfolge.get(index % reihenfolge.size());
            verteilung.get(position).add(karten.get(index));
        }
        Map<SpielerPosition, Hand> haende = new EnumMap<>(SpielerPosition.class);
        for (Map.Entry<SpielerPosition, List<Karte>> eintrag : verteilung.entrySet()) {
            haende.put(eintrag.getKey(), new Hand(eintrag.getValue()));
        }
        return Map.copyOf(haende);
    }
}
