package de.locodoko.system;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.tags.Tag;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

/**
 * OpenAPI/Swagger-Konfiguration fuer die Locodoko REST-API.
 *
 * <p>Erzeugt das {@link OpenAPI}-Metadaten-Objekt, das von springdoc-openapi fuer die
 * Swagger-UI ({@code /swagger-ui.html}) und den JSON-Endpunkt ({@code /v3/api-docs})
 * verwendet wird.</p>
 */
@Configuration
public class OpenApiKonfiguration {

    /**
     * Erzeugt das OpenAPI-Objekt mit Titel, Version, Beschreibung und Tag-Definitionen.
     */
    @Bean
    public OpenAPI locodokoOpenApi() {
        return new OpenAPI()
            .info(new Info()
                .title("Locodoko Doppelkopf API")
                .version("1.0")
                .description("REST-API fuer das browserbasierte Doppelkopf-Spiel Locodoko. " +
                    "WebSocket-Endpunkte (STOMP ueber SockJS) sind separat dokumentiert.")
                .contact(new Contact().name("Locodoko").url("https://locodoko.de")))
            .tags(List.of(
                new Tag().name("Tische").description("Lobby: Tische erstellen, beitreten, verlassen und starten"),
                new Tag().name("Partien").description("Aktuellen Partiestand abrufen"),
                new Tag().name("Einladung").description("Oeffentliche Einladungslinks fuer private Tische"),
                new Tag().name("Session").description("Spieler-Session registrieren, abrufen und Namen aendern"),
                new Tag().name("Authentifizierung").description("Registrierung und Login"),
                new Tag().name("Profil").description("Oeffentliches Spieler-Profil mit Statistiken und letzten Partien"),
                new Tag().name("System").description("Systemstatus und Gesundheitspruefung")
            ));
    }
}
