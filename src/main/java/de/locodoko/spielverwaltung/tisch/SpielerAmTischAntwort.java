package de.locodoko.spielverwaltung.tisch;

import de.locodoko.spielverwaltung.persistenz.SpielerEntity;

import java.util.UUID;

public record SpielerAmTischAntwort(UUID spielerId, String name, boolean istKi) {

    public static SpielerAmTischAntwort aus(SpielerEntity spieler) {
        return new SpielerAmTischAntwort(spieler.id(), spieler.name(), spieler.istKi());
    }
}
