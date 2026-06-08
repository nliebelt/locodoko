package de.locodoko.tisch.persistenz;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonValue;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.BeanDescription;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.cfg.MapperConfig;
import com.fasterxml.jackson.databind.introspect.AccessorNamingStrategy;
import com.fasterxml.jackson.databind.introspect.AnnotatedClass;
import com.fasterxml.jackson.databind.introspect.AnnotatedField;
import com.fasterxml.jackson.databind.introspect.AnnotatedMethod;
import com.fasterxml.jackson.databind.introspect.DefaultAccessorNamingStrategy;
import de.locodoko.karten.BubensoloTrumpfOrdnung;
import de.locodoko.karten.DamensoloTrumpfOrdnung;
import de.locodoko.karten.Farbe;
import de.locodoko.karten.FleischlosTrumpfOrdnung;
import de.locodoko.karten.Hand;
import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartendeck;
import de.locodoko.karten.NormaleTrumpfOrdnung;
import de.locodoko.karten.SchweinchenTrumpfOrdnung;
import de.locodoko.karten.Spielregeln;
import de.locodoko.karten.TrumpfOrdnung;
import de.locodoko.karten.VariableTrumpfsoloTrumpfOrdnung;
import de.locodoko.partie.AnsageEreignis;
import de.locodoko.partie.Ansagen;
import de.locodoko.partie.ArmutStatus;
import de.locodoko.partie.GeschmisseneSpieler;
import de.locodoko.partie.GespielteKarte;
import de.locodoko.partie.Haende;
import de.locodoko.partie.HochzeitStatus;
import de.locodoko.partie.Partei;
import de.locodoko.partie.Parteien;
import de.locodoko.partie.PflichtAnsagen;
import de.locodoko.partie.SpielerPosition;
import de.locodoko.partie.Spielergebnis;
import de.locodoko.partie.Spielphase;
import de.locodoko.partie.Stich;
import de.locodoko.partie.Stichverlauf;
import de.locodoko.partie.VorbehaltAnsage;
import de.locodoko.partie.VorbehaltMeldung;
import de.locodoko.partie.VorbehaltMeldungen;
import org.postgresql.util.PGobject;
import org.springframework.core.convert.converter.Converter;
import org.springframework.data.convert.ReadingConverter;
import org.springframework.data.convert.WritingConverter;

