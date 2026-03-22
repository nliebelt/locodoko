package de.locodoko.session;

import java.time.Instant;

/**
 * Strukturierte Fehlerantwort fuer WebSocket-Aktionen.
 *
 * <p>Wird bei fachlichen Fehlern in WebSocket-Handlern (z.B. ungueltige Karte, ungueltige Session)
 * ueber {@code /user/queue/fehler} an den betroffenen Client zurueckgesendet.</p>
 */
public record SpielverwaltungWebSocketFehlerAntwort(
    Instant timestamp,
    String fehlerCode,
    String nachricht
) {

    public static SpielverwaltungWebSocketFehlerAntwort fachlicherFehler(String fehlerCode, String nachricht) {
        return new SpielverwaltungWebSocketFehlerAntwort(Instant.now(), fehlerCode, nachricht);
    }
}
