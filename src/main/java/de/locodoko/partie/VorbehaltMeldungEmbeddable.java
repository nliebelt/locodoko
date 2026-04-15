package de.locodoko.partie;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import de.locodoko.partie.VorbehaltAnsage;

import java.util.Objects;

/**
 * Repraesentiert eine Vorbehalt-Meldung eines Spielers.
 * Wird als Teil einer JSON-Liste in der Spalte 'vorbehalte' von Spiel gespeichert.
 * Keine JPA-Annotationen — wird per Jackson serialisiert/deserialisiert.
 */
public class VorbehaltMeldungEmbeddable {

    private final SpielerPosition spielerPosition;
    private final VorbehaltAnsage ansage;

    @JsonCreator
    public VorbehaltMeldungEmbeddable(
        @JsonProperty("spielerPosition") SpielerPosition spielerPosition,
        @JsonProperty("ansage") VorbehaltAnsage ansage
    ) {
        this.spielerPosition = Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        this.ansage = Objects.requireNonNull(ansage, "ansage darf nicht null sein");
    }

    public static VorbehaltMeldungEmbeddable neu(SpielerPosition spielerPosition, VorbehaltAnsage ansage) {
        return new VorbehaltMeldungEmbeddable(spielerPosition, ansage);
    }

    @JsonProperty("spielerPosition")
    public SpielerPosition spielerPosition() {
        return spielerPosition;
    }

    @JsonProperty("ansage")
    public VorbehaltAnsage ansage() {
        return ansage;
    }
}
