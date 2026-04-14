package de.locodoko.partie;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import de.locodoko.partie.Ansage;

import java.util.Objects;

/**
 * Repraesentiert ein Ansage-Ereignis waehrend eines Spiels.
 * Wird als Teil einer JSON-Liste in der Spalte 'ansagen' von SpielEntity gespeichert.
 * Keine JPA-Annotationen — wird per Jackson serialisiert/deserialisiert.
 */
public class AnsageEreignisEmbeddable {

    private final SpielerPosition spielerPosition;
    private final Ansage ansage;

    @JsonCreator
    public AnsageEreignisEmbeddable(
        @JsonProperty("spielerPosition") SpielerPosition spielerPosition,
        @JsonProperty("ansage") Ansage ansage
    ) {
        this.spielerPosition = Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        this.ansage = Objects.requireNonNull(ansage, "ansage darf nicht null sein");
    }

    public static AnsageEreignisEmbeddable neu(SpielerPosition spielerPosition, Ansage ansage) {
        return new AnsageEreignisEmbeddable(spielerPosition, ansage);
    }

    @JsonProperty("spielerPosition")
    public SpielerPosition spielerPosition() {
        return spielerPosition;
    }

    @JsonProperty("ansage")
    public Ansage ansage() {
        return ansage;
    }
}
