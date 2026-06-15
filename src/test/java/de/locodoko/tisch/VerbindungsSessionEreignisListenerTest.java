package de.locodoko.tisch;

import de.locodoko.spieler.SpielerId;
import de.locodoko.spieler.SpielerSessionHandshakeInterceptor;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifiziert, dass der Listener die WebSocket-Session-Attribute korrekt ausliest und nur bei
 * vollstaendigen Attributen an den {@link VerbindungsabbruchService} delegiert.
 */
class VerbindungsSessionEreignisListenerTest {

    private final FakeAbbruchService fake = new FakeAbbruchService();
    private final VerbindungsSessionEreignisListener listener =
        new VerbindungsSessionEreignisListener(fake);

    private final UUID spielerId = UUID.randomUUID();

    @Test
    void connectMitVollstaendigenAttributenLoestReconnectAus() {
        listener.behandleVerbindungAufgebaut(
            new SessionConnectedEvent(this, nachricht("ws-1", vollstaendigeAttribute())));

        assertThat(fake.reconnectName).isEqualTo("Anna");
        assertThat(fake.reconnectWsSessionId).isEqualTo("ws-1");
        assertThat(fake.reconnectSpielerId).isEqualTo(SpielerId.von(spielerId));
    }

    @Test
    void connectOhneSessionAttributeIgnoriert() {
        listener.behandleVerbindungAufgebaut(
            new SessionConnectedEvent(this, nachricht("ws-1", null)));

        assertThat(fake.reconnectName).isNull();
    }

    @Test
    void connectMitFehlenderSpielerIdIgnoriert() {
        Map<String, Object> attribute = vollstaendigeAttribute();
        attribute.remove(SpielerSessionHandshakeInterceptor.SPIELER_ID_ATTRIBUT);

        listener.behandleVerbindungAufgebaut(
            new SessionConnectedEvent(this, nachricht("ws-1", attribute)));

        assertThat(fake.reconnectName).isNull();
    }

    @Test
    void disconnectMitVollstaendigenAttributenLoestDisconnectAus() {
        listener.behandleVerbindungGetrennt(
            new SessionDisconnectEvent(this, nachricht("ws-2", vollstaendigeAttribute()),
                "ws-2", CloseStatus.NORMAL));

        assertThat(fake.disconnectName).isEqualTo("Anna");
        assertThat(fake.disconnectWsSessionId).isEqualTo("ws-2");
        assertThat(fake.disconnectSpielerId).isEqualTo(SpielerId.von(spielerId));
    }

    @Test
    void disconnectOhneSessionAttributeIgnoriert() {
        listener.behandleVerbindungGetrennt(
            new SessionDisconnectEvent(this, nachricht("ws-2", null), "ws-2", CloseStatus.NORMAL));

        assertThat(fake.disconnectName).isNull();
    }

    @Test
    void disconnectMitFehlendemNamenIgnoriert() {
        Map<String, Object> attribute = vollstaendigeAttribute();
        attribute.remove(SpielerSessionHandshakeInterceptor.SPIELER_NAME_ATTRIBUT);

        listener.behandleVerbindungGetrennt(
            new SessionDisconnectEvent(this, nachricht("ws-2", attribute), "ws-2", CloseStatus.NORMAL));

        assertThat(fake.disconnectName).isNull();
    }

    private Map<String, Object> vollstaendigeAttribute() {
        Map<String, Object> attribute = new HashMap<>();
        attribute.put(SpielerSessionHandshakeInterceptor.SPIELER_SESSION_ID_ATTRIBUT, "http-1");
        attribute.put(SpielerSessionHandshakeInterceptor.SPIELER_ID_ATTRIBUT, spielerId);
        attribute.put(SpielerSessionHandshakeInterceptor.SPIELER_NAME_ATTRIBUT, "Anna");
        return attribute;
    }

    private Message<byte[]> nachricht(String wsSessionId, Map<String, Object> attribute) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECTED);
        accessor.setSessionId(wsSessionId);
        if (attribute != null) {
            accessor.setSessionAttributes(attribute);
        }
        accessor.setLeaveMutable(true);
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }

    /** Zeichnet die Delegationsaufrufe auf, ohne echte Repository-/Echtzeit-Abhaengigkeiten. */
    private static class FakeAbbruchService extends VerbindungsabbruchService {
        String reconnectName;
        String reconnectWsSessionId;
        SpielerId reconnectSpielerId;
        String disconnectName;
        String disconnectWsSessionId;
        SpielerId disconnectSpielerId;

        FakeAbbruchService() {
            super(null, null, null, null, null, 0);
        }

        @Override
        public void verarbeiteReconnect(String httpSessionId, String wsSessionId,
                                        SpielerId spielerId, String spielerName) {
            this.reconnectWsSessionId = wsSessionId;
            this.reconnectSpielerId = spielerId;
            this.reconnectName = spielerName;
        }

        @Override
        public void verarbeiteDisconnect(String httpSessionId, String wsSessionId,
                                         SpielerId spielerId, String spielerName) {
            this.disconnectWsSessionId = wsSessionId;
            this.disconnectSpielerId = spielerId;
            this.disconnectName = spielerName;
        }
    }
}
