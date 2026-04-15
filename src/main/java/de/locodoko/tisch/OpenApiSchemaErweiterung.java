package de.locodoko.tisch;

import io.swagger.v3.core.converter.ModelConverters;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

/**
 * Registriert zusaetzliche OpenAPI-Schemas fuer DTOs, die nicht direkt in REST-Endpunkten
 * auftauchen, aber vom Frontend benoetigt werden (Fehler-Antworten, WebSocket-Events).
 *
 * <p>Liegt bewusst im {@code tisch}-Modul (statt {@code system}), weil die referenzierten
 * DTO-Klassen alle in {@code tisch} definiert sind — eine Referenz aus {@code system} wuerde
 * die Spring-Modulith-Modulgrenze verletzen.</p>
 */
@Configuration
class OpenApiSchemaErweiterung {

    @Bean
    OpenApiCustomizer websocketUndFehlerSchemas() {
        return openApi -> {
            var resolver = ModelConverters.getInstance();
            var zusaetzlicheTypen = List.<Class<?>>of(
                ApiFehlerAntwort.class,
                TischEreignisAntwort.class,
                TischlisteEreignisAntwort.class,
                PartieEreignisAntwort.class,
                SpielverwaltungWebSocketFehlerAntwort.class,
                VerbindungStatusEreignisAntwort.class
            );
            for (var typ : zusaetzlicheTypen) {
                var schemas = resolver.readAll(typ);
                schemas.forEach((name, schema) ->
                    openApi.getComponents().getSchemas().putIfAbsent(name, schema)
                );
            }
        };
    }
}
