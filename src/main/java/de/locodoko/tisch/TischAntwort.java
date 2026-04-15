package de.locodoko.tisch;

import de.locodoko.tisch.TischEntity;
import de.locodoko.tisch.TischStatus;
import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;
import java.util.UUID;

/**
 * Vollstaendige REST-Antwort fuer einen einzelnen Tisch.
 *
 * <p>Wird bei {@code GET /api/tische/{id}} und nach spielrelevanten Aktionen
 * (Beitreten, Verlassen, Konfiguration aendern) zurueckgegeben. Enthaelt ID, Name,
 * Status, Ersteller, alle Spieler am Tisch, vollstaendige Konfiguration und — falls
 * eine Partie laeuft — deren ID.</p>
 */
@Schema(description = "Vollstaendige REST-Antwort fuer einen einzelnen Tisch.")
public record TischAntwort(
    @Schema(description = "Eindeutige Tisch-ID.", example = "f47ac10b-58cc-4372-a567-0e02b2c3d479")
    UUID id,
    @Schema(description = "Name des Tisches.", example = "Gemuetliche Runde")
    String name,
    @Schema(description = "Einladungscode fuer den Tisch.", example = "ABC123")
    String einladungsCode,
    @Schema(description = "Aktueller Status des Tisches.")
    TischStatus status,
    @Schema(description = "Zugangsmodus des Tisches.")
    Zugangsmodus zugangsmodus,
    @Schema(description = "ID des Spielers, der den Tisch erstellt hat.", example = "a1b2c3d4-e5f6-7890-abcd-ef1234567890")
    UUID erstelltVonSpielerId,
    @Schema(description = "Liste der Spieler am Tisch.")
    List<SpielerAmTischAntwort> spieler,
    @Schema(description = "Vollstaendige Tischkonfiguration.")
    TischKonfigurationDto konfiguration,
    @Schema(description = "ID der laufenden Partie; null falls keine.", example = "c3d4e5f6-7890-abcd-ef12-34567890abcd")
    UUID partieId
) {

    public static TischAntwort aus(TischEntity tisch) {
        return new TischAntwort(
            tisch.id(),
            tisch.name(),
            tisch.einladungsCode(),
            tisch.status(),
            tisch.zugangsmodus(),
            tisch.erstelltVon().id(),
            tisch.spieler().stream().map(SpielerAmTischAntwort::aus).toList(),
            TischKonfigurationDto.aus(tisch.konfiguration()),
            tisch.partie() == null ? null : tisch.partie().id()
        );
    }
}
