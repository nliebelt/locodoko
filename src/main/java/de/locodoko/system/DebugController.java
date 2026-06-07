package de.locodoko.system;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Hilfs-Controller fuer diagnostische Zwecke.
 * Ermoeglicht dem Frontend, Log-Ausgaben an den Server zu senden, damit diese
 * in der zentralen Log-Datei erscheinen (wichtig fuer Remote-Debugging und E2E).
 */
@Tag(name = "Debug", description = "Diagnose-Endpunkte")
@Validated
@RestController
@RequestMapping("/api/debug")
public class DebugController {

    private static final Logger FRONTEND_LOGGER = LoggerFactory.getLogger("FRONTEND");

    public record FrontendLogAnfrage(
            @Size(max = 64) String kategorie,
            @Size(max = 1000) String nachricht,
            Object daten) {}

    @Operation(summary = "Schreibt eine Frontend-Logmeldung in das Server-Log.")
    @PostMapping("/log")
    public void logge(@Valid @RequestBody FrontendLogAnfrage anfrage) {
        String msg = "[%s] %s".formatted(anfrage.kategorie(), anfrage.nachricht());
        if (anfrage.daten() != null) {
            FRONTEND_LOGGER.info("{} | Daten: {}", msg, anfrage.daten());
        } else {
            FRONTEND_LOGGER.info(msg);
        }
    }
}
