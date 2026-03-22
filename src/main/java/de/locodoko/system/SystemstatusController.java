package de.locodoko.system;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** REST-Controller fuer Systemstatus-Endpunkte. Kein Authentifizierungsschutz. */
@Tag(name = "System", description = "Systemstatus und Gesundheitspruefung")
@RestController
@RequestMapping("/api/system")
public class SystemstatusController {

    private final String aktivesProfil;

    public SystemstatusController(@Value("${spring.profiles.active:${spring.profiles.default:default}}") String aktivesProfil) {
        this.aktivesProfil = aktivesProfil;
    }

    @Operation(summary = "Systemstatus abrufen", description = "Gibt den Betriebsstatus und das aktive Spring-Profil zurueck. Kein Authentifizierungsschutz.")
    @ApiResponse(responseCode = "200", description = "System ist bereit")
    @GetMapping("/status")
    public SystemstatusAntwort status() {
        return new SystemstatusAntwort("locodoko", "bereit", aktivesProfil);
    }
}
