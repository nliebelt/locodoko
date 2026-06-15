package de.locodoko.spieler;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
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

    @AfterEach
    void sicherheitskontextBereinigen() {
        SecurityContextHolder.clearContext();
    }

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

    @Test
    void bestehendesVerifiziertesPasswortKonto_wirdBeiVerifiziertemGoogleLoginVerknuepft() throws Exception {
        var passwortKonto = SpielerEntity.mitPasswort("merge-nutzer", "hash", "merge@example.com");
        passwortKonto.verifiziereMail();
        spielerRepository.saveAndFlush(passwortKonto);

        var request = erstelleRequest();
        var response = new MockHttpServletResponse();
        var auth = erstelleOauth2Auth("sub-merge-789", "merge@example.com", "Merge Nutzer", true);

        handler.onAuthenticationSuccess(request, response, auth);

        assertThat(response.getRedirectedUrl()).isEqualTo("/");
        var verknuepft = spielerRepository.findByExternalId("sub-merge-789");
        assertThat(verknuepft).isPresent();
        // Es ist dasselbe Konto (gleiche ID, gleicher Benutzername) — kein zweites angelegt
        assertThat(verknuepft.get().id()).isEqualTo(passwortKonto.id());
        assertThat(verknuepft.get().benutzername()).isEqualTo("merge-nutzer");
    }

    @Test
    void bestehendesUnverifiziertesPasswortKonto_wirdNichtVerknuepft_loginAbgelehnt() throws Exception {
        // email_verifiziert bleibt false (Standard von mitPasswort)
        spielerRepository.saveAndFlush(SpielerEntity.mitPasswort("squatter", "hash", "konflikt@example.com"));

        var request = erstelleRequest();
        var response = new MockHttpServletResponse();
        var auth = erstelleOauth2Auth("sub-konflikt-111", "konflikt@example.com", "Konflikt Nutzer", true);

        handler.onAuthenticationSuccess(request, response, auth);

        assertThat(response.getRedirectedUrl()).isEqualTo("/?fehler=email_konflikt");
        // Keine Verknuepfung, kein zweites Konto
        assertThat(spielerRepository.findByExternalId("sub-konflikt-111")).isEmpty();
    }

    @Test
    void googleMailUnverifiziert_wirdNichtVerknuepft_loginAbgelehnt() throws Exception {
        var passwortKonto = SpielerEntity.mitPasswort("verifiziert-nutzer", "hash", "google-unverif@example.com");
        passwortKonto.verifiziereMail();
        spielerRepository.saveAndFlush(passwortKonto);

        var request = erstelleRequest();
        var response = new MockHttpServletResponse();
        var auth = erstelleOauth2Auth("sub-unverif-222", "google-unverif@example.com", "Unverif Nutzer", false);

        handler.onAuthenticationSuccess(request, response, auth);

        assertThat(response.getRedirectedUrl()).isEqualTo("/?fehler=email_konflikt");
        assertThat(spielerRepository.findByExternalId("sub-unverif-222")).isEmpty();
    }

    @Test
    void emailKonfliktReject_loeschtGhostAuthentifizierungAusContextUndSession() throws Exception {
        // Spring Security setzt die OAuth2-Authentication VOR dem Success-Handler in den SecurityContext.
        // Nach einem Reject darf dieser Ghost-Zustand nicht bestehen bleiben.
        spielerRepository.saveAndFlush(SpielerEntity.mitPasswort("squatter-ghost", "hash", "ghost@example.com"));

        var auth = erstelleOauth2Auth("sub-ghost-444", "ghost@example.com", "Ghost Nutzer", true);
        SecurityContextHolder.getContext().setAuthentication(auth);

        var session = new MockHttpSession();
        var request = new MockHttpServletRequest();
        request.setSession(session);
        var response = new MockHttpServletResponse();

        handler.onAuthenticationSuccess(request, response, auth);

        assertThat(response.getRedirectedUrl()).isEqualTo("/?fehler=email_konflikt");
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        assertThat(session.isInvalid()).isTrue();
    }

    private MockHttpServletRequest erstelleRequest() {
        var request = new MockHttpServletRequest();
        request.setSession(new MockHttpSession());
        return request;
    }

    private OAuth2AuthenticationToken erstelleOauth2Auth(String sub, String email, String name) {
        // Standard: verifizierte Google-Mail (Gmail liefert email_verified=true)
        return erstelleOauth2Auth(sub, email, name, true);
    }

    private OAuth2AuthenticationToken erstelleOauth2Auth(String sub, String email, String name, boolean emailVerifiziert) {
        Map<String, Object> attrs = Map.of(
            "sub", sub, "email", email, "name", name, "email_verified", emailVerifiziert);
        var principal = new DefaultOAuth2User(List.of(), attrs, "sub");
        return new OAuth2AuthenticationToken(principal, List.of(), "google");
    }
}
