package de.locodoko.tisch.persistenz;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import de.locodoko.karten.Hand;
import de.locodoko.karten.Karte;
import de.locodoko.karten.Spielregeln;
import de.locodoko.partie.AnsageEreignis;
import de.locodoko.partie.Ansagen;
import de.locodoko.partie.ArmutStatus;
import de.locodoko.partie.GespielteKarte;
import de.locodoko.partie.HochzeitStatus;
import de.locodoko.partie.Partei;
import de.locodoko.partie.Parteien;
import de.locodoko.partie.SpielerPosition;
import de.locodoko.partie.Stich;
import de.locodoko.partie.VorbehaltAnsage;
import de.locodoko.partie.VorbehaltMeldung;
import org.postgresql.util.PGobject;
import org.springframework.core.convert.converter.Converter;
import org.springframework.data.convert.ReadingConverter;
import org.springframework.data.convert.WritingConverter;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Alle JSONB-Converter-Paare fuer Spring Data JDBC.
 *
 * <p>Je ein {@link WritingConverter} (Domain-VO → PGobject) und {@link ReadingConverter}
 * (PGobject → Domain-VO) pro JSONB-Spalte. Jackson-Mixins im privaten Bereich dieser Klasse
 * steuern die Serialisierung fuer nicht-Record-Domain-Typen, ohne diese mit Jackson-Annotationen
 * zu belasten. Registrierung erfolgt per {@link JsonbConverterKonfiguration}.</p>
 *
 * <p>Records ({@code VorbehaltMeldung}, {@code AnsageEreignis}, {@code GespielteKarte},
 * {@code Karte}, {@code ArmutStatus}, {@code HochzeitStatus}, {@code Spielregeln}) werden
 * von Jackson 2.12+ nativ unterstuetzt und benoetigen keine Mixins.</p>
 */
public final class JsonbConverter {

    private JsonbConverter() {}

    // ---- Jackson-Mixins (nur fuer nicht-Record-Typen noetig) ----

    /** Mixin fuer {@link Hand}: karten()-Getter und einziger Konstruktor als JsonCreator. */
    private abstract static class HandMixin {
        @JsonCreator
        HandMixin(@JsonProperty("karten") Collection<Karte> karten) {}

        @JsonProperty("karten")
        abstract List<Karte> karten();
    }

    /** Mixin fuer {@link Stich}: Factory-Methode als JsonCreator, Getter als Properties. */
    private abstract static class StichMixin {
        @JsonCreator
        public static Stich ausPersistiertemStand(
                @JsonProperty("aufspieler") SpielerPosition aufspieler,
                @JsonProperty("gespielteKarten") List<GespielteKarte> gespielteKarten) {
            return null; // Mixin-Koerper irrelevant — nur Annotationen zaehlen
        }

        @JsonProperty("aufspieler")
        abstract SpielerPosition aufspieler();

        @JsonProperty("gespielteKarten")
        abstract List<GespielteKarte> gespielteKarten();

        /** Berechnetes Feld — nicht persistieren. "ist" wird von Jackson als "is"-Prefix erkannt. */
        @JsonIgnore
        abstract boolean istVollstaendig();
    }

    /**
     * Mixin fuer {@link VorbehaltMeldung}: Unterdrückt istVorbehalt(),
     * das Jackson faelschlicherweise als "is"-Prefix-Getter erkennt.
     */
    private abstract static class VorbehaltMeldungMixin {
        /** Berechnetes Feld — nicht persistieren. */
        @JsonIgnore
        abstract boolean istVorbehalt();
    }

    /** Mixin fuer {@link Ansagen}: Factory-Methode als JsonCreator, Getter als Property. */
    private abstract static class AnsagenMixin {
        @JsonCreator
        public static Ansagen ausEreignissen(
                @JsonProperty("ereignisse") List<AnsageEreignis> ereignisse) {
            return null;
        }

        @JsonProperty("ereignisse")
        abstract List<AnsageEreignis> ereignisse();
    }

    /**
     * Mixin fuer {@link Parteien}: Factory-Methode als JsonCreator,
     * alsMap() unter "parteienNachSpieler", offenFuerAlle() als gleichnamige Property.
     */
    private abstract static class ParteienMixin {
        @JsonCreator
        public static Parteien ausPersistiertemStand(
                @JsonProperty("parteienNachSpieler") Map<SpielerPosition, Partei> parteienNachSpieler,
                @JsonProperty("offenFuerAlle") Set<SpielerPosition> offenFuerAlle) {
            return null;
        }

        @JsonProperty("parteienNachSpieler")
        abstract Map<SpielerPosition, Partei> alsMap();

        @JsonProperty("offenFuerAlle")
        abstract Set<SpielerPosition> offenFuerAlle();
    }

    // ---- ObjectMapper-Konfiguration ----

