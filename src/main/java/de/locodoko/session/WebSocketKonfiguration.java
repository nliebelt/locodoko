package de.locodoko.session;

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
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketKonfiguration implements WebSocketMessageBrokerConfigurer {

    private final SpielerSessionHandshakeInterceptor spielerSessionHandshakeInterceptor;

    public WebSocketKonfiguration(SpielerSessionHandshakeInterceptor spielerSessionHandshakeInterceptor) {
        this.spielerSessionHandshakeInterceptor = spielerSessionHandshakeInterceptor;
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic", "/queue");
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
            .setHandshakeHandler(new SpielerSessionHandshakeHandler())
            .addInterceptors(spielerSessionHandshakeInterceptor);
    }
}
