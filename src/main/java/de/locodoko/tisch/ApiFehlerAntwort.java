package de.locodoko.tisch;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Strukturierte Fehlerantwort fuer REST-Endpunkte.
 *
 * <p>Wird von {@link SpielverwaltungExceptionHandler} fuer alle fachlichen Fehler
 * (ungueltige Session, Konflikt, nicht gefunden) erzeugt. Der {@code fehlerCode}
 * ist maschinenlesbar (z.B. {@code SESSION_UNGUELTIG}), die {@code nachricht}
 * ist menschenlesbar.</p>
 *
 * @param fehlerCode  maschinenlesbarer Fehlercode
 * @param nachricht   menschenlesbare Beschreibung des Fehlers
 */
@Schema(description = "Strukturierte Fehlerantwort fuer REST-Endpunkte.")
public record ApiFehlerAntwort(
    @Schema(description = "Maschinenlesbarer Fehlercode.", example = "SESSION_UNGUELTIG")
    String fehlerCode,
    @Schema(description = "Menschenlesbare Fehlerbeschreibung.", example = "Die Spieler-Session ist ungueltig oder abgelaufen.")
    String nachricht
) {
}
