package de.locodoko.tisch;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

/**
 * Strukturierte Fehlerantwort fuer WebSocket-Aktionen.
 *
 * <p>Wird bei fachlichen Fehlern in WebSocket-Handlern (z.B. ungueltige Karte, ungueltige Session)
 * ueber {@code /user/queue/fehler} an den betroffenen Client zurueckgesendet.</p>
 */
@Schema(description = "Strukturierte Fehlerantwort fuer WebSocket-Aktionen.")
public record SpielverwaltungWebSocketFehlerAntwort(
    @Schema(description = "Zeitpunkt des Fehlers.", example = "2026-04-15T14:30:00Z")
    Instant timestamp,
    @Schema(description = "Maschinenlesbarer Fehlercode.", example = "KARTE_UNGUELTIG")
    String fehlerCode,
    @Schema(description = "Menschenlesbare Fehlerbeschreibung.", example = "Die gespielte Karte ist in diesem Stich nicht erlaubt.")
    String nachricht
) {

    public static SpielverwaltungWebSocketFehlerAntwort fachlicherFehler(String fehlerCode, String nachricht) {
        return new SpielverwaltungWebSocketFehlerAntwort(Instant.now(), fehlerCode, nachricht);
    }
}
