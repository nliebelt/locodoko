package de.locodoko.tisch.persistenz;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonValue;
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

    /** Deserialisiert ein Domain-VO aus einem JSON-String (H2-Lesen). */
    private static <T> T fromString(ObjectMapper mapper, String quelle, Class<T> typ) {
        try {
            return mapper.readValue(quelle, typ);
        } catch (Exception e) {
            throw new IllegalStateException(
                    "JSONB-Deserialisierung fehlgeschlagen: " + quelle, e);
        }
    }

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

    // ---- Generische Basisklassen (neues Domain-VO: 4 Zeilen statt 28) ----

    abstract static class Schreib<T> implements Converter<T, String> {
        private final ObjectMapper mapper;
        protected Schreib(ObjectMapper mapper) { this.mapper = mapper; }
        @Override public final String convert(T source) { return toJsonString(mapper, source); }
    }

    abstract static class Lese<T> implements Converter<PGobject, T> {
        private final ObjectMapper mapper;
        private final Class<T> typ;
        protected Lese(ObjectMapper mapper, Class<T> typ) { this.mapper = mapper; this.typ = typ; }
        @Override public final T convert(PGobject source) { return fromPGobject(mapper, source, typ); }
    }

    abstract static class StringLese<T> implements Converter<String, T> {
        private final ObjectMapper mapper;
        private final Class<T> typ;
        protected StringLese(ObjectMapper mapper, Class<T> typ) { this.mapper = mapper; this.typ = typ; }
        @Override public final T convert(String source) { return fromString(mapper, source, typ); }
    }

    abstract static class BytesLese<T> implements Converter<byte[], T> {
        private final ObjectMapper mapper;
        private final Class<T> typ;
        protected BytesLese(ObjectMapper mapper, Class<T> typ) { this.mapper = mapper; this.typ = typ; }
        @Override public final T convert(byte[] source) { return fromBytes(mapper, source, typ); }
    }


    // ---- JSONB-Converter pro Domain-Typ ----

    /** ansage_ereignisse */
    @WritingConverter public static class AnsagenSchreibConverter extends Schreib<Ansagen> { public AnsagenSchreibConverter(ObjectMapper m) { super(m); } }
    @ReadingConverter public static class AnsagenLeseConverter extends Lese<Ansagen> { public AnsagenLeseConverter(ObjectMapper m) { super(m, Ansagen.class); } }
    @ReadingConverter public static class AnsagenStringLeseConverter extends StringLese<Ansagen> { public AnsagenStringLeseConverter(ObjectMapper m) { super(m, Ansagen.class); } }
    @ReadingConverter public static class AnsagenBytesLeseConverter extends BytesLese<Ansagen> { public AnsagenBytesLeseConverter(ObjectMapper m) { super(m, Ansagen.class); } }

    /** partei_zuordnungen */
    @WritingConverter public static class ParteienSchreibConverter extends Schreib<Parteien> { public ParteienSchreibConverter(ObjectMapper m) { super(m); } }
    @ReadingConverter public static class ParteienLeseConverter extends Lese<Parteien> { public ParteienLeseConverter(ObjectMapper m) { super(m, Parteien.class); } }
    @ReadingConverter public static class ParteienStringLeseConverter extends StringLese<Parteien> { public ParteienStringLeseConverter(ObjectMapper m) { super(m, Parteien.class); } }
    @ReadingConverter public static class ParteienBytesLeseConverter extends BytesLese<Parteien> { public ParteienBytesLeseConverter(ObjectMapper m) { super(m, Parteien.class); } }

    /** armut_status */
    @WritingConverter public static class ArmutStatusSchreibConverter extends Schreib<ArmutStatus> { public ArmutStatusSchreibConverter(ObjectMapper m) { super(m); } }
    @ReadingConverter public static class ArmutStatusLeseConverter extends Lese<ArmutStatus> { public ArmutStatusLeseConverter(ObjectMapper m) { super(m, ArmutStatus.class); } }
    @ReadingConverter public static class ArmutStatusStringLeseConverter extends StringLese<ArmutStatus> { public ArmutStatusStringLeseConverter(ObjectMapper m) { super(m, ArmutStatus.class); } }
    @ReadingConverter public static class ArmutStatusBytesLeseConverter extends BytesLese<ArmutStatus> { public ArmutStatusBytesLeseConverter(ObjectMapper m) { super(m, ArmutStatus.class); } }

    /** hochzeit_status */
    @WritingConverter public static class HochzeitStatusSchreibConverter extends Schreib<HochzeitStatus> { public HochzeitStatusSchreibConverter(ObjectMapper m) { super(m); } }
    @ReadingConverter public static class HochzeitStatusLeseConverter extends Lese<HochzeitStatus> { public HochzeitStatusLeseConverter(ObjectMapper m) { super(m, HochzeitStatus.class); } }
    @ReadingConverter public static class HochzeitStatusStringLeseConverter extends StringLese<HochzeitStatus> { public HochzeitStatusStringLeseConverter(ObjectMapper m) { super(m, HochzeitStatus.class); } }
    @ReadingConverter public static class HochzeitStatusBytesLeseConverter extends BytesLese<HochzeitStatus> { public HochzeitStatusBytesLeseConverter(ObjectMapper m) { super(m, HochzeitStatus.class); } }

    /** spielregeln */
    @WritingConverter public static class SpielregelnSchreibConverter extends Schreib<Spielregeln> { public SpielregelnSchreibConverter(ObjectMapper m) { super(m); } }
    @ReadingConverter public static class SpielregelnLeseConverter extends Lese<Spielregeln> { public SpielregelnLeseConverter(ObjectMapper m) { super(m, Spielregeln.class); } }
    @ReadingConverter public static class SpielregelnStringLeseConverter extends StringLese<Spielregeln> { public SpielregelnStringLeseConverter(ObjectMapper m) { super(m, Spielregeln.class); } }
    @ReadingConverter public static class SpielregelnBytesLeseConverter extends BytesLese<Spielregeln> { public SpielregelnBytesLeseConverter(ObjectMapper m) { super(m, Spielregeln.class); } }

    /** spielergebnis */
    @WritingConverter public static class SpielergebnisSchreibConverter extends Schreib<Spielergebnis> { public SpielergebnisSchreibConverter(ObjectMapper m) { super(m); } }
    @ReadingConverter public static class SpielergebnisLeseConverter extends Lese<Spielergebnis> { public SpielergebnisLeseConverter(ObjectMapper m) { super(m, Spielergebnis.class); } }
    @ReadingConverter public static class SpielergebnisStringLeseConverter extends StringLese<Spielergebnis> { public SpielergebnisStringLeseConverter(ObjectMapper m) { super(m, Spielergebnis.class); } }
    @ReadingConverter public static class SpielergebnisBytesLeseConverter extends BytesLese<Spielergebnis> { public SpielergebnisBytesLeseConverter(ObjectMapper m) { super(m, Spielergebnis.class); } }

    // ---- Wrapper-VO-Converter ----

    /** haende */
    @WritingConverter public static class HaendeVOSchreibConverter extends Schreib<Haende> { public HaendeVOSchreibConverter(ObjectMapper m) { super(m); } }
    @ReadingConverter public static class HaendeVOLeseConverter extends Lese<Haende> { public HaendeVOLeseConverter(ObjectMapper m) { super(m, Haende.class); } }
    @ReadingConverter public static class HaendeVOStringLeseConverter extends StringLese<Haende> { public HaendeVOStringLeseConverter(ObjectMapper m) { super(m, Haende.class); } }
    @ReadingConverter public static class HaendeVOBytesLeseConverter extends BytesLese<Haende> { public HaendeVOBytesLeseConverter(ObjectMapper m) { super(m, Haende.class); } }

    /** vorbehalt_meldungen */
    @WritingConverter public static class VorbehaltMeldungenVOSchreibConverter extends Schreib<VorbehaltMeldungen> { public VorbehaltMeldungenVOSchreibConverter(ObjectMapper m) { super(m); } }
    @ReadingConverter public static class VorbehaltMeldungenVOLeseConverter extends Lese<VorbehaltMeldungen> { public VorbehaltMeldungenVOLeseConverter(ObjectMapper m) { super(m, VorbehaltMeldungen.class); } }
    @ReadingConverter public static class VorbehaltMeldungenVOStringLeseConverter extends StringLese<VorbehaltMeldungen> { public VorbehaltMeldungenVOStringLeseConverter(ObjectMapper m) { super(m, VorbehaltMeldungen.class); } }
    @ReadingConverter public static class VorbehaltMeldungenVOBytesLeseConverter extends BytesLese<VorbehaltMeldungen> { public VorbehaltMeldungenVOBytesLeseConverter(ObjectMapper m) { super(m, VorbehaltMeldungen.class); } }

    /** abgeschlossene_stiche */
    @WritingConverter public static class StichverlaufVOSchreibConverter extends Schreib<Stichverlauf> { public StichverlaufVOSchreibConverter(ObjectMapper m) { super(m); } }
    @ReadingConverter public static class StichverlaufVOLeseConverter extends Lese<Stichverlauf> { public StichverlaufVOLeseConverter(ObjectMapper m) { super(m, Stichverlauf.class); } }
    @ReadingConverter public static class StichverlaufVOStringLeseConverter extends StringLese<Stichverlauf> { public StichverlaufVOStringLeseConverter(ObjectMapper m) { super(m, Stichverlauf.class); } }
    @ReadingConverter public static class StichverlaufVOBytesLeseConverter extends BytesLese<Stichverlauf> { public StichverlaufVOBytesLeseConverter(ObjectMapper m) { super(m, Stichverlauf.class); } }

    /** bereits_geschmissen */
    @WritingConverter public static class GeschmisseneSpielerVOSchreibConverter extends Schreib<GeschmisseneSpieler> { public GeschmisseneSpielerVOSchreibConverter(ObjectMapper m) { super(m); } }
    @ReadingConverter public static class GeschmisseneSpielerVOLeseConverter extends Lese<GeschmisseneSpieler> { public GeschmisseneSpielerVOLeseConverter(ObjectMapper m) { super(m, GeschmisseneSpieler.class); } }
    @ReadingConverter public static class GeschmisseneSpielerVOStringLeseConverter extends StringLese<GeschmisseneSpieler> { public GeschmisseneSpielerVOStringLeseConverter(ObjectMapper m) { super(m, GeschmisseneSpieler.class); } }
    @ReadingConverter public static class GeschmisseneSpielerVOBytesLeseConverter extends BytesLese<GeschmisseneSpieler> { public GeschmisseneSpielerVOBytesLeseConverter(ObjectMapper m) { super(m, GeschmisseneSpieler.class); } }

    /** pflicht_ansage_ausstehend */
    @WritingConverter public static class PflichtAnsagenVOSchreibConverter extends Schreib<PflichtAnsagen> { public PflichtAnsagenVOSchreibConverter(ObjectMapper m) { super(m); } }
    @ReadingConverter public static class PflichtAnsagenVOLeseConverter extends Lese<PflichtAnsagen> { public PflichtAnsagenVOLeseConverter(ObjectMapper m) { super(m, PflichtAnsagen.class); } }
    @ReadingConverter public static class PflichtAnsagenVOStringLeseConverter extends StringLese<PflichtAnsagen> { public PflichtAnsagenVOStringLeseConverter(ObjectMapper m) { super(m, PflichtAnsagen.class); } }
    @ReadingConverter public static class PflichtAnsagenVOBytesLeseConverter extends BytesLese<PflichtAnsagen> { public PflichtAnsagenVOBytesLeseConverter(ObjectMapper m) { super(m, PflichtAnsagen.class); } }

    // ---- DOMAIN-2: polymorphe Typen ----

    /** phase */
    @WritingConverter public static class SpielphaseSchreibConverter extends Schreib<Spielphase> { public SpielphaseSchreibConverter(ObjectMapper m) { super(m); } }
    @ReadingConverter public static class SpielphaseLeseConverter extends Lese<Spielphase> { public SpielphaseLeseConverter(ObjectMapper m) { super(m, Spielphase.class); } }
    @ReadingConverter public static class SpielphaseStringLeseConverter extends StringLese<Spielphase> { public SpielphaseStringLeseConverter(ObjectMapper m) { super(m, Spielphase.class); } }
    @ReadingConverter public static class SpielphaseBytesLeseConverter extends BytesLese<Spielphase> { public SpielphaseBytesLeseConverter(ObjectMapper m) { super(m, Spielphase.class); } }

    /** trumpf_ordnung_typ */
    @WritingConverter public static class TrumpfOrdnungSchreibConverter extends Schreib<TrumpfOrdnung> { public TrumpfOrdnungSchreibConverter(ObjectMapper m) { super(m); } }
    @ReadingConverter public static class TrumpfOrdnungLeseConverter extends Lese<TrumpfOrdnung> { public TrumpfOrdnungLeseConverter(ObjectMapper m) { super(m, TrumpfOrdnung.class); } }
    @ReadingConverter public static class TrumpfOrdnungStringLeseConverter extends StringLese<TrumpfOrdnung> { public TrumpfOrdnungStringLeseConverter(ObjectMapper m) { super(m, TrumpfOrdnung.class); } }
    @ReadingConverter public static class TrumpfOrdnungBytesLeseConverter extends BytesLese<TrumpfOrdnung> { public TrumpfOrdnungBytesLeseConverter(ObjectMapper m) { super(m, TrumpfOrdnung.class); } }

    /** kartendeck */
    @WritingConverter public static class KartendeckSchreibConverter extends Schreib<Kartendeck> { public KartendeckSchreibConverter(ObjectMapper m) { super(m); } }
    @ReadingConverter public static class KartendeckLeseConverter extends Lese<Kartendeck> { public KartendeckLeseConverter(ObjectMapper m) { super(m, Kartendeck.class); } }
    @ReadingConverter public static class KartendeckStringLeseConverter extends StringLese<Kartendeck> { public KartendeckStringLeseConverter(ObjectMapper m) { super(m, Kartendeck.class); } }
    @ReadingConverter public static class KartendeckBytesLeseConverter extends BytesLese<Kartendeck> { public KartendeckBytesLeseConverter(ObjectMapper m) { super(m, Kartendeck.class); } }
}
