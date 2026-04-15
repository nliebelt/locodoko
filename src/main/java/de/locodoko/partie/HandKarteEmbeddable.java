package de.locodoko.partie;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import de.locodoko.karten.Farbe;
import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartenwert;

/**
 * Repraesentiert eine Karte in einer Spielerhand.
 * Wird als Teil einer JSON-Liste in HandJsonEintrag gespeichert.
 * Keine JPA-Annotationen — wird per Jackson serialisiert/deserialisiert.
 */
public class HandKarteEmbeddable {

    private final Farbe farbe;
    private final Kartenwert wert;
    private final int exemplarIndex;

    @JsonCreator
    public HandKarteEmbeddable(
        @JsonProperty("farbe") Farbe farbe,
        @JsonProperty("wert") Kartenwert wert,
        @JsonProperty("exemplarIndex") int exemplarIndex
    ) {
        this.farbe = farbe;
        this.wert = wert;
        this.exemplarIndex = exemplarIndex;
    }

    public static HandKarteEmbeddable aus(Karte karte) {
        return new HandKarteEmbeddable(karte.farbe(), karte.wert(), karte.exemplarIndex());
    }

    @JsonProperty("farbe")
    public Farbe farbe() {
        return farbe;
    }

    @JsonProperty("wert")
    public Kartenwert wert() {
        return wert;
    }

    @JsonProperty("exemplarIndex")
    public int exemplarIndex() {
        return exemplarIndex;
    }
}
