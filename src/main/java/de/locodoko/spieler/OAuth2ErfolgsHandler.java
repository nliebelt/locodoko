package de.locodoko.spieler;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;

/**
 * Wird nach erfolgreichem OAuth2-Login aufgerufen.
 * Erzeugt oder findet einen Spieler anhand der OAuth2-Subject-ID.
 * Setzt die Session-ID, damit der bestehende Session-Flow weiterhin funktioniert.
 */
@Component
public class OAuth2ErfolgsHandler implements AuthenticationSuccessHandler {

    private static final Logger LOGGER = LoggerFactory.getLogger(OAuth2ErfolgsHandler.class);

    private final SpielerRepository spielerRepository;
    private final SpielerSessionEigenschaften eigenschaften;

    public OAuth2ErfolgsHandler(SpielerRepository spielerRepository,
                                SpielerSessionEigenschaften eigenschaften) {
        this.spielerRepository = spielerRepository;
        this.eigenschaften = eigenschaften;
    }

    @Override
    @Transactional
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
                                        Authentication authentication) throws IOException, ServletException {
        if (!(authentication instanceof OAuth2AuthenticationToken token)) {
            response.sendRedirect("/");
            return;
        }

        OAuth2User oauth2Nutzer = token.getPrincipal();
        String sub = oauth2Nutzer.getAttribute("sub");
        String email = oauth2Nutzer.getAttribute("email");
        String name = oauth2Nutzer.getAttribute("name");

        SpielerEntity spieler = findeOderErzeuge(sub, email, name != null ? name : "Spieler");
        spieler.setzeSessionId(request.getSession(true).getId());
        spielerRepository.saveAndFlush(spieler);

        request.getSession().setMaxInactiveInterval((int) eigenschaften.getTimeout().toSeconds());

        LOGGER.info("OAuth2-Login erfolgreich fuer Spieler {} (sub={})", spieler.id(), sub);
        response.sendRedirect("/");
    }

    private SpielerEntity findeOderErzeuge(String sub, String email, String name) {
        return spielerRepository.findByExternalId(sub)
            .orElseGet(() -> {
                LOGGER.info("Neuer OAuth2-Spieler wird angelegt (sub={})", sub);
                return spielerRepository.saveAndFlush(SpielerEntity.mitOauth2(sub, email, name));
            });
    }
}
