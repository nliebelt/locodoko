package de.locodoko.spieler;

import de.locodoko.spieler.SpielerEntity;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST-Controller fuer Spieler-Session-Verwaltung ({@code /api/spieler/session}).
 *
 * <p>Stellt Endpunkte zum Erstellen (POST), Abrufen (GET) und Aktualisieren (PUT, Namensaenderung)
 * einer Spieler-Session bereit. Die Session wird ueber einen HTTP-Session-Cookie identifiziert.
 * Unbekannte Sessions werden mit 401 Unauthorized abgewiesen.</p>
 */
@Tag(name = "Session", description = "Spieler-Session registrieren, abrufen und Namen aendern")
@RestController
@RequestMapping("/api/spieler/session")
public class SpielerSessionController {

    public static final String AKTUELLER_SPIELER_ATTRIBUT = "aktuellerSpieler";

    private final SpielerSessionService spielerSessionService;

    public SpielerSessionController(SpielerSessionService spielerSessionService) {
        this.spielerSessionService = spielerSessionService;
    }

    @Operation(summary = "Spieler registrieren oder Session erneuern", description = "Erstellt eine neue Spieler-Session oder erneuert eine bestehende. Setzt einen HttpOnly-Session-Cookie. Gibt 201 zurueck wenn neu angelegt, 200 wenn bereits vorhanden.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Bestehende Session erneuert"),
        @ApiResponse(responseCode = "201", description = "Neue Session angelegt"),
        @ApiResponse(responseCode = "400", description = "Ungueliger Name (leer oder zu lang)")
    })
    @PostMapping
    public ResponseEntity<SpielerSessionAntwort> registriereSpieler(
        @Valid @RequestBody SpielerNameAnfrage anfrage,
        HttpServletRequest request
    ) {
        SpielerRegistrierung registrierung = spielerSessionService.registriereSpieler(request, anfrage.name());
        HttpStatus status = registrierung.neuAngelegt() ? HttpStatus.CREATED : HttpStatus.OK;
        SpielerEntity spieler = registrierung.spieler();
        return ResponseEntity.status(status).body(
            SpielerSessionAntwort.aus(spieler, spielerSessionService.ladeAktiveTischId(spieler.id()))
        );
    }

    @Operation(summary = "Aktuelle Session abrufen", description = "Gibt die aktuelle Spieler-Session zurueck, inklusive aktiver Tisch-ID fuer Session-Recovery nach Tab-Reload.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Session erfolgreich abgerufen"),
        @ApiResponse(responseCode = "401", description = "Keine gueltige Session")
    })
    @GetMapping
    public SpielerSessionAntwort gibAktuellenSpieler(HttpServletRequest request) {
        SpielerEntity spieler = aktuellerSpieler(request);
        return SpielerSessionAntwort.aus(spieler, spielerSessionService.ladeAktiveTischId(spieler.id()));
    }

    @Operation(summary = "Spielernamen aendern", description = "Aendert den Anzeigenamen des angemeldeten Spielers. Nur ausserhalb einer laufenden Partie erlaubt.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Name erfolgreich geaendert"),
        @ApiResponse(responseCode = "400", description = "Ungueliger Name"),
        @ApiResponse(responseCode = "401", description = "Keine gueltige Session"),
        @ApiResponse(responseCode = "409", description = "Namensaenderung waehrend Partie nicht erlaubt")
    })
    @PutMapping
    public SpielerSessionAntwort aendereNamen(
        @Valid @RequestBody SpielerNameAnfrage anfrage,
        HttpServletRequest request
    ) {
        HttpSession session = request.getSession(false);
        SpielerEntity spieler = spielerSessionService.aendereNamen(session.getId(), anfrage.name());
        request.setAttribute(AKTUELLER_SPIELER_ATTRIBUT, spieler);
        return SpielerSessionAntwort.aus(spieler, spielerSessionService.ladeAktiveTischId(spieler.id()));
    }

    private SpielerEntity aktuellerSpieler(HttpServletRequest request) {
        return (SpielerEntity) request.getAttribute(AKTUELLER_SPIELER_ATTRIBUT);
    }
}