    /**
     * Konfiguriert einen ObjectMapper mit allen noetigen Mixin-Registrierungen fuer
     * die Domain-VO-Typen. Wird von {@link JsonbConverterKonfiguration} aufgerufen.
     */
    static ObjectMapper konfiguriereObjectMapper(ObjectMapper basis) {
        return basis.copy()
                .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
                .addMixIn(Hand.class, HandMixin.class)
                .addMixIn(Stich.class, StichMixin.class)
                .addMixIn(Ansagen.class, AnsagenMixin.class)
                .addMixIn(Parteien.class, ParteienMixin.class)
                .addMixIn(VorbehaltMeldung.class, VorbehaltMeldungMixin.class);
    }

    // ---- Hilfs-Methoden ----

    private static PGobject toPGobject(ObjectMapper mapper, Object wert) {
        try {
            PGobject pgObject = new PGobject();
            pgObject.setType("jsonb");
            pgObject.setValue(mapper.writeValueAsString(wert));
            return pgObject;
        } catch (Exception e) {
            throw new IllegalStateException(
                    "JSONB-Serialisierung fehlgeschlagen fuer " + wert.getClass().getSimpleName(), e);
        }
    }

    private static <T> T fromPGobject(ObjectMapper mapper, PGobject quelle, Class<T> typ) {
        try {
            return mapper.readValue(quelle.getValue(), typ);
        } catch (Exception e) {
            throw new IllegalStateException(
                    "JSONB-Deserialisierung fehlgeschlagen: " + quelle.getValue(), e);
        }
    }

    private static <T> T fromPGobject(ObjectMapper mapper, PGobject quelle, TypeReference<T> typReferenz) {
        try {
            return mapper.readValue(quelle.getValue(), typReferenz);
        } catch (Exception e) {
            throw new IllegalStateException(
                    "JSONB-Deserialisierung fehlgeschlagen: " + quelle.getValue(), e);
        }
    }

    // ---- Converter-Paare (11 Paare = 22 Klassen) ----

    /** haende: Map&lt;SpielerPosition, Hand&gt; ↔ JSONB */
    @WritingConverter
    public static class HaendeSchreibConverter implements Converter<Map<SpielerPosition, Hand>, PGobject> {
        private final ObjectMapper mapper;
        public HaendeSchreibConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public PGobject convert(Map<SpielerPosition, Hand> source) { return toPGobject(mapper, source); }
    }

    @ReadingConverter
    public static class HaendeLeseConverter implements Converter<PGobject, Map<SpielerPosition, Hand>> {
        private final ObjectMapper mapper;
        public HaendeLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public Map<SpielerPosition, Hand> convert(PGobject source) {
            return fromPGobject(mapper, source, new TypeReference<Map<SpielerPosition, Hand>>() {});
        }
    }

    /** aktueller_stich: Stich ↔ JSONB (nullable — Spring Data JDBC uebergibt nur non-null-Werte) */
    @WritingConverter
    public static class StichSchreibConverter implements Converter<Stich, PGobject> {
        private final ObjectMapper mapper;
        public StichSchreibConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public PGobject convert(Stich source) { return toPGobject(mapper, source); }
    }

    @ReadingConverter
    public static class StichLeseConverter implements Converter<PGobject, Stich> {
        private final ObjectMapper mapper;
        public StichLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public Stich convert(PGobject source) { return fromPGobject(mapper, source, Stich.class); }
    }

    /** abgeschlossene_stiche: List&lt;Stich&gt; ↔ JSONB */
    @WritingConverter
    public static class StichListeSchreibConverter implements Converter<List<Stich>, PGobject> {
        private final ObjectMapper mapper;
        public StichListeSchreibConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public PGobject convert(List<Stich> source) { return toPGobject(mapper, source); }
    }

    @ReadingConverter
    public static class StichListeLeseConverter implements Converter<PGobject, List<Stich>> {
        private final ObjectMapper mapper;
        public StichListeLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public List<Stich> convert(PGobject source) {
            return fromPGobject(mapper, source, new TypeReference<List<Stich>>() {});
        }
    }

    /** vorbehalt_meldungen: List&lt;VorbehaltMeldung&gt; ↔ JSONB */
    @WritingConverter
    public static class VorbehaltMeldungListeSchreibConverter
            implements Converter<List<VorbehaltMeldung>, PGobject> {
        private final ObjectMapper mapper;
        public VorbehaltMeldungListeSchreibConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public PGobject convert(List<VorbehaltMeldung> source) { return toPGobject(mapper, source); }
    }

    @ReadingConverter
    public static class VorbehaltMeldungListeLeseConverter
            implements Converter<PGobject, List<VorbehaltMeldung>> {
        private final ObjectMapper mapper;
        public VorbehaltMeldungListeLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public List<VorbehaltMeldung> convert(PGobject source) {
            return fromPGobject(mapper, source, new TypeReference<List<VorbehaltMeldung>>() {});
        }
    }

