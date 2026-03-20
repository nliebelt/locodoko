package de.locodoko.spielverwaltung.websocket;

import java.time.Instant;

public record SpielverwaltungWebSocketFehlerAntwort(
    Instant timestamp,
    String fehlerCode,
    String nachricht
) {

    public static SpielverwaltungWebSocketFehlerAntwort fachlicherFehler(String fehlerCode, String nachricht) {
        return new SpielverwaltungWebSocketFehlerAntwort(Instant.now(), fehlerCode, nachricht);
    }
}
