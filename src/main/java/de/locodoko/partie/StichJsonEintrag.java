package de.locodoko.partie;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Objects;

/**
 * JSON-serialisierbarer Eintrag fuer einen abgeschlossenen Stich.
 * Ersetzt die relationalen StichEntity/GespielteKarteEntity-Tabellen — wird als Teil
 * einer JSON-Liste in der Spalte 'stiche_json' von SpielEntity gespeichert.
 */
public class StichJsonEintrag {

    private final int stichNummer;
    private final SpielerPosition aufspielerPosition;
    private final SpielerPosition gewinnerPosition;
    private final int augen;
    private final List<AktuellerStichKarteEmbeddable> gespielteKarten;

    @JsonCreator
    public StichJsonEintrag(
        @JsonProperty("stichNummer") int stichNummer,
        @JsonProperty("aufspielerPosition") SpielerPosition aufspielerPosition,
        @JsonProperty("gewinnerPosition") SpielerPosition gewinnerPosition,
        @JsonProperty("augen") int augen,
        @JsonProperty("gespielteKarten") List<AktuellerStichKarteEmbeddable> gespielteKarten
    ) {
        this.stichNummer = stichNummer;
        this.aufspielerPosition = Objects.requireNonNull(aufspielerPosition, "aufspielerPosition darf nicht null sein");
        this.gewinnerPosition = Objects.requireNonNull(gewinnerPosition, "gewinnerPosition darf nicht null sein");
        this.augen = augen;
        this.gespielteKarten = gespielteKarten != null ? List.copyOf(gespielteKarten) : List.of();
    }

    @JsonProperty("stichNummer")
    public int stichNummer() {
        return stichNummer;
    }

    @JsonProperty("aufspielerPosition")
    public SpielerPosition aufspielerPosition() {
        return aufspielerPosition;
    }

    @JsonProperty("gewinnerPosition")
    public SpielerPosition gewinnerPosition() {
        return gewinnerPosition;
    }

    @JsonProperty("augen")
    public int augen() {
        return augen;
    }

    @JsonProperty("gespielteKarten")
    public List<AktuellerStichKarteEmbeddable> gespielteKarten() {
        return gespielteKarten;
    }
}
