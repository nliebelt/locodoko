package de.locodoko.lobby;

import de.locodoko.session.SpielerEntity;
import de.locodoko.session.SpielerSessionService;
import de.locodoko.session.SpielerSessionUngueltigException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/** REST-Controller fuer Partie-bezogene Endpunkte. Alle Anfragen erfordern eine gueltige Spieler-Session. */
@RestController
@RequestMapping("/api/partien")
public class PartieController {

    private static final Logger LOGGER = LoggerFactory.getLogger(PartieController.class);

    private final TischService tischService;
    private final SpielerSessionService spielerSessionService;

    public PartieController(TischService tischService, SpielerSessionService spielerSessionService) {
        this.tischService = tischService;
        this.spielerSessionService = spielerSessionService;
    }

    /**
     * Gibt den aktuellen Partiestand zurueck. Nur fuer Spieler mit gueliger Session zugaenglich,
     * damit keine sensiblen Spielstandsdaten (z.B. Handkarten, Ansagen) anonym abrufbar sind.
     */
    @GetMapping("/{id}/stand")
    public PartieStandAntwort gibPartieStand(@PathVariable UUID id, HttpServletRequest request) {
        SpielerEntity spieler = ladeAktivenSpieler(request);
        LOGGER.info("Partiestand fuer Partie {} von Spieler {} abgefragt", id, spieler.id());
        return tischService.ladePartieStand(id, spieler);
    }

    /** Validiert die HTTP-Session und laedt den zugehoerigen Spieler — wirft 401 bei fehlender oder abgelaufener Session. */
    private SpielerEntity ladeAktivenSpieler(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session == null) {
            throw new SpielerSessionUngueltigException("Es ist keine aktive Spieler-Session vorhanden.");
        }
        spielerSessionService.uebernehmeTimeout(session);
        return spielerSessionService.ladeAktivenSpieler(session.getId());
    }
}
