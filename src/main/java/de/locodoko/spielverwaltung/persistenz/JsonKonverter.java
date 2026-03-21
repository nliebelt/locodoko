package de.locodoko.spielverwaltung.persistenz;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.convert.converter.Converter;
import org.springframework.data.convert.ReadingConverter;
import org.springframework.data.convert.WritingConverter;

import java.io.IOException;
import java.util.List;

/**
 * Hilfsklasse fuer JSON-Konvertierung von Listen-Typen.
 * Wird fuer Spring Data JDBC verwendet, da ElementCollection
 * nicht mehr unterstuetzt wird. Jede Liste wird als JSON-Text gespeichert.
 */
final class JsonKonverter {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private JsonKonverter() {
    }

    /** Serialisiert eine Liste als JSON-String. Null-sicher (liefert "[]"). */
    static <T> String schreibeAlsJson(List<T> liste) {
        if (liste == null || liste.isEmpty()) {
            return "[]";
        }
        try {
            return OBJECT_MAPPER.writeValueAsString(liste);
        } catch (JsonProcessingException ausnahme) {
            throw new IllegalStateException("Konnte Liste nicht als JSON serialisieren", ausnahme);
        }
    }

    /** Deserialisiert einen JSON-String in eine Liste. Null/leer liefert leere Liste. */
    static <T> List<T> liesList(String json, TypeReference<List<T>> typeReference) {
        if (json == null || json.isBlank() || json.equals("[]")) {
            return List.of();
        }
        try {
            return OBJECT_MAPPER.readValue(json, typeReference);
        } catch (IOException ausnahme) {
            throw new IllegalStateException("Konnte JSON nicht als Liste lesen: " + json, ausnahme);
        }
    }
}
