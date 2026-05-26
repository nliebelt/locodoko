package de.locodoko.tisch.persistenz;

import de.locodoko.karten.Augen;
import org.springframework.core.convert.converter.Converter;
import org.springframework.data.convert.ReadingConverter;
import org.springframework.data.convert.WritingConverter;

/**
 * Converter-Paar fuer {@link Augen} ↔ {@link Integer} in Spring Data JDBC.
 *
 * <p>Erlaubt die Verwendung von {@code Augen} als typsicheres Feld in Entities,
 * ohne auf primitive {@code int}-Spalten zu verzichten. Schreiben: {@code Augen.wert()};
 * Lesen: {@code new Augen(Integer)}.</p>
 */
public final class AugenConverter {

    private AugenConverter() {}

    @WritingConverter
    public static class AugenSchreibConverter implements Converter<Augen, Integer> {
        @Override
        public Integer convert(Augen augen) {
            return augen.wert();
        }
    }

    @ReadingConverter
    public static class AugenLeseConverter implements Converter<Integer, Augen> {
        @Override
        public Augen convert(Integer wert) {
            return new Augen(wert);
        }
    }
}
