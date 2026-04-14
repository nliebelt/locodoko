package de.locodoko.tisch;

import de.locodoko.spieler.SpielerSessionHandshakeHandler;
import de.locodoko.spieler.SpielerSessionHandshakeInterceptor;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * Konfiguriert den WebSocket/STOMP-Message-Broker.
 *
 * <p>Registriert den STOMP-Endpunkt {@code /ws} mit SockJS-Fallback,
 * konfiguriert {@code /app} als Client-zu-Server-Prefix und {@code /topic} sowie
 * {@code /user} als Broker-Prefixe fuer Broadcasts und benutzerbezogene Nachrichten.
 * Der {@link SpielerSessionHandshakeInterceptor} validiert die HTTP-Session beim Verbindungsaufbau.</p>
 *
 * <p>Erlaubte CORS-Urspruenge werden ueber {@code locodoko.websocket.allowed-origins} konfiguriert
 * (Development: {@code *}, Produktion: eigene Domain).</p>
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketKonfiguration implements WebSocketMessageBrokerConfigurer {

    private final SpielerSessionHandshakeInterceptor spielerSessionHandshakeInterceptor;
    /** Konfigurierbare CORS-Urspruenge aus {@code locodoko.websocket.allowed-origins}. */
    private final WebSocketEigenschaften webSocketEigenschaften;

    public WebSocketKonfiguration(SpielerSessionHandshakeInterceptor spielerSessionHandshakeInterceptor,
                                  WebSocketEigenschaften webSocketEigenschaften) {
        this.spielerSessionHandshakeInterceptor = spielerSessionHandshakeInterceptor;
        this.webSocketEigenschaften = webSocketEigenschaften;
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic", "/queue");
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        String[] erlaubteUrspruenge = webSocketEigenschaften.getAllowedOrigins().toArray(String[]::new);
        registry.addEndpoint("/ws")
            .setHandshakeHandler(new SpielerSessionHandshakeHandler())
            .addInterceptors(spielerSessionHandshakeInterceptor)
            .setAllowedOriginPatterns(erlaubteUrspruenge);
    }
}
