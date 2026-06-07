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
 * Rate-Limiting fuer oeffentlich erreichbare POST-Endpunkte.
 * Login: max. 10/min. Registrierung: max. 10/10min. Passwort-Reset: max. 5/10min.
 * Debug-Log: max. 30/min (verhindert Log-Flooding). Bugreport: max. 5/10min.
 */
@Component
public class RateLimitingFilter extends OncePerRequestFilter {

    private static final int MAX_LOGIN_VERSUCHE = 10;
    private static final long LOGIN_FENSTER_SEKUNDEN = 60;
    private static final String LOGIN_PFAD = "/api/auth/login";

    private static final int MAX_BUGREPORT_VERSUCHE = 5;
    private static final long BUGREPORT_FENSTER_SEKUNDEN = 600;
    private static final String BUGREPORT_PFAD = "/api/bugreport";

    private static final int MAX_REGISTER_VERSUCHE = 10;
    private static final long REGISTER_FENSTER_SEKUNDEN = 600;
    private static final String REGISTER_PFAD = "/api/auth/register";

    private static final int MAX_RESET_VERSUCHE = 5;
    private static final long RESET_FENSTER_SEKUNDEN = 600;
    private static final String RESET_PFAD = "/api/auth/passwort-reset-anfragen";

    private static final int MAX_DEBUG_VERSUCHE = 30;
    private static final long DEBUG_FENSTER_SEKUNDEN = 60;
    private static final String DEBUG_LOG_PFAD = "/api/debug/log";

    private final Map<String, Zugangsprotokoll> loginZugriffe = new ConcurrentHashMap<>();
    private final Map<String, Zugangsprotokoll> bugreportZugriffe = new ConcurrentHashMap<>();
    private final Map<String, Zugangsprotokoll> registerZugriffe = new ConcurrentHashMap<>();
    private final Map<String, Zugangsprotokoll> resetZugriffe = new ConcurrentHashMap<>();
    private final Map<String, Zugangsprotokoll> debugZugriffe = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        if (!"POST".equalsIgnoreCase(request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }

        String meldung = pruefRateLimit(request.getRequestURI(), request.getRemoteAddr());
        if (meldung != null) {
            schreibeRateLimitAntwort(response, meldung);
            return;
        }

        filterChain.doFilter(request, response);
    }

    private String pruefRateLimit(String uri, String ip) {
        return switch (uri) {
            case LOGIN_PFAD -> {
                if (istRateLimitUeberschritten(ip, loginZugriffe, MAX_LOGIN_VERSUCHE, LOGIN_FENSTER_SEKUNDEN))
                    yield "Zu viele Login-Versuche. Bitte in einer Minute erneut versuchen.";
                yield null;
            }
            case BUGREPORT_PFAD -> {
                if (istRateLimitUeberschritten(ip, bugreportZugriffe, MAX_BUGREPORT_VERSUCHE, BUGREPORT_FENSTER_SEKUNDEN))
                    yield "Zu viele Bug-Reports. Bitte in 10 Minuten erneut versuchen.";
                yield null;
            }
            case REGISTER_PFAD -> {
                if (istRateLimitUeberschritten(ip, registerZugriffe, MAX_REGISTER_VERSUCHE, REGISTER_FENSTER_SEKUNDEN))
                    yield "Zu viele Registrierungsversuche. Bitte in 10 Minuten erneut versuchen.";
                yield null;
            }
            case RESET_PFAD -> {
                if (istRateLimitUeberschritten(ip, resetZugriffe, MAX_RESET_VERSUCHE, RESET_FENSTER_SEKUNDEN))
                    yield "Zu viele Passwort-Reset-Anfragen. Bitte in 10 Minuten erneut versuchen.";
                yield null;
            }
            case DEBUG_LOG_PFAD -> {
                if (istRateLimitUeberschritten(ip, debugZugriffe, MAX_DEBUG_VERSUCHE, DEBUG_FENSTER_SEKUNDEN))
                    yield "Zu viele Log-Anfragen.";
                yield null;
            }
            default -> null;
        };
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
