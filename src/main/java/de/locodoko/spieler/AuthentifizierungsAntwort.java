package de.locodoko.spieler;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.UUID;

/** Antwort nach erfolgreicher Authentifizierung (Login oder Registrierung). */
@Schema(description = "Antwort nach erfolgreicher Authentifizierung.")
public record AuthentifizierungsAntwort(
    @Schema(description = "Eindeutige Spieler-ID.", example = "a1b2c3d4-e5f6-7890-abcd-ef1234567890")
    UUID spielerId,
    @Schema(description = "Anzeigename des Spielers.", example = "Karlchen")
    String name,
    @Schema(description = "Verwendete Authentifizierungsmethode.", example = "GAST")
    String authentifizierungsMethode
) {
    public static AuthentifizierungsAntwort aus(SpielerEntity spieler) {
        return new AuthentifizierungsAntwort(
            spieler.id(),
            spieler.name(),
            spieler.authentifizierungsMethode() != null
                ? spieler.authentifizierungsMethode().name()
                : null
        );
    }
}
