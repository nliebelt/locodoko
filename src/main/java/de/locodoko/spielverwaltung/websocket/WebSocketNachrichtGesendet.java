package de.locodoko.spielverwaltung.websocket;

import java.time.Instant;

public record WebSocketNachrichtGesendet(
    Instant timestamp,
    String ziel,
    String benutzer,
    Object payload
) {

    public static WebSocketNachrichtGesendet broadcast(String ziel, Object payload) {
        return new WebSocketNachrichtGesendet(Instant.now(), ziel, null, payload);
    }

    public static WebSocketNachrichtGesendet benutzerbezogen(String benutzer, String ziel, Object payload) {
        return new WebSocketNachrichtGesendet(Instant.now(), ziel, benutzer, payload);
    }
}
