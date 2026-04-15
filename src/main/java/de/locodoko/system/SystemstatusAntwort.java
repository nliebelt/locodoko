package de.locodoko.system;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Systemstatus der Anwendung.")
public record SystemstatusAntwort(
    @Schema(description = "Name der Anwendung.", example = "locodoko")
    String anwendung,
    @Schema(description = "Aktueller Betriebsstatus.", example = "UP")
    String status,
    @Schema(description = "Aktives Spring-Profil.", example = "prod")
    String aktivesProfil
) {
}
