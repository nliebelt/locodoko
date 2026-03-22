package de.locodoko.session;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * MVC-Interceptor zum Schutz des Session-Endpunkts vor unbekannten Sessions.
 *
 * <p>Fuer {@code POST /api/spieler/session} wird keine Validierung durchgefuehrt
 * (Session wird erst erstellt). Fuer alle anderen Methoden wird geprueft,
 * ob eine gueltige Spieler-Session in der HTTP-Session vorliegt.</p>
 */
@Component
public class SpielerSessionValidierungsInterceptor implements HandlerInterceptor {

    private final SpielerSessionService spielerSessionService;

    public SpielerSessionValidierungsInterceptor(SpielerSessionService spielerSessionService) {
        this.spielerSessionService = spielerSessionService;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if ("POST".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        HttpSession session = request.getSession(false);
        if (session == null) {
            throw new SpielerSessionUngueltigException("Es ist keine aktive Spieler-Session vorhanden.");
        }

        spielerSessionService.uebernehmeTimeout(session);
        request.setAttribute(
            SpielerSessionController.AKTUELLER_SPIELER_ATTRIBUT,
            spielerSessionService.ladeAktivenSpieler(session.getId())
        );
        return true;
    }
}
