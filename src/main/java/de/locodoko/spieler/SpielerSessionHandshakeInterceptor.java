package de.locodoko.spieler;

import de.locodoko.spieler.SpielerEntity;
import de.locodoko.spieler.SpielerSessionService;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;

/**
 * Validiert die Spieler-Session beim WebSocket-Handshake und leitet die Session-ID weiter.
 *
 * <p>Liest beim STOMP-Handshake die HTTP-Session aus, prueft ob eine gueltige Spieler-Session
 * vorliegt und schreibt die Session-ID als Attribut in die WebSocket-Session-Map. Fehlt eine
 * gueltige Session, wird der Handshake mit HTTP 401 abgelehnt.</p>
 */
@Component
public class SpielerSessionHandshakeInterceptor implements HandshakeInterceptor {

    public static final String SPIELER_SESSION_ID_ATTRIBUT = "spielerSessionId";

    private final SpielerSessionService spielerSessionService;

    public SpielerSessionHandshakeInterceptor(SpielerSessionService spielerSessionService) {
        this.spielerSessionService = spielerSessionService;
    }

    @Override
    public boolean beforeHandshake(
        ServerHttpRequest request,
        ServerHttpResponse response,
        WebSocketHandler wsHandler,
        Map<String, Object> attributes
    ) {
        if (!(request instanceof ServletServerHttpRequest servletRequest)) {
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        }

        HttpSession session = servletRequest.getServletRequest().getSession(false);
        if (session == null) {
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        }

        spielerSessionService.uebernehmeTimeout(session);
        SpielerEntity spieler = spielerSessionService.ladeAktivenSpieler(session.getId());
        attributes.put(SPIELER_SESSION_ID_ATTRIBUT, session.getId());
        attributes.put("spielerId", spieler.id());
        attributes.put("spielerName", spieler.name());
        return true;
    }

    @Override
    public void afterHandshake(
        ServerHttpRequest request,
        ServerHttpResponse response,
        WebSocketHandler wsHandler,
        Exception exception
    ) {
    }
}
