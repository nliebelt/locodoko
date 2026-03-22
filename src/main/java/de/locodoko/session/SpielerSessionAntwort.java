package de.locodoko.session;

import de.locodoko.session.SpielerEntity;

import java.util.UUID;

public record SpielerSessionAntwort(UUID spielerId, String name, boolean istKi) {

    public static SpielerSessionAntwort aus(SpielerEntity spieler) {
        return new SpielerSessionAntwort(spieler.id(), spieler.name(), spieler.istKi());
    }
}
