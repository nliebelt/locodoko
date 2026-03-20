package de.locodoko.spielverwaltung.tisch;

import de.locodoko.spiel.karten.SpielerPosition;
import de.locodoko.spielverwaltung.persistenz.PartieEntity;
import de.locodoko.spielverwaltung.persistenz.PartieStatus;

import java.util.Map;
import java.util.UUID;

public record PartieStandAntwort(
    UUID partieId,
    PartieStatus status,
    int anzahlSpiele,
    int gespielteSpiele,
    Map<SpielerPosition, Integer> gesamtpunktestand
) {

    public static PartieStandAntwort aus(PartieEntity partie) {
        return new PartieStandAntwort(
            partie.id(),
            partie.status(),
            partie.anzahlSpiele(),
            partie.spiele().size(),
            partie.gesamtpunktestand()
        );
    }
}
