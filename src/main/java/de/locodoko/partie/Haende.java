package de.locodoko.partie;

import de.locodoko.karten.Hand;

import java.util.EnumMap;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Handverteilung aller Spieler — unveraenderliches Value Object.
 *
 * <p>Kapselt {@code Map<SpielerPosition, Hand>} mit kopiertem Inhalt.
 * Mutierende Operationen geben eine neue Instanz zurueck.</p>
 */
public final class Haende {

    private final Map<SpielerPosition, Hand> haende;

    private Haende(Map<SpielerPosition, Hand> haende) {
        this.haende = Map.copyOf(haende);
    }

    public static Haende leer() {
        return new Haende(Map.of());
    }

    /**
     * Erstellt eine neue Haende-Instanz aus einer bestehenden Map.
     * Wird auch als Jackson-{@code @JsonCreator} verwendet (via Mixin in JsonbConverter).
     */
    public static Haende aus(Map<SpielerPosition, Hand> haende) {
        Objects.requireNonNull(haende, "haende duerfen nicht null sein");
        return new Haende(haende);
    }

    /** Liefert die Hand des Spielers an der angegebenen Position. */
    public Hand handVon(SpielerPosition position) {
        Objects.requireNonNull(position, "position darf nicht null sein");
        Hand hand = haende.get(position);
        if (hand == null) {
            throw new IllegalArgumentException("Keine Hand fuer Position: " + position);
        }
        return hand;
    }

    /** Gibt eine neue Haende-Instanz zurueck, bei der die Hand der Position ersetzt wurde. */
    public Haende mitErsetzterHand(SpielerPosition position, Hand neueHand) {
        Objects.requireNonNull(position, "position darf nicht null sein");
        Objects.requireNonNull(neueHand, "neueHand darf nicht null sein");
        EnumMap<SpielerPosition, Hand> kopie = new EnumMap<>(SpielerPosition.class);
        kopie.putAll(haende);
        kopie.put(position, neueHand);
        return new Haende(kopie);
    }

    public boolean enthaelt(SpielerPosition position) {
        return haende.containsKey(position);
    }

    public Set<SpielerPosition> positionen() {
        return haende.keySet();
    }

    /**
     * Liefert die interne Map. Wird auch als Jackson-{@code @JsonValue} verwendet (via Mixin).
     */
    public Map<SpielerPosition, Hand> alsMap() {
        return haende;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Haende other)) return false;
        return haende.equals(other.haende);
    }

    @Override
    public int hashCode() {
        return haende.hashCode();
    }

    @Override
    public String toString() {
        return "Haende" + haende;
    }
}
