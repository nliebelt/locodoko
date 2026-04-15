package de.locodoko.tisch;

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
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;

/**
 * Oeffentlicher Einladungslink-Controller.
 * Behandelt {@code GET /join/{code}} — tritt dem Tisch bei und leitet zur Hauptseite weiter.
 */
@Tag(name = "Einladung", description = "Oeffentliche Einladungslinks fuer private Tische")
@RestController
public class EinladungsController {

    private static final Logger LOGGER = LoggerFactory.getLogger(EinladungsController.class);

    private final TischVerwaltungsService tischVerwaltungsService;
    private final SpielerSessionService spielerSessionService;

    public EinladungsController(TischVerwaltungsService tischVerwaltungsService, SpielerSessionService spielerSessionService) {
        this.tischVerwaltungsService = tischVerwaltungsService;
        this.spielerSessionService = spielerSessionService;
    }

    @Operation(summary = "Per Einladungslink beitreten", description = "Tritt dem Tisch mit dem angegebenen Einladungscode bei und leitet zur Hauptseite weiter.")
    @ApiResponses({
        @ApiResponse(responseCode = "302", description = "Erfolgreich beigetreten, Weiterleitung zur Hauptseite"),
        @ApiResponse(responseCode = "401", description = "Keine gueltige Spieler-Session"),
        @ApiResponse(responseCode = "404", description = "Kein Tisch mit diesem Code gefunden"),
        @ApiResponse(responseCode = "409", description = "Tisch voll oder Partie bereits gestartet")
    })
    @GetMapping("/join/{code}")
    public ResponseEntity<Void> beitretenPerLink(
        @Parameter(description = "8-stelliger Einladungscode") @PathVariable String code,
        HttpServletRequest request
    ) {
        SpielerEntity spieler = spielerSessionService.ladeAktivenSpieler(request);
        LOGGER.info("Spieler {} tritt via Einladungslink mit Code '{}' bei", spieler.id(), code);
        TischAntwort antwort = tischVerwaltungsService.beitretenViaCode(code, spieler);
        return ResponseEntity.status(HttpStatus.FOUND)
            .location(URI.create("/?tisch=" + antwort.id()))
            .build();
    }
}
