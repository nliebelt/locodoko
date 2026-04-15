package de.locodoko.tisch;

import de.locodoko.tisch.TischEntity;
import de.locodoko.tisch.TischStatus;

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
public record TischAntwort(
    UUID id,
    String name,
    String einladungsCode,
    TischStatus status,
    Zugangsmodus zugangsmodus,
    UUID erstelltVonSpielerId,
    List<SpielerAmTischAntwort> spieler,
    TischKonfigurationDto konfiguration,
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
