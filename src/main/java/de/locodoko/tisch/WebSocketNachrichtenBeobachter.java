package de.locodoko.tisch;

/**
 * Observer-Schnittstelle fuer gesendete WebSocket-Nachrichten.
 *
 * <p>Ermoeglicht Tests, alle vom {@link TischEchtzeitService} gesendeten Nachrichten
 * mitzuhören ohne echte WebSocket-Verbindungen aufzubauen. In der produktiven Konfiguration
 * ist kein Beobachter registriert.</p>
 */
public interface WebSocketNachrichtenBeobachter {

    void nachrichtGesendet(WebSocketNachrichtGesendet nachricht);
}
