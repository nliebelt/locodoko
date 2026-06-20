package de.locodoko.spieler;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * Spring Security Konfiguration: OAuth2-Login (Google) + Username/Passwort parallel.
 * CSRF deaktiviert (SPA + SameSite-Cookie). Session-Fixation: changeSessionId.
 *
 * <p>Sicherheitsmodell: Game-Endpunkte (/api/tische/**, /api/spieler/**, etc.) sind auf
 * Spring-Security-Ebene offen — ihre Absicherung erfolgt auf Controller-/Interceptor-Ebene
 * via {@link de.locodoko.spieler.SpielerSessionService}. Nur unbekannte Endpunkte ausserhalb
 * dieser Liste erfordern Spring-Security-Authentifizierung.</p>
 *
 * <p><b>CSRF-Entscheidung (bewusst, dokumentiert):</b> CSRF-Schutz ist global deaktiviert.
 * Der Schutz mutierender Endpunkte stützt sich stattdessen auf das Session-Cookie mit
 * {@code SameSite=strict} ({@code server.servlet.session.cookie.same-site=strict} in
 * application.properties), {@code HttpOnly=true} sowie {@code Secure=true} in Produktion
 * (application-prod.properties). Ein {@code SameSite=strict}-Cookie wird vom Browser bei
 * Cross-Site-Requests nicht mitgesendet, wodurch klassische CSRF-POSTs von fremden Origins
 * keine authentifizierte Session erhalten. Bewusst akzeptierter Trade-off: <b>kein
 * Defense-in-Depth</b> durch zusätzliche CSRF-Token. Sollte künftig ein weniger striktes
 * SameSite (z.&nbsp;B. {@code Lax} für OAuth-Redirect-Komfort) nötig werden oder ein
 * Cross-Origin-Frontend hinzukommen, muss diese Entscheidung neu bewertet und ein
 * {@code CookieCsrfTokenRepository} aktiviert werden (Frontend müsste das Token mitsenden).</p>
 */
@Configuration
@EnableMethodSecurity
@ConditionalOnWebApplication
public class SecurityConfig {

    private final OAuth2ErfolgsHandler oAuth2ErfolgsHandler;
    private final RateLimitingFilter rateLimitingFilter;

    @Value("${spring.security.oauth2.client.registration.google.client-id:disabled}")
    private String googleClientId;

    public SecurityConfig(OAuth2ErfolgsHandler oAuth2ErfolgsHandler, RateLimitingFilter rateLimitingFilter) {
        this.oAuth2ErfolgsHandler = oAuth2ErfolgsHandler;
        this.rateLimitingFilter = rateLimitingFilter;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .addFilterBefore(rateLimitingFilter, UsernamePasswordAuthenticationFilter.class)
            .authorizeHttpRequests(auth -> auth
                // Authentifizierungs-Endpunkte (Login, Registrierung, Logout)
                .requestMatchers("/api/auth/**").permitAll()
                // Spieler-Endpunkte: Schutz erfolgt via SpielerSessionValidierungsInterceptor
                // und SpielerSessionService im Controller
                .requestMatchers("/api/spieler/**").permitAll()
                // Tisch- und Partie-Endpunkte: Controller validiert Session selbst
                .requestMatchers("/api/tische/**").permitAll()
                .requestMatchers("/api/partien/**").permitAll()
                // Oeffentliche Einladungslinks
                .requestMatchers("/join/**").permitAll()
                // Systemstatus (explizit ohne Authentifizierungsschutz dokumentiert)
                .requestMatchers("/api/system/**").permitAll()
                // Frontend-Logging (diagnostisch)
                .requestMatchers("/api/debug/**").permitAll()
                // Beta-Feedback und In-App-Bugreport (Auth wird im Controller geprüft)
                .requestMatchers("/api/feedback").permitAll()
                .requestMatchers("/api/bugreport").permitAll()
                // WebSocket-Handshake
                .requestMatchers("/ws/**").permitAll()
                // Infrastruktur und statische Ressourcen
                .requestMatchers("/actuator/**").permitAll()
                .requestMatchers("/swagger-ui/**", "/v3/api-docs/**", "/swagger-ui.html").permitAll()
                .requestMatchers("/", "/index.html", "/assets/**", "/**/*.js", "/**/*.css",
                    "/**/*.png", "/**/*.ico", "/**/*.svg", "/**/*.woff2").permitAll()
                // Rechtliche Pflichtseiten (Clean-URL-Weiterleitungen + statische HTML)
                .requestMatchers("/impressum", "/impressum.html",
                    "/datenschutz", "/datenschutz.html",
                    "/agb", "/agb.html").permitAll()
                // Alle anderen Anfragen erfordern Spring-Security-Authentifizierung
                .anyRequest().authenticated()
            )
            .formLogin(form -> form.disable())
            // CSRF bewusst deaktiviert — Schutz via SameSite=strict-Session-Cookie statt Token.
            // Begründung und Trade-off siehe Klassen-Javadoc (CSRF-Entscheidung).
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session
                .sessionFixation(fix -> fix.changeSessionId())
            );

        // OAuth2-Login nur aktivieren wenn echte Google-Credentials konfiguriert sind
        if (googleClientId != null && !googleClientId.isBlank() && !googleClientId.equals("disabled")) {
            http.oauth2Login(oauth2 -> oauth2.successHandler(oAuth2ErfolgsHandler));
        }

        return http.build();
    }
}
