package de.locodoko.partie;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import de.locodoko.karten.Farbe;
import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartenwert;

import java.util.Objects;

/**
 * Repraesentiert eine Karte im aktuell laufenden Stich.
 * Wird als Teil einer JSON-Liste in der Spalte 'aktueller_stich_karten' von Spiel gespeichert.
 * Keine JPA-Annotationen — wird per Jackson serialisiert/deserialisiert.
 */
public class AktuellerStichKarteEmbeddable {

    private final SpielerPosition spielerPosition;
    private final Farbe farbe;
    private final Kartenwert wert;
    private final int exemplarIndex;
    private final int reihenfolge;

    @JsonCreator
    public AktuellerStichKarteEmbeddable(
        @JsonProperty("spielerPosition") SpielerPosition spielerPosition,
        @JsonProperty("farbe") Farbe farbe,
        @JsonProperty("wert") Kartenwert wert,
        @JsonProperty("exemplarIndex") int exemplarIndex,
        @JsonProperty("reihenfolge") int reihenfolge
    ) {
        this.spielerPosition = Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        this.farbe = Objects.requireNonNull(farbe, "farbe darf nicht null sein");
        this.wert = Objects.requireNonNull(wert, "wert darf nicht null sein");
        this.exemplarIndex = exemplarIndex;
        this.reihenfolge = reihenfolge;
    }

    public static AktuellerStichKarteEmbeddable aus(GespielteKarte gespielteKarte) {
        Objects.requireNonNull(gespielteKarte, "gespielteKarte darf nicht null sein");
        Karte karte = Objects.requireNonNull(gespielteKarte.karte(), "karte darf nicht null sein");
        return new AktuellerStichKarteEmbeddable(
            gespielteKarte.spieler(),
            karte.farbe(),
            karte.wert(),
            karte.exemplarIndex(),
            gespielteKarte.reihenfolge()
        );
    }

    @JsonProperty("spielerPosition")
    public SpielerPosition spielerPosition() {
        return spielerPosition;
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

    @JsonProperty("reihenfolge")
    public int reihenfolge() {
        return reihenfolge;
    }
}
