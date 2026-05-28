package de.locodoko.partie;

import java.util.EnumSet;
import java.util.Objects;
import java.util.Set;

/**
 * Spieler die in diesem Spiel bereits geschmissen haben — unveraenderliches Value Object.
 *
 * <p>Kapselt {@code Set<SpielerPosition>} mit kopiertem Inhalt.</p>
 */
public final class GeschmisseneSpieler {

    private final Set<SpielerPosition> positionen;

    private GeschmisseneSpieler(Set<SpielerPosition> positionen) {
        this.positionen = Set.copyOf(positionen);
    }

    public static GeschmisseneSpieler leer() {
        return new GeschmisseneSpieler(Set.of());
    }

    /**
     * Erstellt eine neue Instanz aus einem bestehenden Set.
     * Wird auch als Jackson-{@code @JsonCreator} verwendet (via Mixin).
     */
    public static GeschmisseneSpieler aus(Set<SpielerPosition> positionen) {
        Objects.requireNonNull(positionen, "positionen duerfen nicht null sein");
        return new GeschmisseneSpieler(positionen);
    }

    /** Gibt eine neue Instanz mit der hinzugefuegten Position zurueck. */
    public GeschmisseneSpieler mitPosition(SpielerPosition position) {
        Objects.requireNonNull(position, "position darf nicht null sein");
        EnumSet<SpielerPosition> neu = positionen.isEmpty()
            ? EnumSet.noneOf(SpielerPosition.class)
            : EnumSet.copyOf(positionen);
        neu.add(position);
        return new GeschmisseneSpieler(neu);
    }

    public boolean enthaelt(SpielerPosition position) {
        return positionen.contains(position);
    }

    /**
     * Liefert das interne Set. Wird auch als Jackson-{@code @JsonValue} verwendet (via Mixin).
     */
    public Set<SpielerPosition> alsSet() {
        return positionen;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof GeschmisseneSpieler other)) return false;
        return positionen.equals(other.positionen);
    }

    @Override
    public int hashCode() {
        return positionen.hashCode();
    }

    @Override
    public String toString() {
        return "GeschmisseneSpieler" + positionen;
    }
}
