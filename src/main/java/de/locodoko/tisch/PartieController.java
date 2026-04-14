package de.locodoko.tisch;

import de.locodoko.partie.PartieId;
import de.locodoko.spieler.SpielerEntity;
import de.locodoko.spieler.SpielerSessionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/** REST-Controller fuer Partie-bezogene Endpunkte. Alle Anfragen erfordern eine gueltige Spieler-Session. */
@Tag(name = "Partien", description = "Aktuellen Partiestand abrufen")
@RestController
@RequestMapping("/api/partien")
public class PartieController {

    private static final Logger LOGGER = LoggerFactory.getLogger(PartieController.class);

    private final SpielAktionsService spielAktionsService;
    private final SpielerSessionService spielerSessionService;

    public PartieController(SpielAktionsService spielAktionsService, SpielerSessionService spielerSessionService) {
        this.spielAktionsService = spielAktionsService;
        this.spielerSessionService = spielerSessionService;
    }

    /**
     * Gibt den aktuellen Partiestand zurueck. Nur fuer Spieler mit gueliger Session zugaenglich,
     * damit keine sensiblen Spielstandsdaten (z.B. Handkarten, Ansagen) anonym abrufbar sind.
     */
    @Operation(summary = "Partiestand abrufen", description = "Gibt einen spielerspezifischen Snapshot des aktuellen Partiestands zurueck. Die Handkarten anderer Spieler werden geredaktiert. Erfordert eine gueltige Session.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Partiestand erfolgreich abgerufen"),
        @ApiResponse(responseCode = "401", description = "Keine gueltige Spieler-Session"),
        @ApiResponse(responseCode = "404", description = "Partie nicht gefunden")
    })
    @GetMapping("/{id}/stand")
    public PartieStandAntwort gibPartieStand(@Parameter(description = "Partie-ID") @PathVariable UUID id, HttpServletRequest request) {
        SpielerEntity spieler = ladeAktivenSpieler(request);
        LOGGER.info("Partiestand fuer Partie {} von Spieler {} abgefragt", id, spieler.id());
        return spielAktionsService.ladePartieStand(PartieId.von(id), spieler);
    }

    private SpielerEntity ladeAktivenSpieler(HttpServletRequest request) {
        return spielerSessionService.ladeAktivenSpieler(request);
    }
}
