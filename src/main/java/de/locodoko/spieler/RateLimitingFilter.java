package de.locodoko.spieler;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Rate-Limiting fuer den Login-Endpunkt: max. 10 Versuche pro Minute pro IP.
 * Einfache In-Memory-Implementierung mit ConcurrentHashMap.
 */
@Component
public class RateLimitingFilter extends OncePerRequestFilter {

    private static final int MAX_VERSUCHE = 10;
    private static final long FENSTER_SEKUNDEN = 60;
    private static final String LOGIN_PFAD = "/api/auth/login";

    private final Map<String, Zugangsprotokoll> zugriffe = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        if (!LOGIN_PFAD.equals(request.getRequestURI()) || !"POST".equalsIgnoreCase(request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }

        String ip = request.getRemoteAddr();
        Zugangsprotokoll protokoll = zugriffe.compute(ip, (schluessel, bestehendes) -> {
            Instant jetzt = Instant.now();
            if (bestehendes == null || bestehendes.fensterAbgelaufen(jetzt)) {
                return new Zugangsprotokoll(jetzt, 1);
            }
            return bestehendes.inkrement();
        });

        if (protokoll.anzahl > MAX_VERSUCHE) {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType("application/json");
            response.getWriter().write(
                "{\"fehlerCode\":\"RATE_LIMIT_UEBERSCHRITTEN\",\"nachricht\":\"Zu viele Login-Versuche. Bitte in einer Minute erneut versuchen.\"}"
            );
            return;
        }

        filterChain.doFilter(request, response);
    }

    private record Zugangsprotokoll(Instant fensterStart, int anzahl) {

        boolean fensterAbgelaufen(Instant jetzt) {
            return jetzt.isAfter(fensterStart.plusSeconds(FENSTER_SEKUNDEN));
        }

        Zugangsprotokoll inkrement() {
            return new Zugangsprotokoll(fensterStart, anzahl + 1);
        }
    }
}
