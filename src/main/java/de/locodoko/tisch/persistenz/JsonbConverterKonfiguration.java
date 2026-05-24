package de.locodoko.tisch.persistenz;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jdbc.core.convert.JdbcCustomConversions;

import java.util.List;

/**
 * Spring-Konfiguration fuer die JSONB-Custom-Converter.
 *
 * <p>Registriert alle elf Converter-Paare aus {@link JsonbConverter} als
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
                new JsonbConverter.HaendeSchreibConverter(mapper),
                new JsonbConverter.HaendeLeseConverter(mapper),
                new JsonbConverter.StichSchreibConverter(mapper),
                new JsonbConverter.StichLeseConverter(mapper),
                new JsonbConverter.StichListeSchreibConverter(mapper),
                new JsonbConverter.StichListeLeseConverter(mapper),
                new JsonbConverter.VorbehaltMeldungListeSchreibConverter(mapper),
                new JsonbConverter.VorbehaltMeldungListeLeseConverter(mapper),
                new JsonbConverter.AnsagenSchreibConverter(mapper),
                new JsonbConverter.AnsagenLeseConverter(mapper),
                new JsonbConverter.ParteienSchreibConverter(mapper),
                new JsonbConverter.ParteienLeseConverter(mapper),
                new JsonbConverter.SpielerPositionSetSchreibConverter(mapper),
                new JsonbConverter.SpielerPositionSetLeseConverter(mapper),
                new JsonbConverter.ParteiSetSchreibConverter(mapper),
                new JsonbConverter.ParteiSetLeseConverter(mapper),
                new JsonbConverter.ArmutStatusSchreibConverter(mapper),
                new JsonbConverter.ArmutStatusLeseConverter(mapper),
                new JsonbConverter.HochzeitStatusSchreibConverter(mapper),
                new JsonbConverter.HochzeitStatusLeseConverter(mapper),
                new JsonbConverter.SpielregelnSchreibConverter(mapper),
                new JsonbConverter.SpielregelnLeseConverter(mapper)
        ));
    }
}
