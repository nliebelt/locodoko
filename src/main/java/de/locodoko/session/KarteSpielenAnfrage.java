package de.locodoko.session;

/**
 * WebSocket-Anfrage zum Ausspielen einer Karte ({@code /app/tisch/{id}/karte}).
 *
 * @param karteId  serialisierte Karten-ID im Format "FARBE_WERT_INDEX" (z.B. "KREUZ_DAME_1")
 */
public record KarteSpielenAnfrage(String karteId) {
}