import java.nio.charset.StandardCharsets;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Alle JSONB-Converter-Paare fuer Spring Data JDBC.
 *
 * <p>Je ein {@link WritingConverter} (Domain-VO → String/JSON) und {@link ReadingConverter}
 * (PGobject oder String → Domain-VO) pro JSONB-Spalte. WritingConverters geben einen
 * einfachen JSON-String zurueck — PostgreSQL akzeptiert das fuer JSONB-Spalten, und H2
 * (Testdatenbank im PostgreSQL-Modus) ebenso. ReadingConverters existieren doppelt:
 * einmal fuer PGobject (PostgreSQL gibt das zurueck) und einmal fuer String (H2 gibt das
 * zurueck). Jackson-Mixins im privaten Bereich dieser Klasse steuern die Serialisierung
 * fuer nicht-Record-Domain-Typen, ohne diese mit Jackson-Annotationen zu belasten.
 * Registrierung erfolgt per {@link JsonbConverterKonfiguration}.</p>
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

    /** Mixin fuer {@link Haende}: JSON-Wert ist die interne Map; Factory-Methode als JsonCreator. */
    private abstract static class HaendeMixin {
        @JsonCreator
        public static Haende aus(Map<SpielerPosition, Hand> haende) { return null; }

        @JsonValue
        abstract Map<SpielerPosition, Hand> alsMap();
    }

    /** Mixin fuer {@link VorbehaltMeldungen}: JSON-Wert ist die interne Liste. */
    private abstract static class VorbehaltMeldungenMixin {
        @JsonCreator
        public static VorbehaltMeldungen aus(List<VorbehaltMeldung> meldungen) { return null; }

        @JsonValue
        abstract List<VorbehaltMeldung> meldungen();
    }

    /** Mixin fuer {@link Stichverlauf}: JSON-Wert ist die interne Liste. */
    private abstract static class StichverlaufMixin {
        @JsonCreator
        public static Stichverlauf aus(List<Stich> stiche) { return null; }

        @JsonValue
        abstract List<Stich> stiche();
    }

    /** Mixin fuer {@link GeschmisseneSpieler}: JSON-Wert ist das interne Set. */
    private abstract static class GeschmisseneSpielerMixin {
        @JsonCreator
        public static GeschmisseneSpieler aus(Set<SpielerPosition> positionen) { return null; }

        @JsonValue
        abstract Set<SpielerPosition> alsSet();
    }

    /** Mixin fuer {@link PflichtAnsagen}: JSON-Wert ist das interne Set. */
    private abstract static class PflichtAnsagenMixin {
        @JsonCreator
        public static PflichtAnsagen aus(Set<Partei> parteien) { return null; }

        @JsonValue
        abstract Set<Partei> alsSet();
    }

    // ---- Mixins fuer TrumpfOrdnung-Implementierungen ----

    /** Mixin fuer {@link NormaleTrumpfOrdnung}: serialisiert als {"spielregeln": {...}}. */
    private abstract static class NormaleTrumpfOrdnungMixin {
        @JsonCreator
        NormaleTrumpfOrdnungMixin(@JsonProperty("spielregeln") Spielregeln spielregeln) {}

        @JsonProperty("spielregeln")
        abstract Spielregeln spielregeln();
    }

    /** Mixin fuer {@link SchweinchenTrumpfOrdnung}: serialisiert als {"spielregeln": {...}}. */
    private abstract static class SchweinchenTrumpfOrdnungMixin {
        @JsonCreator
        SchweinchenTrumpfOrdnungMixin(@JsonProperty("spielregeln") Spielregeln spielregeln) {}

        @JsonProperty("spielregeln")
        abstract Spielregeln spielregeln();
    }

    /** Mixin fuer {@link BubensoloTrumpfOrdnung}: keine Felder, no-arg. */
    private abstract static class BubensoloTrumpfOrdnungMixin {
        @JsonCreator
        BubensoloTrumpfOrdnungMixin() {}
    }

    /** Mixin fuer {@link DamensoloTrumpfOrdnung}: keine Felder, no-arg. */
    private abstract static class DamensoloTrumpfOrdnungMixin {
        @JsonCreator
        DamensoloTrumpfOrdnungMixin() {}
    }

    /** Mixin fuer {@link FleischlosTrumpfOrdnung}: keine Felder, no-arg. */
    private abstract static class FleischlosTrumpfOrdnungMixin {
        @JsonCreator
        FleischlosTrumpfOrdnungMixin() {}
    }

    /** Mixin fuer {@link VariableTrumpfsoloTrumpfOrdnung}: serialisiert als {"trumpfFarbe": "...", "spielregeln": {...}}. */
    private abstract static class VariableTrumpfsoloTrumpfOrdnungMixin {
        @JsonCreator
        VariableTrumpfsoloTrumpfOrdnungMixin(
                @JsonProperty("trumpfFarbe") Farbe trumpfFarbe,
                @JsonProperty("spielregeln") Spielregeln spielregeln) {}

        @JsonProperty("trumpfFarbe")
        abstract Farbe trumpfFarbe();

        @JsonProperty("spielregeln")
        abstract Spielregeln spielregeln();
    }

    /** Mixin fuer {@link Kartendeck}: serialisiert als JSON-Array der Karten. */
    private abstract static class KartendeckMixin {
        @JsonCreator
        public static Kartendeck ausKarten(Collection<Karte> karten) { return null; }

        @JsonValue
        abstract List<Karte> karten();
    }

    // ---- AccessorNamingStrategy: unterdrückt "ist*"-Heuristik ----

    /**
     * Provider-Fabrik fuer {@link NurEchteIsGetterStrategie}.
     *
     * <p>Registriert eine Strategie, die nur {@code is} + Großbuchstabe als
     * Boolean-Property-Getter erkennt. Damit werden Deutsche {@code ist*}-Methoden
     * (z.B. {@code istVollstaendig()}) nicht faelschlicherweise als Properties behandelt.</p>
     */
    private static final class NurEchteIsGetterStrategieProvider extends AccessorNamingStrategy.Provider {
        private final DefaultAccessorNamingStrategy.Provider standard = new DefaultAccessorNamingStrategy.Provider();

        @Override
        public AccessorNamingStrategy forPOJO(MapperConfig<?> config, AnnotatedClass valueClass) {
            return new NurEchteIsGetterStrategie(standard.forPOJO(config, valueClass));
        }

        @Override
        public AccessorNamingStrategy forBuilder(MapperConfig<?> config, AnnotatedClass builderClass, BeanDescription valueTypeDesc) {
            return new NurEchteIsGetterStrategie(standard.forBuilder(config, builderClass, valueTypeDesc));
        }

        @Override
        public AccessorNamingStrategy forRecord(MapperConfig<?> config, AnnotatedClass recordClass) {
            return new NurEchteIsGetterStrategie(standard.forRecord(config, recordClass));
        }
    }

    /**
     * Erkennt nur {@code is} + Großbuchstabe als Boolean-Getter; ignoriert {@code ist*}.
     * Delegiert alle uebrigen Namensentscheidungen an die Jackson-Standardstrategie.
     */
    private static final class NurEchteIsGetterStrategie extends AccessorNamingStrategy {
        private final AccessorNamingStrategy standard;

        NurEchteIsGetterStrategie(AccessorNamingStrategy standard) {
            this.standard = standard;
        }

        @Override
        public String findNameForIsGetter(AnnotatedMethod am, String defaultName) {
            String name = am.getName();
            if (name.startsWith("is") && name.length() > 2 && Character.isUpperCase(name.charAt(2))) {
                return standard.findNameForIsGetter(am, defaultName);
            }
            return null;
        }

        @Override
        public String findNameForRegularGetter(AnnotatedMethod am, String defaultName) {
            return standard.findNameForRegularGetter(am, defaultName);
        }

        @Override
        public String findNameForMutator(AnnotatedMethod am, String defaultName) {
            return standard.findNameForMutator(am, defaultName);
        }

        @Override
        public String modifyFieldName(AnnotatedField af, String name) {
            return standard.modifyFieldName(af, name);
        }
    }

    // ---- ObjectMapper-Konfiguration ----

    /**
     * Konfiguriert einen ObjectMapper mit allen noetigen Mixin-Registrierungen fuer
     * die Domain-VO-Typen und der {@link NurEchteIsGetterStrategieProvider AccessorNamingStrategy}.
     * Wird von {@link JsonbConverterKonfiguration} aufgerufen.
     */
    static ObjectMapper konfiguriereObjectMapper(ObjectMapper basis) {
        return basis.copy()
                .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
                .setAccessorNaming(new NurEchteIsGetterStrategieProvider())
                .addMixIn(Hand.class, HandMixin.class)
                .addMixIn(Stich.class, StichMixin.class)
                .addMixIn(Ansagen.class, AnsagenMixin.class)
                .addMixIn(Parteien.class, ParteienMixin.class)
                .addMixIn(Haende.class, HaendeMixin.class)
                .addMixIn(VorbehaltMeldungen.class, VorbehaltMeldungenMixin.class)
                .addMixIn(Stichverlauf.class, StichverlaufMixin.class)
                .addMixIn(GeschmisseneSpieler.class, GeschmisseneSpielerMixin.class)
                .addMixIn(PflichtAnsagen.class, PflichtAnsagenMixin.class)
                .addMixIn(NormaleTrumpfOrdnung.class, NormaleTrumpfOrdnungMixin.class)
                .addMixIn(SchweinchenTrumpfOrdnung.class, SchweinchenTrumpfOrdnungMixin.class)
                .addMixIn(BubensoloTrumpfOrdnung.class, BubensoloTrumpfOrdnungMixin.class)
                .addMixIn(DamensoloTrumpfOrdnung.class, DamensoloTrumpfOrdnungMixin.class)
                .addMixIn(FleischlosTrumpfOrdnung.class, FleischlosTrumpfOrdnungMixin.class)
                .addMixIn(VariableTrumpfsoloTrumpfOrdnung.class, VariableTrumpfsoloTrumpfOrdnungMixin.class)
                .addMixIn(Kartendeck.class, KartendeckMixin.class);
    }

    // ---- Hilfs-Methoden ----

    /** Serialisiert ein Domain-VO als JSON-String. Funktioniert fuer H2 (String) und PostgreSQL (akzeptiert String fuer JSONB). */
    private static String toJsonString(ObjectMapper mapper, Object wert) {
        try {
            return mapper.writeValueAsString(wert);
        } catch (Exception e) {
            throw new IllegalStateException(
                    "JSONB-Serialisierung fehlgeschlagen fuer " + wert.getClass().getSimpleName(), e);
        }
    }

    /** Deserialisiert ein Domain-VO aus einem PGobject (PostgreSQL-Lesen). */
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

    /** Deserialisiert ein Domain-VO aus einem JSON-String (H2-Lesen). */
    private static <T> T fromString(ObjectMapper mapper, String quelle, Class<T> typ) {
        try {
            return mapper.readValue(quelle, typ);
        } catch (Exception e) {
            throw new IllegalStateException(
                    "JSONB-Deserialisierung fehlgeschlagen: " + quelle, e);
        }
    }

    private static <T> T fromString(ObjectMapper mapper, String quelle, TypeReference<T> typReferenz) {
        try {
            return mapper.readValue(quelle, typReferenz);
        } catch (Exception e) {
            throw new IllegalStateException(
                    "JSONB-Deserialisierung fehlgeschlagen: " + quelle, e);
        }
    }

    // ---- JSONB-Converter pro Domain-Typ (Schreib + PGobject-Lese + String-Lese fuer H2) ----

    /** ansage_ereignisse: Ansagen ↔ JSONB */
    @WritingConverter
    public static class AnsagenSchreibConverter implements Converter<Ansagen, String> {
        private final ObjectMapper mapper;
        public AnsagenSchreibConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public String convert(Ansagen source) { return toJsonString(mapper, source); }
    }

    @ReadingConverter
    public static class AnsagenLeseConverter implements Converter<PGobject, Ansagen> {
        private final ObjectMapper mapper;
        public AnsagenLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public Ansagen convert(PGobject source) { return fromPGobject(mapper, source, Ansagen.class); }
    }

    @ReadingConverter
    public static class AnsagenStringLeseConverter implements Converter<String, Ansagen> {
        private final ObjectMapper mapper;
        public AnsagenStringLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public Ansagen convert(String source) { return fromString(mapper, source, Ansagen.class); }
    }

    /** partei_zuordnungen: Parteien ↔ JSONB */
    @WritingConverter
    public static class ParteienSchreibConverter implements Converter<Parteien, String> {
        private final ObjectMapper mapper;
        public ParteienSchreibConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public String convert(Parteien source) { return toJsonString(mapper, source); }
    }

    @ReadingConverter
    public static class ParteienLeseConverter implements Converter<PGobject, Parteien> {
        private final ObjectMapper mapper;
        public ParteienLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public Parteien convert(PGobject source) { return fromPGobject(mapper, source, Parteien.class); }
    }

    @ReadingConverter
    public static class ParteienStringLeseConverter implements Converter<String, Parteien> {
        private final ObjectMapper mapper;
        public ParteienStringLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public Parteien convert(String source) { return fromString(mapper, source, Parteien.class); }
    }

    /** armut_status: ArmutStatus ↔ JSONB */
    @WritingConverter
    public static class ArmutStatusSchreibConverter implements Converter<ArmutStatus, String> {
        private final ObjectMapper mapper;
        public ArmutStatusSchreibConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public String convert(ArmutStatus source) { return toJsonString(mapper, source); }
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

    @ReadingConverter
    public static class ArmutStatusStringLeseConverter implements Converter<String, ArmutStatus> {
        private final ObjectMapper mapper;
        public ArmutStatusStringLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public ArmutStatus convert(String source) {
            return fromString(mapper, source, ArmutStatus.class);
        }
    }

    /** hochzeit_status: HochzeitStatus ↔ JSONB */
    @WritingConverter
    public static class HochzeitStatusSchreibConverter implements Converter<HochzeitStatus, String> {
        private final ObjectMapper mapper;
        public HochzeitStatusSchreibConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public String convert(HochzeitStatus source) { return toJsonString(mapper, source); }
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

    @ReadingConverter
    public static class HochzeitStatusStringLeseConverter implements Converter<String, HochzeitStatus> {
        private final ObjectMapper mapper;
        public HochzeitStatusStringLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public HochzeitStatus convert(String source) {
            return fromString(mapper, source, HochzeitStatus.class);
        }
    }

    /** spielregeln (in partie und laufendes_spiel): Spielregeln ↔ JSONB */
    @WritingConverter
    public static class SpielregelnSchreibConverter implements Converter<Spielregeln, String> {
        private final ObjectMapper mapper;
        public SpielregelnSchreibConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public String convert(Spielregeln source) { return toJsonString(mapper, source); }
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

    @ReadingConverter
    public static class SpielregelnStringLeseConverter implements Converter<String, Spielregeln> {
        private final ObjectMapper mapper;
        public SpielregelnStringLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public Spielregeln convert(String source) {
            return fromString(mapper, source, Spielregeln.class);
        }
    }

    /** ergebnis: Spielergebnis ↔ JSONB */
    @WritingConverter
    public static class SpielergebnisSchreibConverter implements Converter<Spielergebnis, String> {
        private final ObjectMapper mapper;
        public SpielergebnisSchreibConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public String convert(Spielergebnis source) { return toJsonString(mapper, source); }
    }

    @ReadingConverter
    public static class SpielergebnisLeseConverter implements Converter<PGobject, Spielergebnis> {
        private final ObjectMapper mapper;
        public SpielergebnisLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public Spielergebnis convert(PGobject source) {
            return fromPGobject(mapper, source, Spielergebnis.class);
        }
    }

    @ReadingConverter
    public static class SpielergebnisStringLeseConverter implements Converter<String, Spielergebnis> {
        private final ObjectMapper mapper;
        public SpielergebnisStringLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public Spielergebnis convert(String source) {
            return fromString(mapper, source, Spielergebnis.class);
        }
    }

    // ---- Bytes-Lese-Converter fuer H2 (H2 gibt byte[] fuer JSONB-Spalten zurueck) ----
    // H2 umschließt beim Schreiben per setString() den JSON-Text in JSON-String-Quotes ("...").
    // entpackeH2Json entfernt diese Umhuellung, bevor Jackson parst.

    private static String entpackeH2Json(ObjectMapper mapper, byte[] quelle) {
        String text = new String(quelle, StandardCharsets.UTF_8);
        if (text.startsWith("\"")) {
            try {
                return mapper.readValue(text, String.class);
            } catch (Exception e) {
                throw new IllegalStateException("H2-JSONB-Entpacken fehlgeschlagen: " + text, e);
            }
        }
        return text;
    }

    private static <T> T fromBytes(ObjectMapper mapper, byte[] quelle, Class<T> typ) {
        return fromString(mapper, entpackeH2Json(mapper, quelle), typ);
    }

    private static <T> T fromBytes(ObjectMapper mapper, byte[] quelle, TypeReference<T> typReferenz) {
        return fromString(mapper, entpackeH2Json(mapper, quelle), typReferenz);
    }

    @ReadingConverter
    public static class AnsagenBytesLeseConverter implements Converter<byte[], Ansagen> {
        private final ObjectMapper mapper;
        public AnsagenBytesLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public Ansagen convert(byte[] source) { return fromBytes(mapper, source, Ansagen.class); }
    }

    @ReadingConverter
    public static class ParteienBytesLeseConverter implements Converter<byte[], Parteien> {
        private final ObjectMapper mapper;
        public ParteienBytesLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public Parteien convert(byte[] source) { return fromBytes(mapper, source, Parteien.class); }
    }

    @ReadingConverter
    public static class ArmutStatusBytesLeseConverter implements Converter<byte[], ArmutStatus> {
        private final ObjectMapper mapper;
        public ArmutStatusBytesLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public ArmutStatus convert(byte[] source) { return fromBytes(mapper, source, ArmutStatus.class); }
    }

    @ReadingConverter
    public static class HochzeitStatusBytesLeseConverter implements Converter<byte[], HochzeitStatus> {
        private final ObjectMapper mapper;
        public HochzeitStatusBytesLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public HochzeitStatus convert(byte[] source) { return fromBytes(mapper, source, HochzeitStatus.class); }
    }

    @ReadingConverter
    public static class SpielregelnBytesLeseConverter implements Converter<byte[], Spielregeln> {
        private final ObjectMapper mapper;
        public SpielregelnBytesLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public Spielregeln convert(byte[] source) { return fromBytes(mapper, source, Spielregeln.class); }
    }

    @ReadingConverter
    public static class SpielergebnisBytesLeseConverter implements Converter<byte[], Spielergebnis> {
        private final ObjectMapper mapper;
        public SpielergebnisBytesLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public Spielergebnis convert(byte[] source) { return fromBytes(mapper, source, Spielergebnis.class); }
    }

    // ---- Wrapper-VO-Converter (DOMAIN-1) ----

    /** haende: Haende ↔ JSONB (serialisiert als Map<SpielerPosition, Hand>) */
    @WritingConverter
    public static class HaendeVOSchreibConverter implements Converter<Haende, String> {
        private final ObjectMapper mapper;
        public HaendeVOSchreibConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public String convert(Haende source) { return toJsonString(mapper, source); }
    }

    @ReadingConverter
    public static class HaendeVOLeseConverter implements Converter<PGobject, Haende> {
        private final ObjectMapper mapper;
        public HaendeVOLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public Haende convert(PGobject source) { return fromPGobject(mapper, source, Haende.class); }
    }

    @ReadingConverter
    public static class HaendeVOStringLeseConverter implements Converter<String, Haende> {
        private final ObjectMapper mapper;
        public HaendeVOStringLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public Haende convert(String source) { return fromString(mapper, source, Haende.class); }
    }

    @ReadingConverter
    public static class HaendeVOBytesLeseConverter implements Converter<byte[], Haende> {
        private final ObjectMapper mapper;
        public HaendeVOBytesLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public Haende convert(byte[] source) { return fromBytes(mapper, source, Haende.class); }
    }

    /** vorbehalt_meldungen: VorbehaltMeldungen ↔ JSONB */
    @WritingConverter
    public static class VorbehaltMeldungenVOSchreibConverter implements Converter<VorbehaltMeldungen, String> {
        private final ObjectMapper mapper;
        public VorbehaltMeldungenVOSchreibConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public String convert(VorbehaltMeldungen source) { return toJsonString(mapper, source); }
    }

    @ReadingConverter
    public static class VorbehaltMeldungenVOLeseConverter implements Converter<PGobject, VorbehaltMeldungen> {
        private final ObjectMapper mapper;
        public VorbehaltMeldungenVOLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public VorbehaltMeldungen convert(PGobject source) {
            return fromPGobject(mapper, source, VorbehaltMeldungen.class);
        }
    }

    @ReadingConverter
    public static class VorbehaltMeldungenVOStringLeseConverter implements Converter<String, VorbehaltMeldungen> {
        private final ObjectMapper mapper;
        public VorbehaltMeldungenVOStringLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public VorbehaltMeldungen convert(String source) {
            return fromString(mapper, source, VorbehaltMeldungen.class);
        }
    }

    @ReadingConverter
    public static class VorbehaltMeldungenVOBytesLeseConverter implements Converter<byte[], VorbehaltMeldungen> {
        private final ObjectMapper mapper;
        public VorbehaltMeldungenVOBytesLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public VorbehaltMeldungen convert(byte[] source) {
            return fromBytes(mapper, source, VorbehaltMeldungen.class);
        }
    }

    /** abgeschlossene_stiche: Stichverlauf ↔ JSONB */
    @WritingConverter
    public static class StichverlaufVOSchreibConverter implements Converter<Stichverlauf, String> {
        private final ObjectMapper mapper;
        public StichverlaufVOSchreibConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public String convert(Stichverlauf source) { return toJsonString(mapper, source); }
    }

    @ReadingConverter
    public static class StichverlaufVOLeseConverter implements Converter<PGobject, Stichverlauf> {
        private final ObjectMapper mapper;
        public StichverlaufVOLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public Stichverlauf convert(PGobject source) {
            return fromPGobject(mapper, source, Stichverlauf.class);
        }
    }

    @ReadingConverter
    public static class StichverlaufVOStringLeseConverter implements Converter<String, Stichverlauf> {
        private final ObjectMapper mapper;
        public StichverlaufVOStringLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public Stichverlauf convert(String source) {
            return fromString(mapper, source, Stichverlauf.class);
        }
    }

    @ReadingConverter
    public static class StichverlaufVOBytesLeseConverter implements Converter<byte[], Stichverlauf> {
        private final ObjectMapper mapper;
        public StichverlaufVOBytesLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public Stichverlauf convert(byte[] source) {
            return fromBytes(mapper, source, Stichverlauf.class);
        }
    }

    /** bereits_geschmissen: GeschmisseneSpieler ↔ JSONB */
    @WritingConverter
    public static class GeschmisseneSpielerVOSchreibConverter implements Converter<GeschmisseneSpieler, String> {
        private final ObjectMapper mapper;
        public GeschmisseneSpielerVOSchreibConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public String convert(GeschmisseneSpieler source) { return toJsonString(mapper, source); }
    }

    @ReadingConverter
    public static class GeschmisseneSpielerVOLeseConverter implements Converter<PGobject, GeschmisseneSpieler> {
        private final ObjectMapper mapper;
        public GeschmisseneSpielerVOLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public GeschmisseneSpieler convert(PGobject source) {
            return fromPGobject(mapper, source, GeschmisseneSpieler.class);
        }
    }

    @ReadingConverter
    public static class GeschmisseneSpielerVOStringLeseConverter implements Converter<String, GeschmisseneSpieler> {
        private final ObjectMapper mapper;
        public GeschmisseneSpielerVOStringLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public GeschmisseneSpieler convert(String source) {
            return fromString(mapper, source, GeschmisseneSpieler.class);
        }
    }

    @ReadingConverter
    public static class GeschmisseneSpielerVOBytesLeseConverter implements Converter<byte[], GeschmisseneSpieler> {
        private final ObjectMapper mapper;
        public GeschmisseneSpielerVOBytesLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public GeschmisseneSpieler convert(byte[] source) {
            return fromBytes(mapper, source, GeschmisseneSpieler.class);
        }
    }

    /** pflicht_ansage_ausstehend: PflichtAnsagen ↔ JSONB */
    @WritingConverter
    public static class PflichtAnsagenVOSchreibConverter implements Converter<PflichtAnsagen, String> {
        private final ObjectMapper mapper;
        public PflichtAnsagenVOSchreibConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public String convert(PflichtAnsagen source) { return toJsonString(mapper, source); }
    }

    @ReadingConverter
    public static class PflichtAnsagenVOLeseConverter implements Converter<PGobject, PflichtAnsagen> {
        private final ObjectMapper mapper;
        public PflichtAnsagenVOLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public PflichtAnsagen convert(PGobject source) {
            return fromPGobject(mapper, source, PflichtAnsagen.class);
        }
    }

    @ReadingConverter
    public static class PflichtAnsagenVOStringLeseConverter implements Converter<String, PflichtAnsagen> {
        private final ObjectMapper mapper;
        public PflichtAnsagenVOStringLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public PflichtAnsagen convert(String source) {
            return fromString(mapper, source, PflichtAnsagen.class);
        }
    }

    @ReadingConverter
    public static class PflichtAnsagenVOBytesLeseConverter implements Converter<byte[], PflichtAnsagen> {
        private final ObjectMapper mapper;
        public PflichtAnsagenVOBytesLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public PflichtAnsagen convert(byte[] source) {
            return fromBytes(mapper, source, PflichtAnsagen.class);
        }
    }

    // ---- DOMAIN-2: Spielphase, TrumpfOrdnung, Kartendeck ----

    /** phase: Spielphase ↔ JSONB (polymorphisch via @JsonTypeInfo) */
    @WritingConverter
    public static class SpielphaseSchreibConverter implements Converter<Spielphase, String> {
        private final ObjectMapper mapper;
        public SpielphaseSchreibConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public String convert(Spielphase source) { return toJsonString(mapper, source); }
    }

    @ReadingConverter
    public static class SpielphaseLeseConverter implements Converter<PGobject, Spielphase> {
        private final ObjectMapper mapper;
        public SpielphaseLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public Spielphase convert(PGobject source) { return fromPGobject(mapper, source, Spielphase.class); }
    }

    @ReadingConverter
    public static class SpielphaseStringLeseConverter implements Converter<String, Spielphase> {
        private final ObjectMapper mapper;
        public SpielphaseStringLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public Spielphase convert(String source) { return fromString(mapper, source, Spielphase.class); }
    }

    @ReadingConverter
    public static class SpielphaseBytesLeseConverter implements Converter<byte[], Spielphase> {
        private final ObjectMapper mapper;
        public SpielphaseBytesLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public Spielphase convert(byte[] source) { return fromBytes(mapper, source, Spielphase.class); }
    }

    /** trumpf_ordnung_typ: TrumpfOrdnung ↔ JSONB (polymorphisch via @JsonTypeInfo) */
    @WritingConverter
    public static class TrumpfOrdnungSchreibConverter implements Converter<TrumpfOrdnung, String> {
        private final ObjectMapper mapper;
        public TrumpfOrdnungSchreibConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public String convert(TrumpfOrdnung source) { return toJsonString(mapper, source); }
    }

    @ReadingConverter
    public static class TrumpfOrdnungLeseConverter implements Converter<PGobject, TrumpfOrdnung> {
        private final ObjectMapper mapper;
        public TrumpfOrdnungLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public TrumpfOrdnung convert(PGobject source) { return fromPGobject(mapper, source, TrumpfOrdnung.class); }
    }

    @ReadingConverter
    public static class TrumpfOrdnungStringLeseConverter implements Converter<String, TrumpfOrdnung> {
        private final ObjectMapper mapper;
        public TrumpfOrdnungStringLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public TrumpfOrdnung convert(String source) { return fromString(mapper, source, TrumpfOrdnung.class); }
    }

    @ReadingConverter
    public static class TrumpfOrdnungBytesLeseConverter implements Converter<byte[], TrumpfOrdnung> {
        private final ObjectMapper mapper;
        public TrumpfOrdnungBytesLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public TrumpfOrdnung convert(byte[] source) { return fromBytes(mapper, source, TrumpfOrdnung.class); }
    }

    /** kartendeck: Kartendeck ↔ JSONB (serialisiert als JSON-Array der Karten) */
    @WritingConverter
    public static class KartendeckSchreibConverter implements Converter<Kartendeck, String> {
        private final ObjectMapper mapper;
        public KartendeckSchreibConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public String convert(Kartendeck source) { return toJsonString(mapper, source); }
    }

    @ReadingConverter
    public static class KartendeckLeseConverter implements Converter<PGobject, Kartendeck> {
        private final ObjectMapper mapper;
        public KartendeckLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public Kartendeck convert(PGobject source) { return fromPGobject(mapper, source, Kartendeck.class); }
    }

    @ReadingConverter
    public static class KartendeckStringLeseConverter implements Converter<String, Kartendeck> {
        private final ObjectMapper mapper;
        public KartendeckStringLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public Kartendeck convert(String source) { return fromString(mapper, source, Kartendeck.class); }
    }

    @ReadingConverter
    public static class KartendeckBytesLeseConverter implements Converter<byte[], Kartendeck> {
        private final ObjectMapper mapper;
        public KartendeckBytesLeseConverter(ObjectMapper mapper) { this.mapper = mapper; }
        @Override
        public Kartendeck convert(byte[] source) { return fromBytes(mapper, source, Kartendeck.class); }
    }
}
