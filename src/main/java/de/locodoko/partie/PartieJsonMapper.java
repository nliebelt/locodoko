package de.locodoko.partie;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import de.locodoko.karten.Hand;
import de.locodoko.karten.Karte;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * JSON-Serialisierung fuer die Kollektions-Persistenzfelder von {@link Spiel}.
 *
 * <p>Spring Data JDBC kann {@code Map<K,V>}, {@code List<T>} und {@code Set<T>} mit komplexen
 * Werttypen nicht als skalare JSONB-Spalten persistieren — es behandelt sie als
 * Kind-Entity-Collections. Daher werden diese Felder als Java-{@code transient} (nicht
 * persistiert) deklariert und separat als JSON-Strings ueber {@code @Column String}-Felder
 * gespeichert. Diese Hilfsklasse uebernimmt die Serialisierung und Deserialisierung.</p>
 */
final class PartieJsonMapper {

    private static final ObjectMapper MAPPER = erstelleMapper();

    private PartieJsonMapper() {}

    private static ObjectMapper erstelleMapper() {
        return new ObjectMapper()
                .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
                .addMixIn(Hand.class, HandMixin.class)
                .addMixIn(Stich.class, StichMixin.class)
                .addMixIn(VorbehaltMeldung.class, VorbehaltMeldungMixin.class);
    }

    private abstract static class HandMixin {
        @JsonCreator
        HandMixin(@JsonProperty("karten") Collection<Karte> karten) {}

        @JsonProperty("karten")
        abstract List<Karte> karten();
    }

    private abstract static class StichMixin {
        @JsonCreator
        public static Stich ausPersistiertemStand(
                @JsonProperty("aufspieler") SpielerPosition aufspieler,
                @JsonProperty("gespielteKarten") List<GespielteKarte> gespielteKarten) {
            return null;
        }

        @JsonProperty("aufspieler")
        abstract SpielerPosition aufspieler();

        @JsonProperty("gespielteKarten")
        abstract List<GespielteKarte> gespielteKarten();

        @JsonIgnore
        abstract boolean istVollstaendig();
    }

    private abstract static class VorbehaltMeldungMixin {
        @JsonIgnore
        abstract boolean istVorbehalt();
    }

    // ---- Deserialisierung ----

    static Map<SpielerPosition, Hand> parseHaende(String json) {
        if (json == null || json.isBlank()) return Map.of();
        try {
            return MAPPER.readValue(json, new TypeReference<Map<SpielerPosition, Hand>>() {});
        } catch (Exception e) {
            throw new IllegalStateException("Fehler beim Parsen von haende: " + json, e);
        }
    }

    static List<VorbehaltMeldung> parseVorbehalte(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return MAPPER.readValue(json, new TypeReference<List<VorbehaltMeldung>>() {});
        } catch (Exception e) {
            throw new IllegalStateException("Fehler beim Parsen von vorbehalte: " + json, e);
        }
    }

    static List<Stich> parseStiche(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return MAPPER.readValue(json, new TypeReference<List<Stich>>() {});
        } catch (Exception e) {
            throw new IllegalStateException("Fehler beim Parsen von abgeschlosseneStiche: " + json, e);
        }
    }

    static Set<SpielerPosition> parseBereitsGeschmissen(String json) {
        if (json == null || json.isBlank()) return Set.of();
        try {
            return MAPPER.readValue(json, new TypeReference<Set<SpielerPosition>>() {});
        } catch (Exception e) {
            throw new IllegalStateException("Fehler beim Parsen von bereitsGeschmissen: " + json, e);
        }
    }

    static Set<Partei> parsePflichtAnsagen(String json) {
        if (json == null || json.isBlank()) return Set.of();
        try {
            return MAPPER.readValue(json, new TypeReference<Set<Partei>>() {});
        } catch (Exception e) {
            throw new IllegalStateException("Fehler beim Parsen von pflichtAnsageAusstehend: " + json, e);
        }
    }

    // ---- Serialisierung ----

    static String serializeHaende(Map<SpielerPosition, Hand> haende) {
        try {
            return haende == null ? "{}" : MAPPER.writeValueAsString(haende);
        } catch (Exception e) {
            throw new IllegalStateException("Fehler beim Serialisieren von haende", e);
        }
    }

    static String serializeVorbehalte(List<VorbehaltMeldung> vorbehalte) {
        try {
            return vorbehalte == null ? "[]" : MAPPER.writeValueAsString(vorbehalte);
        } catch (Exception e) {
            throw new IllegalStateException("Fehler beim Serialisieren von vorbehalte", e);
        }
    }

    static String serializeStiche(List<Stich> stiche) {
        try {
            return stiche == null ? "[]" : MAPPER.writeValueAsString(stiche);
        } catch (Exception e) {
            throw new IllegalStateException("Fehler beim Serialisieren von abgeschlosseneStiche", e);
        }
    }

    static String serializeBereitsGeschmissen(Set<SpielerPosition> bereitsGeschmissen) {
        try {
            return bereitsGeschmissen == null ? "[]" : MAPPER.writeValueAsString(bereitsGeschmissen);
        } catch (Exception e) {
            throw new IllegalStateException("Fehler beim Serialisieren von bereitsGeschmissen", e);
        }
    }

    static String serializePflichtAnsagen(Set<Partei> pflichtAnsagen) {
        try {
            return pflichtAnsagen == null ? "[]" : MAPPER.writeValueAsString(pflichtAnsagen);
        } catch (Exception e) {
            throw new IllegalStateException("Fehler beim Serialisieren von pflichtAnsageAusstehend", e);
        }
    }
}
