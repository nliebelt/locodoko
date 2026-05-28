package de.locodoko.partie;

import java.util.Objects;
import java.util.Set;

/**
 * Parteien mit ausstehender Pflichtansage — unveraenderliches Value Object.
 *
 * <p>Kapselt {@code Set<Partei>} mit kopiertem Inhalt.</p>
 */
public final class PflichtAnsagen {

    private final Set<Partei> parteien;

    private PflichtAnsagen(Set<Partei> parteien) {
        this.parteien = Set.copyOf(parteien);
    }

    public static PflichtAnsagen leer() {
        return new PflichtAnsagen(Set.of());
    }

    /**
     * Erstellt eine neue Instanz aus einem bestehenden Set.
     * Leeres oder {@code null} Set ergibt {@link #leer()}.
     * Wird auch als Jackson-{@code @JsonCreator} verwendet (via Mixin).
     */
    public static PflichtAnsagen aus(Set<Partei> parteien) {
        if (parteien == null || parteien.isEmpty()) {
            return leer();
        }
        return new PflichtAnsagen(parteien);
    }

    public boolean istLeer() {
        return parteien.isEmpty();
    }

    public boolean enthaelt(Partei partei) {
        return parteien.contains(partei);
    }

    /**
     * Liefert das interne Set. Wird auch als Jackson-{@code @JsonValue} verwendet (via Mixin).
     */
    public Set<Partei> alsSet() {
        return parteien;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof PflichtAnsagen other)) return false;
        return parteien.equals(other.parteien);
    }

    @Override
    public int hashCode() {
        return parteien.hashCode();
    }

    @Override
    public String toString() {
        return "PflichtAnsagen" + parteien;
    }
}
