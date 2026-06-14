package de.locodoko.spieler;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;



import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integrationstests fuer OAuth2ErfolgsHandler.
 * Wichtig: Spieler-Anlage muss idempotent sein — wiederholter Login darf kein Duplikat erzeugen.
 */
@SpringBootTest
@Transactional
class OAuth2ErfolgsHandlerIntegrationTest {

    @Autowired
    private OAuth2ErfolgsHandler handler;

    @Autowired
    private SpielerRepository spielerRepository;

    @Test
    void neuerSpieler_wirdBeiErstemOAuth2LoginAngelegt() throws Exception {
        var request = erstelleRequest();
        var response = new MockHttpServletResponse();
        var auth = erstelleOauth2Auth("google-sub-neu-123", "neu@example.com", "Neu Spieler");

        handler.onAuthenticationSuccess(request, response, auth);

        assertThat(spielerRepository.findByExternalId("google-sub-neu-123")).isPresent();
        assertThat(response.getRedirectedUrl()).isEqualTo("/");
    }

    @Test
    void existierenderSpieler_wirdBeiWiederholtemLoginGefunden_keinDuplikat() throws Exception {
        spielerRepository.saveAndFlush(SpielerEntity.mitOauth2("sub-existiert-456", "alt@example.com", "Alt Spieler"));

        var request = erstelleRequest();
        var response = new MockHttpServletResponse();
        var auth = erstelleOauth2Auth("sub-existiert-456", "alt@example.com", "Alt Spieler");

        handler.onAuthenticationSuccess(request, response, auth);

        // Exakt ein Spieler mit dieser externalId — kein Duplikat angelegt
        assertThat(spielerRepository.findByExternalId("sub-existiert-456")).isPresent();
        assertThat(response.getRedirectedUrl()).isEqualTo("/");
    }

    @Test
    void nichtOAuth2Authentication_leiteteNurUmOhneAnlage() throws Exception {
        var request = erstelleRequest();
        var response = new MockHttpServletResponse();
        long spielerVorher = spielerRepository.count();

        var auth = new UsernamePasswordAuthenticationToken("nutzer", "passwort");
        handler.onAuthenticationSuccess(request, response, auth);

        assertThat(response.getRedirectedUrl()).isEqualTo("/");
        assertThat(spielerRepository.count()).isEqualTo(spielerVorher);
    }

    private MockHttpServletRequest erstelleRequest() {
        var request = new MockHttpServletRequest();
        request.setSession(new MockHttpSession());
        return request;
    }

    private OAuth2AuthenticationToken erstelleOauth2Auth(String sub, String email, String name) {
        Map<String, Object> attrs = Map.of("sub", sub, "email", email, "name", name);
        var principal = new DefaultOAuth2User(List.of(), attrs, "sub");
        return new OAuth2AuthenticationToken(principal, List.of(), "google");
    }
}