    /** ansage_ereignisse: Ansagen ↔ JSONB */
    @WritingConverter
    public static class AnsagenSchreibConverter implements Converter<Ansagen, PGobject> {
        private final ObjectMapper mapper;
        public AnsagenSchreibConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public PGobject convert(Ansagen source) { return toPGobject(mapper, source); }
    }

    @ReadingConverter
    public static class AnsagenLeseConverter implements Converter<PGobject, Ansagen> {
        private final ObjectMapper mapper;
        public AnsagenLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public Ansagen convert(PGobject source) { return fromPGobject(mapper, source, Ansagen.class); }
    }

    /** partei_zuordnungen: Parteien ↔ JSONB */
    @WritingConverter
    public static class ParteienSchreibConverter implements Converter<Parteien, PGobject> {
        private final ObjectMapper mapper;
        public ParteienSchreibConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public PGobject convert(Parteien source) { return toPGobject(mapper, source); }
    }

    @ReadingConverter
    public static class ParteienLeseConverter implements Converter<PGobject, Parteien> {
        private final ObjectMapper mapper;
        public ParteienLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public Parteien convert(PGobject source) { return fromPGobject(mapper, source, Parteien.class); }
    }

    /** bereits_geschmissen: Set&lt;SpielerPosition&gt; ↔ JSONB */
    @WritingConverter
    public static class SpielerPositionSetSchreibConverter
            implements Converter<Set<SpielerPosition>, PGobject> {
        private final ObjectMapper mapper;
        public SpielerPositionSetSchreibConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public PGobject convert(Set<SpielerPosition> source) { return toPGobject(mapper, source); }
    }

    @ReadingConverter
    public static class SpielerPositionSetLeseConverter
            implements Converter<PGobject, Set<SpielerPosition>> {
        private final ObjectMapper mapper;
        public SpielerPositionSetLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public Set<SpielerPosition> convert(PGobject source) {
            return fromPGobject(mapper, source, new TypeReference<Set<SpielerPosition>>() {});
        }
    }

    /** pflicht_ansage_ausstehend: Set&lt;Partei&gt; ↔ JSONB */
    @WritingConverter
    public static class ParteiSetSchreibConverter implements Converter<Set<Partei>, PGobject> {
        private final ObjectMapper mapper;
        public ParteiSetSchreibConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public PGobject convert(Set<Partei> source) { return toPGobject(mapper, source); }
    }

    @ReadingConverter
    public static class ParteiSetLeseConverter implements Converter<PGobject, Set<Partei>> {
        private final ObjectMapper mapper;
        public ParteiSetLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public Set<Partei> convert(PGobject source) {
            return fromPGobject(mapper, source, new TypeReference<Set<Partei>>() {});
        }
    }

    /** armut_status: ArmutStatus ↔ JSONB */
    @WritingConverter
    public static class ArmutStatusSchreibConverter implements Converter<ArmutStatus, PGobject> {
        private final ObjectMapper mapper;
        public ArmutStatusSchreibConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public PGobject convert(ArmutStatus source) { return toPGobject(mapper, source); }
    }

    @ReadingConverter
    public static class ArmutStatusLeseConverter implements Converter<PGobject, ArmutStatus> {
        private final ObjectMapper mapper;
        public ArmutStatusLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public ArmutStatus convert(PGobject source) {
            return fromPGobject(mapper, source, ArmutStatus.class);
        }
    }

    /** hochzeit_status: HochzeitStatus ↔ JSONB */
    @WritingConverter
    public static class HochzeitStatusSchreibConverter implements Converter<HochzeitStatus, PGobject> {
        private final ObjectMapper mapper;
        public HochzeitStatusSchreibConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public PGobject convert(HochzeitStatus source) { return toPGobject(mapper, source); }
    }

    @ReadingConverter
    public static class HochzeitStatusLeseConverter implements Converter<PGobject, HochzeitStatus> {
        private final ObjectMapper mapper;
        public HochzeitStatusLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public HochzeitStatus convert(PGobject source) {
            return fromPGobject(mapper, source, HochzeitStatus.class);
        }
    }

    /** spielregeln (in partie): Spielregeln ↔ JSONB */
    @WritingConverter
    public static class SpielregelnSchreibConverter implements Converter<Spielregeln, PGobject> {
        private final ObjectMapper mapper;
        public SpielregelnSchreibConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public PGobject convert(Spielregeln source) { return toPGobject(mapper, source); }
    }

    @ReadingConverter
    public static class SpielregelnLeseConverter implements Converter<PGobject, Spielregeln> {
        private final ObjectMapper mapper;
        public SpielregelnLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public Spielregeln convert(PGobject source) {
            return fromPGobject(mapper, source, Spielregeln.class);
        }
    }
}
