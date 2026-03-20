package de.locodoko.spielverwaltung.websocket;

import de.locodoko.spielverwaltung.persistenz.SpielerEntity;
import de.locodoko.spielverwaltung.session.SpielerSessionService;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;

@Component
public class SpielerSessionHandshakeInterceptor implements HandshakeInterceptor {

    static final String SPIELER_SESSION_ID_ATTRIBUT = "spielerSessionId";

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
