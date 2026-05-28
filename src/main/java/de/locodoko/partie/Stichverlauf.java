package de.locodoko.partie;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Abgeschlossene Stiche eines Spiels in zeitlicher Reihenfolge — unveraenderliches Value Object.
 *
 * <p>Kapselt {@code List<Stich>} mit kopiertem Inhalt.</p>
 */
public final class Stichverlauf {

    private final List<Stich> stiche;

    private Stichverlauf(List<Stich> stiche) {
        this.stiche = List.copyOf(stiche);
    }

    public static Stichverlauf leer() {
        return new Stichverlauf(List.of());
    }

    /**
     * Erstellt eine neue Instanz aus einer bestehenden Liste.
     * Wird auch als Jackson-{@code @JsonCreator} verwendet (via Mixin).
     */
    public static Stichverlauf aus(List<Stich> stiche) {
        Objects.requireNonNull(stiche, "stiche duerfen nicht null sein");
        return new Stichverlauf(stiche);
    }

    /** Gibt eine neue Instanz mit dem angehaengten Stich zurueck. */
    public Stichverlauf mitStich(Stich stich) {
        Objects.requireNonNull(stich, "stich darf nicht null sein");
        List<Stich> neu = new ArrayList<>(stiche);
        neu.add(stich);
        return new Stichverlauf(neu);
    }

    /** Liefert den letzten Stich. */
    public Stich letzter() {
        if (stiche.isEmpty()) {
            throw new IllegalStateException("Keine abgeschlossenen Stiche vorhanden");
        }
        return stiche.getLast();
    }

    public int anzahl() {
        return stiche.size();
    }

    public boolean istLeer() {
        return stiche.isEmpty();
    }

    /**
     * Liefert die interne Liste. Wird auch als Jackson-{@code @JsonValue} verwendet (via Mixin).
     */
    public List<Stich> stiche() {
        return stiche;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Stichverlauf other)) return false;
        return stiche.equals(other.stiche);
    }

    @Override
    public int hashCode() {
        return stiche.hashCode();
    }

    @Override
    public String toString() {
        return "Stichverlauf[anzahl=" + stiche.size() + "]";
    }
}
