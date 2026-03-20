package de.locodoko.spielverwaltung.session;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

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
