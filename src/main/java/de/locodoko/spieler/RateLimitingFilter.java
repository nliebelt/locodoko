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
 * Rate-Limiting fuer Login- und Bugreport-Endpunkte.
 * Login: max. 10 Versuche pro Minute pro IP.
 * Bugreport: max. 5 Berichte pro 10 Minuten pro IP.
 */
@Component
public class RateLimitingFilter extends OncePerRequestFilter {

    private static final int MAX_LOGIN_VERSUCHE = 10;
    private static final long LOGIN_FENSTER_SEKUNDEN = 60;
    private static final String LOGIN_PFAD = "/api/auth/login";

    private static final int MAX_BUGREPORT_VERSUCHE = 5;
    private static final long BUGREPORT_FENSTER_SEKUNDEN = 600;
    private static final String BUGREPORT_PFAD = "/api/bugreport";

    private final Map<String, Zugangsprotokoll> loginZugriffe = new ConcurrentHashMap<>();
    private final Map<String, Zugangsprotokoll> bugreportZugriffe = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String uri = request.getRequestURI();
        String methode = request.getMethod();

        if (LOGIN_PFAD.equals(uri) && "POST".equalsIgnoreCase(methode)) {
            if (istRateLimitUeberschritten(request.getRemoteAddr(), loginZugriffe,
                    MAX_LOGIN_VERSUCHE, LOGIN_FENSTER_SEKUNDEN)) {
                schreibeRateLimitAntwort(response, "Zu viele Login-Versuche. Bitte in einer Minute erneut versuchen.");
                return;
            }
        } else if (BUGREPORT_PFAD.equals(uri) && "POST".equalsIgnoreCase(methode)) {
            if (istRateLimitUeberschritten(request.getRemoteAddr(), bugreportZugriffe,
                    MAX_BUGREPORT_VERSUCHE, BUGREPORT_FENSTER_SEKUNDEN)) {
                schreibeRateLimitAntwort(response, "Zu viele Bug-Reports. Bitte in 10 Minuten erneut versuchen.");
                return;
            }
        }

        filterChain.doFilter(request, response);
    }

    private boolean istRateLimitUeberschritten(String ip, Map<String, Zugangsprotokoll> zugriffe,
                                                int maxVersuche, long fensterSekunden) {
        Zugangsprotokoll protokoll = zugriffe.compute(ip, (schluessel, bestehendes) -> {
            Instant jetzt = Instant.now();
            if (bestehendes == null || bestehendes.fensterAbgelaufen(jetzt, fensterSekunden)) {
                return new Zugangsprotokoll(jetzt, 1);
            }
            return bestehendes.inkrement();
        });
        return protokoll.anzahl > maxVersuche;
    }

    private void schreibeRateLimitAntwort(HttpServletResponse response, String nachricht) throws IOException {
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setContentType("application/json");
        response.getWriter().write(
            "{\"fehlerCode\":\"RATE_LIMIT_UEBERSCHRITTEN\",\"nachricht\":\"" + nachricht + "\"}"
        );
    }

    private record Zugangsprotokoll(Instant fensterStart, int anzahl) {

        boolean fensterAbgelaufen(Instant jetzt, long fensterSekunden) {
            return jetzt.isAfter(fensterStart.plusSeconds(fensterSekunden));
        }

        Zugangsprotokoll inkrement() {
            return new Zugangsprotokoll(fensterStart, anzahl + 1);
        }
    }
}
