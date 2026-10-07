package de.locodoko.spieler;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.http.server.ServletServerHttpRequest;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests fuer {@link SpielerSessionHandshakeHandler}.
 * Stellt sicher, dass der WebSocket-Principal korrekt gesetzt wird: mit Session-ID aus
 * den Handshake-Attributen oder mit zufaelliger UUID als Fallback.
 */
class SpielerSessionHandshakeHandlerTest {

    private final SpielerSessionHandshakeHandler handler = new SpielerSessionHandshakeHandler();

    @Test
    void mitGueltigerSessionIdWirdSessionIdAlsPrincipalVerwendet() throws Exception {
        Map<String, Object> attributes = new HashMap<>();
        attributes.put(SpielerSessionHandshakeInterceptor.SPIELER_SESSION_ID_ATTRIBUT, "meine-session-id");
        var request = new ServletServerHttpRequest(new MockHttpServletRequest());

        var principal = handler.determineUser(request, null, attributes);

        assertThat(principal.getName()).isEqualTo("meine-session-id");
    }

    @Test
    void ohneSessionIdWirdZufaelligeUUIDVergeben() throws Exception {
        Map<String, Object> attributes = new HashMap<>();
        var request = new ServletServerHttpRequest(new MockHttpServletRequest());

        var principal = handler.determineUser(request, null, attributes);

        assertThat(principal.getName()).isNotBlank();
        assertThat(principal.getName()).isNotEqualTo("meine-session-id");
    }

    @Test
    void mitLeererSessionIdWirdZufaelligeUUIDVergeben() throws Exception {
        Map<String, Object> attributes = new HashMap<>();
        attributes.put(SpielerSessionHandshakeInterceptor.SPIELER_SESSION_ID_ATTRIBUT, "  ");
        var request = new ServletServerHttpRequest(new MockHttpServletRequest());

        var principal = handler.determineUser(request, null, attributes);

        assertThat(principal.getName()).isNotBlank();
        assertThat(principal.getName()).isNotEqualTo("  ");
    }

    @Test
    void zweiAufruefeOhneSessionIdLiefernVerschiedenePrincipals() throws Exception {
        var request = new ServletServerHttpRequest(new MockHttpServletRequest());

        var p1 = handler.determineUser(request, null, new HashMap<>());
        var p2 = handler.determineUser(request, null, new HashMap<>());

        assertThat(p1.getName()).isNotEqualTo(p2.getName());
    }
}
