package de.locodoko.session;

import de.locodoko.session.SpielerEntity;
import de.locodoko.session.SpielerRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.http.server.ServletServerHttpResponse;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.WebSocketMessage;
import org.springframework.web.socket.WebSocketSession;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@Transactional
class SpielerSessionHandshakeInterceptorTest {

    @Autowired
    private SpielerSessionHandshakeInterceptor handshakeInterceptor;

    @Autowired
    private SpielerRepository spielerRepository;

    @Test
    void akzeptiertBekannteSpielerSessionUndSpeichertSessionIdImHandshake() throws Exception {
        spielerRepository.saveAndFlush(SpielerEntity.menschlich("Ada", "ws-session-ada"));

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setSession(new MockHttpSession(null, "ws-session-ada"));
        MockHttpServletResponse response = new MockHttpServletResponse();
        Map<String, Object> attribute = new HashMap<>();

        boolean erlaubt = handshakeInterceptor.beforeHandshake(
            new ServletServerHttpRequest(request),
            new ServletServerHttpResponse(response),
            new StummesWebSocketHandler(),
            attribute
        );

        assertTrue(erlaubt, "Bekannte Spieler-Sessions muessen fuer den WebSocket-Handshake akzeptiert werden.");
        assertEquals("ws-session-ada", attribute.get(SpielerSessionHandshakeInterceptor.SPIELER_SESSION_ID_ATTRIBUT));
    }

    @Test
    void lehntHandshakeOhneHttpSessionAb() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        boolean erlaubt = handshakeInterceptor.beforeHandshake(
            new ServletServerHttpRequest(request),
            new ServletServerHttpResponse(response),
            new StummesWebSocketHandler(),
            new HashMap<>()
        );

        assertFalse(erlaubt, "Ohne HTTP-Session darf kein WebSocket-Kanal fuer einen Spieler geoeffnet werden.");
        assertEquals(HttpStatus.UNAUTHORIZED.value(), response.getStatus());
    }

    private static final class StummesWebSocketHandler implements WebSocketHandler {

        @Override
        public void afterConnectionEstablished(WebSocketSession session) {
        }

        @Override
        public void handleMessage(WebSocketSession session, WebSocketMessage<?> message) {
        }

        @Override
        public void handleTransportError(WebSocketSession session, Throwable exception) {
        }

        @Override
        public void afterConnectionClosed(WebSocketSession session, CloseStatus closeStatus) {
        }

        @Override
        public boolean supportsPartialMessages() {
            return false;
        }
    }
}
