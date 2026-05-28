package de.locodoko.partie;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Gesammelte Vorbehalt-Meldungen eines Spiels — unveraenderliches Value Object.
 *
 * <p>Kapselt {@code List<VorbehaltMeldung>} mit kopiertem Inhalt.</p>
 */
public final class VorbehaltMeldungen {

    private final List<VorbehaltMeldung> meldungen;

    private VorbehaltMeldungen(List<VorbehaltMeldung> meldungen) {
        this.meldungen = List.copyOf(meldungen);
    }

    public static VorbehaltMeldungen leer() {
        return new VorbehaltMeldungen(List.of());
    }

    /**
     * Erstellt eine neue Instanz aus einer bestehenden Liste.
     * Wird auch als Jackson-{@code @JsonCreator} verwendet (via Mixin).
     */
    public static VorbehaltMeldungen aus(List<VorbehaltMeldung> meldungen) {
        Objects.requireNonNull(meldungen, "meldungen duerfen nicht null sein");
        return new VorbehaltMeldungen(meldungen);
    }

    /** Gibt eine neue Instanz mit der angehaengten Meldung zurueck. */
    public VorbehaltMeldungen mitMeldung(VorbehaltMeldung meldung) {
        Objects.requireNonNull(meldung, "meldung darf nicht null sein");
        List<VorbehaltMeldung> neu = new ArrayList<>(meldungen);
        neu.add(meldung);
        return new VorbehaltMeldungen(neu);
    }

    public int anzahl() {
        return meldungen.size();
    }

    public boolean istLeer() {
        return meldungen.isEmpty();
    }

    /**
     * Liefert die interne Liste. Wird auch als Jackson-{@code @JsonValue} verwendet (via Mixin).
     */
    public List<VorbehaltMeldung> meldungen() {
        return meldungen;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof VorbehaltMeldungen other)) return false;
        return meldungen.equals(other.meldungen);
    }

    @Override
    public int hashCode() {
        return meldungen.hashCode();
    }

    @Override
    public String toString() {
        return "VorbehaltMeldungen" + meldungen;
    }
}
