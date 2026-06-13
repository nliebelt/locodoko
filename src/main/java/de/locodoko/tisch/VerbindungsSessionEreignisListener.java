package de.locodoko.tisch;

import de.locodoko.spieler.SpielerId;
import de.locodoko.spieler.SpielerSessionHandshakeInterceptor;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.util.Map;
import java.util.UUID;

/**
 * Lauscht auf WebSocket-Lebenszyklusereignisse (Verbinden, Trennen) und leitet sie an
 * den {@link VerbindungsabbruchService} weiter.
 *
 * <p>Der {@link SpielerSessionHandshakeInterceptor} legt die HTTP-Session-ID, die Spieler-ID
 * und den Spielernamen als WebSocket-Session-Attribute an — diese werden hier ausgelesen.
 */
@Component
public class VerbindungsSessionEreignisListener {

    private static final Logger LOGGER = LoggerFactory.getLogger(VerbindungsSessionEreignisListener.class);

    private final VerbindungsabbruchService verbindungsabbruchService;

    public VerbindungsSessionEreignisListener(VerbindungsabbruchService verbindungsabbruchService) {
        this.verbindungsabbruchService = verbindungsabbruchService;
    }

    /**
     * Wird aufgerufen, wenn ein STOMP-Client erfolgreich verbunden ist (nach dem CONNECTED-Frame).
     * Löst Reconnect-Logik aus, falls der Spieler zuvor als getrennt markiert war.
     */
    @EventListener
    public void behandleVerbindungAufgebaut(SessionConnectedEvent ereignis) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(ereignis.getMessage());
        Map<String, Object> attribute = accessor.getSessionAttributes();
        if (attribute == null) {
            return;
        }
        String httpSessionId = (String) attribute.get(SpielerSessionHandshakeInterceptor.SPIELER_SESSION_ID_ATTRIBUT);
        UUID spielerId = (UUID) attribute.get(SpielerSessionHandshakeInterceptor.SPIELER_ID_ATTRIBUT);
        String spielerName = (String) attribute.get(SpielerSessionHandshakeInterceptor.SPIELER_NAME_ATTRIBUT);
        String wsSessionId = accessor.getSessionId();

        if (httpSessionId != null && spielerId != null && spielerName != null && wsSessionId != null) {
            verbindungsabbruchService.verarbeiteReconnect(httpSessionId, wsSessionId, SpielerId.von(spielerId), spielerName);
        }
    }

    /**
     * Wird aufgerufen, wenn ein STOMP-Client die Verbindung getrennt hat.
     * Startet den Reconnect-Timer für den betroffenen Spieler.
     */
    @EventListener
    public void behandleVerbindungGetrennt(SessionDisconnectEvent ereignis) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(ereignis.getMessage());
        Map<String, Object> attribute = accessor.getSessionAttributes();
        if (attribute == null) {
            return;
        }
        String httpSessionId = (String) attribute.get(SpielerSessionHandshakeInterceptor.SPIELER_SESSION_ID_ATTRIBUT);
        UUID spielerId = (UUID) attribute.get(SpielerSessionHandshakeInterceptor.SPIELER_ID_ATTRIBUT);
        String spielerName = (String) attribute.get(SpielerSessionHandshakeInterceptor.SPIELER_NAME_ATTRIBUT);
        String wsSessionId = accessor.getSessionId();

        if (httpSessionId != null && spielerId != null && spielerName != null && wsSessionId != null) {
            verbindungsabbruchService.verarbeiteDisconnect(httpSessionId, wsSessionId, SpielerId.von(spielerId), spielerName);
        } else {
            LOGGER.debug("WebSocket-Disconnect ohne gültige Spieler-Attribute — vermutlich fehlgeschlagener Handshake.");
        }
    }
}
