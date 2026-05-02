package de.locodoko.spieler;

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
 */
@Configuration
@EnableMethodSecurity
@ConditionalOnWebApplication
public class SecurityConfig {

    private final OAuth2ErfolgsHandler oAuth2ErfolgsHandler;
    private final RateLimitingFilter rateLimitingFilter;

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
                // WebSocket-Handshake
                .requestMatchers("/ws/**").permitAll()
                // Infrastruktur und statische Ressourcen
                .requestMatchers("/actuator/**").permitAll()
                .requestMatchers("/swagger-ui/**", "/v3/api-docs/**", "/swagger-ui.html").permitAll()
                .requestMatchers("/", "/index.html", "/assets/**", "/**/*.js", "/**/*.css",
                    "/**/*.png", "/**/*.ico", "/**/*.svg", "/**/*.woff2").permitAll()
                // Alle anderen Anfragen erfordern Spring-Security-Authentifizierung
                .anyRequest().authenticated()
            )
            .oauth2Login(oauth2 -> oauth2
                .successHandler(oAuth2ErfolgsHandler)
            )
            .formLogin(form -> form.disable())
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session
                .sessionFixation(fix -> fix.changeSessionId())
            );
        return http.build();
    }
}
