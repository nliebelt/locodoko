package de.locodoko.spielverwaltung.tisch;

import de.locodoko.spielverwaltung.persistenz.TischEntity;
import de.locodoko.spielverwaltung.persistenz.TischStatus;

import java.util.List;
import java.util.UUID;

public record TischAntwort(
    UUID id,
    String name,
    TischStatus status,
    UUID erstelltVonSpielerId,
    List<SpielerAmTischAntwort> spieler,
    TischKonfigurationDto konfiguration,
    UUID partieId
) {

    public static TischAntwort aus(TischEntity tisch) {
        return new TischAntwort(
            tisch.id(),
            tisch.name(),
            tisch.status(),
            tisch.erstelltVon().id(),
            tisch.spieler().stream().map(SpielerAmTischAntwort::aus).toList(),
            TischKonfigurationDto.aus(tisch.konfiguration()),
            tisch.partie() == null ? null : tisch.partie().id()
        );
    }
}
