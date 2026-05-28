package de.locodoko.tisch.persistenz;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jdbc.core.convert.JdbcCustomConversions;

import java.util.List;

/**
 * Spring-Konfiguration fuer die JSONB-Custom-Converter.
 *
 * <p>Registriert alle JSONB-Converter-Paare aus {@link JsonbConverter} als
 * {@link JdbcCustomConversions}-Bean, damit Spring Data JDBC sie automatisch
 * fuer passende Spaltentypen (PGobject ↔ Domain-VO) verwendet.</p>
 *
 * <p>Hinweis: Der ObjectMapper wird hier bewusst nicht per Spring-Injection
 * bezogen, da {@code jdbcCustomConversions} sehr frueh im Spring-Kontext
 * benoetigt wird (vor JacksonAutoConfiguration). Ein eigener ObjectMapper
 * mit den noetigen Mixins genuegt vollstaendig.</p>
 */
@Configuration
class JsonbConverterKonfiguration {

    /**
     * Registriert alle JSONB-Converter-Paare fuer Spring Data JDBC.
     *
     * <p>Warum: Spring Data JDBC benoetigt explizite Converter-Registrierung fuer
     * Typen, die nicht direkt auf SQL-Primitiven abgebildet werden. Ohne diese
     * Registrierung wuerde Spring Data JDBC {@code PGobject} nicht korrekt in
     * Domain-VOs umwandeln.</p>
     */
    @Bean
    JdbcCustomConversions jdbcCustomConversions() {
        ObjectMapper mapper = JsonbConverter.konfiguriereObjectMapper(new ObjectMapper());
        return new JdbcCustomConversions(List.of(
                // Augen VO ↔ Integer
                new AugenConverter.AugenSchreibConverter(),
                new AugenConverter.AugenLeseConverter(),
                // haende (Wrapper-VO)
                new JsonbConverter.HaendeVOSchreibConverter(mapper),
                new JsonbConverter.HaendeVOLeseConverter(mapper),
                new JsonbConverter.HaendeVOStringLeseConverter(mapper),
                new JsonbConverter.HaendeVOBytesLeseConverter(mapper),
                // aktueller_stich
                new JsonbConverter.StichSchreibConverter(mapper),
                new JsonbConverter.StichLeseConverter(mapper),
                new JsonbConverter.StichStringLeseConverter(mapper),
                new JsonbConverter.StichBytesLeseConverter(mapper),
                // abgeschlossene_stiche (Wrapper-VO)
                new JsonbConverter.StichverlaufVOSchreibConverter(mapper),
                new JsonbConverter.StichverlaufVOLeseConverter(mapper),
                new JsonbConverter.StichverlaufVOStringLeseConverter(mapper),
                new JsonbConverter.StichverlaufVOBytesLeseConverter(mapper),
                // vorbehalt_meldungen (Wrapper-VO)
                new JsonbConverter.VorbehaltMeldungenVOSchreibConverter(mapper),
                new JsonbConverter.VorbehaltMeldungenVOLeseConverter(mapper),
                new JsonbConverter.VorbehaltMeldungenVOStringLeseConverter(mapper),
                new JsonbConverter.VorbehaltMeldungenVOBytesLeseConverter(mapper),
                // ansage_ereignisse
                new JsonbConverter.AnsagenSchreibConverter(mapper),
                new JsonbConverter.AnsagenLeseConverter(mapper),
                new JsonbConverter.AnsagenStringLeseConverter(mapper),
                new JsonbConverter.AnsagenBytesLeseConverter(mapper),
                // partei_zuordnungen
                new JsonbConverter.ParteienSchreibConverter(mapper),
                new JsonbConverter.ParteienLeseConverter(mapper),
                new JsonbConverter.ParteienStringLeseConverter(mapper),
                new JsonbConverter.ParteienBytesLeseConverter(mapper),
                // bereits_geschmissen (Wrapper-VO)
                new JsonbConverter.GeschmisseneSpielerVOSchreibConverter(mapper),
                new JsonbConverter.GeschmisseneSpielerVOLeseConverter(mapper),
                new JsonbConverter.GeschmisseneSpielerVOStringLeseConverter(mapper),
                new JsonbConverter.GeschmisseneSpielerVOBytesLeseConverter(mapper),
                // pflicht_ansage_ausstehend (Wrapper-VO)
                new JsonbConverter.PflichtAnsagenVOSchreibConverter(mapper),
                new JsonbConverter.PflichtAnsagenVOLeseConverter(mapper),
                new JsonbConverter.PflichtAnsagenVOStringLeseConverter(mapper),
                new JsonbConverter.PflichtAnsagenVOBytesLeseConverter(mapper),
                // armut_status
                new JsonbConverter.ArmutStatusSchreibConverter(mapper),
                new JsonbConverter.ArmutStatusLeseConverter(mapper),
                new JsonbConverter.ArmutStatusStringLeseConverter(mapper),
                new JsonbConverter.ArmutStatusBytesLeseConverter(mapper),
                // hochzeit_status
                new JsonbConverter.HochzeitStatusSchreibConverter(mapper),
                new JsonbConverter.HochzeitStatusLeseConverter(mapper),
                new JsonbConverter.HochzeitStatusStringLeseConverter(mapper),
                new JsonbConverter.HochzeitStatusBytesLeseConverter(mapper),
                // spielregeln
                new JsonbConverter.SpielregelnSchreibConverter(mapper),
                new JsonbConverter.SpielregelnLeseConverter(mapper),
                new JsonbConverter.SpielregelnStringLeseConverter(mapper),
                new JsonbConverter.SpielregelnBytesLeseConverter(mapper),
                // ergebnis
                new JsonbConverter.SpielergebnisSchreibConverter(mapper),
                new JsonbConverter.SpielergebnisLeseConverter(mapper),
                new JsonbConverter.SpielergebnisStringLeseConverter(mapper),
                new JsonbConverter.SpielergebnisBytesLeseConverter(mapper)
        ));
    }
}
