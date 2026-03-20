package de.locodoko.spielverwaltung.websocket;

public interface WebSocketNachrichtenBeobachter {

    void nachrichtGesendet(WebSocketNachrichtGesendet nachricht);
}
