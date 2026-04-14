package de.locodoko.partie;

import de.locodoko.karten.Farbe;
import de.locodoko.karten.Hand;
import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartenwert;

import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumSet;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

/**
 * Parteizuordnung aller vier Spieler fuer ein laufendes Spiel.
 *
 * <p>Kapselt, welcher Spieler zu {@link Partei#RE} bzw. {@link Partei#KONTRA} gehoert,
 * und ob diese Zuordnung oeffentlich sichtbar ist (z.B. bei Soli, Hochzeit oder nach
 * einer Ansage). Im Normalspiel ist die Parteizugehoerigkeit anfangs verdeckt;
 * nur der eigene Eintrag ist sicher bekannt.</p>
 *
 * <p>Unveraenderlich: Zuordnungsaenderungen (z.B. Hochzeit-Partnerfindung) erzeugen
 * eine neue Instanz.</p>
 */
public final class Parteien {

    private final Map<SpielerPosition, Partei> parteienNachSpieler;
    private final Set<SpielerPosition> offenFuerAlle;

    private Parteien(Map<SpielerPosition, Partei> parteienNachSpieler, Set<SpielerPosition> offenFuerAlle) {
        this.parteienNachSpieler = Map.copyOf(parteienNachSpieler);
        this.offenFuerAlle = Set.copyOf(offenFuerAlle);
    }

    public static Parteien ausNormalspielHaenden(Map<SpielerPosition, Hand> haende) {
        Objects.requireNonNull(haende, "haende duerfen nicht null sein");
        EnumMap<SpielerPosition, Partei> parteien = new EnumMap<>(SpielerPosition.class);
        for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
            Hand hand = Objects.requireNonNull(haende.get(position), "Es fehlt eine Hand fuer " + position);
            parteien.put(position, hatKreuzDame(hand) ? Partei.RE : Partei.KONTRA);
        }
        long anzahlReSpieler = parteien.values().stream().filter(partei -> partei == Partei.RE).count();
        if (anzahlReSpieler != 2) {
            throw new IllegalStateException("Ein Normalspiel braucht genau zwei Re-Spieler, gefunden: " + anzahlReSpieler);
        }
        return new Parteien(parteien, EnumSet.noneOf(SpielerPosition.class));
    }

    public static Parteien ausSolo(SpielerPosition soloSpieler) {
        Objects.requireNonNull(soloSpieler, "soloSpieler darf nicht null sein");
        EnumMap<SpielerPosition, Partei> parteien = new EnumMap<>(SpielerPosition.class);
        for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
            parteien.put(position, position == soloSpieler ? Partei.RE : Partei.KONTRA);
        }
        return new Parteien(parteien, EnumSet.allOf(SpielerPosition.class));
    }

    public static Parteien ausHochzeit(SpielerPosition hochzeitSpieler) {
        Objects.requireNonNull(hochzeitSpieler, "hochzeitSpieler darf nicht null sein");
        EnumMap<SpielerPosition, Partei> parteien = new EnumMap<>(SpielerPosition.class);
        for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
            parteien.put(position, position == hochzeitSpieler ? Partei.RE : Partei.KONTRA);
        }
        return new Parteien(parteien, EnumSet.of(hochzeitSpieler));
    }

    public static Parteien ausArmut(SpielerPosition armutSpieler) {
        Objects.requireNonNull(armutSpieler, "armutSpieler darf nicht null sein");
        EnumMap<SpielerPosition, Partei> parteien = new EnumMap<>(SpielerPosition.class);
        for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
            parteien.put(position, position == armutSpieler ? Partei.RE : Partei.KONTRA);
        }
        return new Parteien(parteien, EnumSet.of(armutSpieler));
    }

    public static Parteien ausParteiMap(Map<SpielerPosition, Partei> parteienNachSpieler) {
        Objects.requireNonNull(parteienNachSpieler, "parteienNachSpieler duerfen nicht null sein");
        return new Parteien(parteienNachSpieler, EnumSet.noneOf(SpielerPosition.class));
    }

    public Partei parteiVon(SpielerPosition spielerPosition) {
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        Partei partei = parteienNachSpieler.get(spielerPosition);
        if (partei == null) {
            throw new IllegalArgumentException("Keine Partei fuer " + spielerPosition + " vorhanden");
        }
        return partei;
    }

    public List<SpielerPosition> spielerVon(Partei partei) {
        Objects.requireNonNull(partei, "partei darf nicht null sein");
        List<SpielerPosition> spieler = new ArrayList<>();
        for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
            if (parteienNachSpieler.get(position) == partei) {
                spieler.add(position);
            }
        }
        return List.copyOf(spieler);
    }

    public Optional<Partei> sichtAufPartei(SpielerPosition beobachter, SpielerPosition ziel) {
        Objects.requireNonNull(beobachter, "beobachter darf nicht null sein");
        Objects.requireNonNull(ziel, "ziel darf nicht null sein");
        return beobachter == ziel || offenFuerAlle.contains(ziel) ? Optional.of(parteiVon(ziel)) : Optional.empty();
    }

    public Map<SpielerPosition, Partei> alsMap() {
        return parteienNachSpieler;
    }

    public Parteien mitPartei(SpielerPosition spielerPosition, Partei partei) {
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        Objects.requireNonNull(partei, "partei darf nicht null sein");
        EnumMap<SpielerPosition, Partei> neueParteien = new EnumMap<>(SpielerPosition.class);
        neueParteien.putAll(parteienNachSpieler);
        neueParteien.put(spielerPosition, partei);
        return new Parteien(neueParteien, offenFuerAlle);
    }

    public Parteien mitOffenenParteienFuerAlle(Collection<SpielerPosition> spielerPositionen) {
        Objects.requireNonNull(spielerPositionen, "spielerPositionen duerfen nicht null sein");
        EnumSet<SpielerPosition> neuesOffenFuerAlle = offenFuerAlle.isEmpty()
            ? EnumSet.noneOf(SpielerPosition.class)
            : EnumSet.copyOf(offenFuerAlle);
        neuesOffenFuerAlle.addAll(spielerPositionen);
        return new Parteien(parteienNachSpieler, neuesOffenFuerAlle);
    }

    private static boolean hatKreuzDame(Hand hand) {
        Collection<Karte> karten = hand.karten();
        return karten.stream().anyMatch(karte -> karte.farbe() == Farbe.KREUZ && karte.wert() == Kartenwert.DAME);
    }
}
