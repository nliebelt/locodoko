package de.locodoko.spieler;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.util.Optional;

/**
 * Wird nach erfolgreichem OAuth2-Login aufgerufen.
 * Erzeugt, findet oder verknuepft einen Spieler anhand der OAuth2-Subject-ID.
 * Setzt die Session-ID, damit der bestehende Session-Flow weiterhin funktioniert.
 *
 * <p><b>Account-Linking-Entscheidung (bewusst, dokumentiert — Plan-Task
 * DECISION-OAUTH-ACCOUNT-LINKING):</b> Der Spieler wird primaer ueber die OAuth2-Subject-ID
 * ({@code externalId}) aufgeloest. Existiert noch kein OAuth-Konto, aber bereits ein
 * <b>Passwort-Konto mit derselben E-Mail</b>, wird <b>nur dann</b> sicher verknuepft, wenn
 * <b>beide Seiten den Mailbox-Besitz bewiesen haben</b>:
 * <ol>
 *   <li>Google liefert {@code email_verified=true} (der Einloggende besitzt die Mailbox), und</li>
 *   <li>das bestehende Konto ist bereits {@code email_verifiziert=true}.</li>
 * </ol>
 * Sind beide erfuellt, wird {@code externalId} auf das bestehende Konto gesetzt — derselbe
 * Mensch, beide Login-Wege fuehren danach zu einem Konto. Das verlangen beider Flags schliesst
 * den Takeover-Fall aus, bei dem ein Angreifer ein unverifiziertes Passwort-Konto auf eine
 * fremde E-Mail anlegt und ueber den Google-Login uebernommen wuerde.
 *
 * <p><b>Nicht verknuepfbar</b> (bestehendes Konto unverifiziert oder Google
 * {@code email_verified=false}): Der Login wird <b>sauber abgelehnt</b> (Redirect mit
 * {@code ?fehler=email_konflikt}) — es entsteht kein zweites Konto (der Unique-Index auf
 * {@code email} verboete es ohnehin) und keine unsichere Verknuepfung. Der Lockout-Edge-Case
 * (jemand sitzt mit einem unverifizierten Konto auf der eigenen E-Mail) ist via Passwort-Reset
 * selbst-heilbar. Die Verknuepfung greift praktisch erst, sobald der E-Mail-Versand (OPS-EMAIL)
 * live ist, da vorher kein Passwort-Konto verifiziert sein kann.</p>
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
        boolean googleEmailVerifiziert = Boolean.TRUE.equals(oauth2Nutzer.<Boolean>getAttribute("email_verified"));

        Optional<SpielerEntity> konto =
            findeVerknuepfeOderErzeuge(sub, email, googleEmailVerifiziert, name != null ? name : "Spieler");

        if (konto.isEmpty()) {
            LOGGER.warn("OAuth2-Login abgelehnt: E-Mail gehoert bereits einem nicht verknuepfbaren Konto (sub={})", sub);
            leereGhostAuthentifizierung(request);
            response.sendRedirect("/?fehler=email_konflikt");
            return;
        }

        SpielerEntity spieler = konto.get();
        spieler.setzeSessionId(request.getSession(true).getId());
        try {
            spielerRepository.saveAndFlush(spieler);
        } catch (DataIntegrityViolationException e) {
            // Sicherheitsnetz gegen Race-Conditions auf dem email-Unique-Index (TOCTOU).
            LOGGER.warn("OAuth2-Login abgelehnt: Eindeutigkeits-Konflikt beim Speichern (sub={})", sub, e);
            leereGhostAuthentifizierung(request);
            response.sendRedirect("/?fehler=email_konflikt");
            return;
        }

        request.getSession().setMaxInactiveInterval((int) eigenschaften.getTimeout().toSeconds());

        LOGGER.info("OAuth2-Login erfolgreich fuer Spieler {} (sub={})", spieler.id(), sub);
        response.sendRedirect("/");
    }

    /**
     * Loescht die von Spring Security vor dem Success-Handler gesetzte Ghost-Authentifizierung
     * aus SecurityContext und Session, damit ein abgelehnter Login keinen halb-authentifizierten
     * Zustand hinterlaesst (Defense-in-Depth).
     */
    private void leereGhostAuthentifizierung(HttpServletRequest request) {
        SecurityContextHolder.clearContext();
        var session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
    }

    /**
     * Liefert das Konto fuer den Login: bestehendes OAuth-Konto, sicher verknuepftes
     * Passwort-Konto oder ein neu erzeugtes OAuth-Konto. Ein leeres {@link Optional} signalisiert
     * einen nicht aufloesbaren E-Mail-Konflikt (der Aufrufer lehnt den Login dann ab).
     */
    private Optional<SpielerEntity> findeVerknuepfeOderErzeuge(String sub, String email,
                                                               boolean googleEmailVerifiziert, String name) {
        Optional<SpielerEntity> perExternalId = spielerRepository.findByExternalId(sub);
        if (perExternalId.isPresent()) {
            return perExternalId;
        }

        Optional<SpielerEntity> perEmail = email != null ? spielerRepository.findByEmail(email) : Optional.empty();
        if (perEmail.isPresent()) {
            SpielerEntity bestehend = perEmail.get();
            if (googleEmailVerifiziert && bestehend.istEmailVerifiziert()) {
                LOGGER.info("Verknuepfe bestehendes Konto {} mit Google-OAuth (sub={})", bestehend.id(), sub);
                bestehend.verknuepfeMitOauth2(sub);
                return Optional.of(bestehend);
            }
            // Unsicher: mindestens eine Seite hat den Mailbox-Besitz nicht bewiesen -> ablehnen.
            return Optional.empty();
        }

        LOGGER.info("Neuer OAuth2-Spieler wird angelegt (sub={})", sub);
        return Optional.of(SpielerEntity.mitOauth2(sub, email, name));
    }
}
