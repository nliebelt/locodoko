package de.locodoko.lobby;

import de.locodoko.session.SpielerEntity;

import java.util.UUID;

public record SpielerAmTischAntwort(UUID spielerId, String name, boolean istKi) {

    public static SpielerAmTischAntwort aus(SpielerEntity spieler) {
        return new SpielerAmTischAntwort(spieler.id(), spieler.name(), spieler.istKi());
    }
}
