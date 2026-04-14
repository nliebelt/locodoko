package de.locodoko.spieler;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

/**
 * Konfigurierbare Eigenschaften fuer den WebSocket/STOMP-Endpunkt ({@code locodoko.websocket.*}).
 *
 * <p>Konfigurierbar: {@code locodoko.websocket.allowed-origins} — kommaseparierte Liste erlaubter
 * Urspruenge fuer CORS-Pruefung beim SockJS-Handshake. Standard: {@code *} (alle Urspruenge erlaubt).
 * Fuer die Produktion auf die eigene Domain beschraenken:
 * {@code locodoko.websocket.allowed-origins=https://locodoko.de}</p>
 */
@ConfigurationProperties(prefix = "locodoko.websocket")
public class WebSocketEigenschaften {

    /** Erlaubte CORS-Urspruenge fuer den WebSocket-Endpunkt. Im Dev-Betrieb {@code *}. */
    private List<String> allowedOrigins = List.of("*");

    public List<String> getAllowedOrigins() {
        return allowedOrigins;
    }

    public void setAllowedOrigins(List<String> allowedOrigins) {
        this.allowedOrigins = allowedOrigins;
    }
}
