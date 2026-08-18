package de.locodoko.spieler;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
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
 * {@code SameSite=lax} ({@code server.servlet.session.cookie.same-site=lax} in
 * application.properties), {@code HttpOnly=true} sowie {@code Secure=true} in Produktion
 * (application-prod.properties). {@code SameSite=lax} schützt vor CSRF-POSTs von fremden
 * Origins (Cookie wird bei Cross-Site-POST nicht mitgesendet) und erlaubt gleichzeitig
 * OAuth2-Redirects von Google (Top-Level-GET-Navigation). {@code SameSite=strict} wurde
 * verworfen, da es das OAuth2-Login bricht: beim Redirect von Google zurück zur App
 * sendet der Browser das Session-Cookie nicht mit, Spring findet den gespeicherten
 * OAuth-State nicht und wirft einen Auth-Fehler.</p>
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
            )
            // Security-Headers: explizit konfiguriert (SECURITY-REVIEW-PRE-M1).
            // X-Frame-Options DENY: Clickjacking-Schutz.
            // X-Content-Type-Options nosniff: verhindert MIME-Sniffing durch Browser.
            // HSTS 1 Jahr + includeSubDomains: erzwingt HTTPS nach erstem Besuch.
            // CSP fehlt bewusst: Phaser 4 WebGL-Renderer benötigt 'unsafe-eval' und Worker-Direktiven;
            //   vollständige CSP-Policy iterativ nach Launch einschränken (M2-Task).
            .headers(headers -> headers
                .frameOptions(frame -> frame.deny())
                .contentTypeOptions(Customizer.withDefaults())
                .httpStrictTransportSecurity(hsts -> hsts
                    .maxAgeInSeconds(31536000)
                    .includeSubDomains(true)
                )
            );

        // OAuth2-Login nur aktivieren wenn echte Google-Credentials konfiguriert sind
        if (googleClientId != null && !googleClientId.isBlank() && !googleClientId.equals("disabled")) {
            http.oauth2Login(oauth2 -> oauth2.successHandler(oAuth2ErfolgsHandler));
        }

        return http.build();
    }
}
