package de.locodoko.partie;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Objects;

/**
 * JSON-serialisierbarer Eintrag fuer einen Sonderpunkt in der Spalte 'sonderpunkte_json'.
 */
public class SonderpunktJsonEintrag {

    private final Partei partei;
    private final SonderpunktEreignis ereignis;

    @JsonCreator
    public SonderpunktJsonEintrag(
        @JsonProperty("partei") Partei partei,
        @JsonProperty("ereignis") SonderpunktEreignis ereignis
    ) {
        this.partei = Objects.requireNonNull(partei, "partei darf nicht null sein");
        this.ereignis = Objects.requireNonNull(ereignis, "ereignis darf nicht null sein");
    }

    public static SonderpunktJsonEintrag aus(Partei partei, SonderpunktEreignis ereignis) {
        return new SonderpunktJsonEintrag(partei, ereignis);
    }

    @JsonProperty("partei")
    public Partei partei() {
        return partei;
    }

    @JsonProperty("ereignis")
    public SonderpunktEreignis ereignis() {
        return ereignis;
    }
}
