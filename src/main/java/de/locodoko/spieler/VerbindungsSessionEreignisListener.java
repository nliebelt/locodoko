package de.locodoko.spieler;

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
        Map<String, Object> attribute = leseAttribute(ereignis.getMessage());
        if (attribute == null) {
            return;
        }
        String httpSessionId = (String) attribute.get(SpielerSessionHandshakeInterceptor.SPIELER_SESSION_ID_ATTRIBUT);
        UUID spielerId = (UUID) attribute.get("spielerId");
        String spielerName = (String) attribute.get("spielerName");

        if (httpSessionId != null && spielerId != null && spielerName != null) {
            verbindungsabbruchService.verarbeiteReconnect(httpSessionId, SpielerId.von(spielerId), spielerName);
        }
    }

    /**
     * Wird aufgerufen, wenn ein STOMP-Client die Verbindung getrennt hat.
     * Startet den Reconnect-Timer für den betroffenen Spieler.
     */
    @EventListener
    public void behandleVerbindungGetrennt(SessionDisconnectEvent ereignis) {
        Map<String, Object> attribute = leseAttribute(ereignis.getMessage());
        if (attribute == null) {
            return;
        }
        String httpSessionId = (String) attribute.get(SpielerSessionHandshakeInterceptor.SPIELER_SESSION_ID_ATTRIBUT);
        UUID spielerId = (UUID) attribute.get("spielerId");
        String spielerName = (String) attribute.get("spielerName");

        if (httpSessionId != null && spielerId != null && spielerName != null) {
            verbindungsabbruchService.verarbeiteDisconnect(httpSessionId, SpielerId.von(spielerId), spielerName);
        } else {
            LOGGER.debug("WebSocket-Disconnect ohne gültige Spieler-Attribute — vermutlich fehlgeschlagener Handshake.");
        }
    }

    /** Liest die WebSocket-Session-Attribute aus einer STOMP-Nachricht. */
    private Map<String, Object> leseAttribute(org.springframework.messaging.Message<?> nachricht) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(nachricht);
        return accessor.getSessionAttributes();
    }
}
