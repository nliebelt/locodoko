package de.locodoko.spielverwaltung.websocket;

import org.springframework.http.server.ServerHttpRequest;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.support.DefaultHandshakeHandler;

import java.security.Principal;
import java.util.Map;
import java.util.UUID;

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
