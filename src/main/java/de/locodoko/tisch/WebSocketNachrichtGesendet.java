package de.locodoko.tisch;

import java.time.Instant;

/**
 * Ereignis-Record fuer eine gesendete WebSocket-Nachricht.
 *
 * <p>Wird von {@link TischEchtzeitService} nach jedem Broadcast oder benutzerbezogenen
 * Send erzeugt und ueber {@link WebSocketNachrichtenBeobachter} an Tests weitergegeben,
 * damit gesendete Nachrichten in Tests verifiziert werden koennen.</p>
 */
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
