package de.locodoko.partie;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Objects;

/**
 * JSON-serialisierbarer Eintrag fuer eine Spielerhand.
 * Ersetzt die relationale HandEntity-Tabelle — wird als Teil einer JSON-Liste
 * in der Spalte 'haende_json' von SpielEntity gespeichert.
 */
public class HandJsonEintrag {

    private final SpielerPosition spielerPosition;
    private final List<HandKarteEmbeddable> karten;

    @JsonCreator
    public HandJsonEintrag(
        @JsonProperty("spielerPosition") SpielerPosition spielerPosition,
        @JsonProperty("karten") List<HandKarteEmbeddable> karten
    ) {
        this.spielerPosition = Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        this.karten = karten != null ? List.copyOf(karten) : List.of();
    }

    public static HandJsonEintrag aus(SpielerPosition spielerPosition, List<de.locodoko.karten.Karte> karten) {
        return new HandJsonEintrag(
            spielerPosition,
            karten.stream().map(HandKarteEmbeddable::aus).toList()
        );
    }

    @JsonProperty("spielerPosition")
    public SpielerPosition spielerPosition() {
        return spielerPosition;
    }

    @JsonProperty("karten")
    public List<HandKarteEmbeddable> karten() {
        return karten;
    }
}
