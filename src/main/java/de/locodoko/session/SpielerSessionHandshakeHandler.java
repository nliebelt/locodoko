package de.locodoko.session;

import org.springframework.http.server.ServerHttpRequest;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.support.DefaultHandshakeHandler;

import java.security.Principal;
import java.util.Map;
import java.util.UUID;

/**
 * Setzt den WebSocket-Principal auf die Spieler-Session-ID.
 *
 * <p>Ordnet jedem WebSocket-Principal eine stabile ID zu: die Spieler-Session-ID aus dem
 * HTTP-Session-Attribut (gesetzt durch {@link SpielerSessionHandshakeInterceptor}), oder
 * bei fehlendem Wert eine zufaellige UUID. Der Principal wird benoetigt, um benutzerbezogene
 * Nachrichten ({@code /user/queue/...}) korrekt zuzustellen.</p>
 */
public class SpielerSessionHandshakeHandler extends DefaultHandshakeHandler {

    @Override
    protected Principal determineUser(
        ServerHttpRequest request,
        WebSocketHandler wsHandler,
        Map<String, Object> attributes
    ) {
        String sessionId = (String) attributes.get(SpielerSessionHandshakeInterceptor.SPIELER_SESSION_ID_ATTRIBUT);
        String principalName = sessionId == null || sessionId.isBlank() ? UUID.randomUUID().toString() : sessionId;
        return () -> principalName;
    }
}
