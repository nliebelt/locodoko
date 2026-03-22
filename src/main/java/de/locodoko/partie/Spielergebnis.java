package de.locodoko.partie;

import de.locodoko.karten.SpielerPosition;

import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public record Spielergebnis(
    Map<Partei, Integer> augenProPartei,
    Partei siegerPartei,
    int spielwert,
    Map<SpielerPosition, Integer> spielpunkteProSpieler,
    Map<Partei, List<Sonderpunkt>> sonderpunkteProPartei
) {

    public Spielergebnis {
        Objects.requireNonNull(augenProPartei, "augenProPartei darf nicht null sein");
        Objects.requireNonNull(siegerPartei, "siegerPartei darf nicht null sein");
        Objects.requireNonNull(spielpunkteProSpieler, "spielpunkteProSpieler darf nicht null sein");
        Objects.requireNonNull(sonderpunkteProPartei, "sonderpunkteProPartei duerfen nicht null sein");

        EnumMap<Partei, Integer> augenKopie = new EnumMap<>(Partei.class);
        augenKopie.putAll(augenProPartei);
        EnumMap<SpielerPosition, Integer> punkteKopie = new EnumMap<>(SpielerPosition.class);
        punkteKopie.putAll(spielpunkteProSpieler);
        EnumMap<Partei, List<Sonderpunkt>> sonderpunkteKopie = new EnumMap<>(Partei.class);
        sonderpunkteKopie.putAll(sonderpunkteProPartei);

        if (!augenKopie.keySet().containsAll(EnumSet.allOf(Partei.class))) {
            throw new IllegalArgumentException("Augen muessen fuer beide Parteien vorliegen");
        }
        if (!punkteKopie.keySet().containsAll(EnumSet.allOf(SpielerPosition.class))) {
            throw new IllegalArgumentException("Spielpunkte muessen fuer alle Spieler vorliegen");
        }
        if (!sonderpunkteKopie.keySet().containsAll(EnumSet.allOf(Partei.class))) {
            throw new IllegalArgumentException("Sonderpunkte muessen fuer beide Parteien vorliegen");
        }
        if (spielwert < 1) {
            throw new IllegalArgumentException("Der Spielwert muss positiv sein");
        }
        int gesamtaugen = augenKopie.values().stream().mapToInt(Integer::intValue).sum();
        if (gesamtaugen != 240) {
            throw new IllegalArgumentException("Ein Spiel muss genau 240 Augen ergeben, war aber " + gesamtaugen);
        }
        int nullsumme = punkteKopie.values().stream().mapToInt(Integer::intValue).sum();
        if (nullsumme != 0) {
            throw new IllegalArgumentException("Spielpunkte muessen eine Nullsumme bilden, Summe war " + nullsumme);
        }
        augenProPartei = Map.copyOf(augenKopie);
        spielpunkteProSpieler = Map.copyOf(punkteKopie);
        sonderpunkteProPartei = Map.copyOf(sonderpunkteKopie);
    }

    public int augenVon(Partei partei) {
        return augenProPartei.get(partei);
    }

    public int spielpunkteVon(SpielerPosition spielerPosition) {
        return spielpunkteProSpieler.get(spielerPosition);
    }

    public List<Sonderpunkt> sonderpunkteVon(Partei partei) {
        return sonderpunkteProPartei.get(partei);
    }
}
