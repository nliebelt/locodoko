package de.locodoko.session;

import java.time.Instant;

/**
 * Antwort-DTO für Verbindungsstatus-Änderungen eines Spielers am Tisch.
 * Wird über {@code /topic/tisch/{id}} an alle Spieler am Tisch gesendet.
 *
 * <p>Mögliche Status-Übergänge:
 * <ul>
 *   <li>{@link VerbindungsstatusTyp#VERBUNDEN} — Spieler hat sich verbunden oder reconnected</li>
 *   <li>{@link VerbindungsstatusTyp#GETRENNT} — Spieler hat Verbindung verloren, Timeout läuft</li>
 *   <li>{@link VerbindungsstatusTyp#KI_UEBERNOMMEN} — KI steuert nach Timeout-Ablauf</li>
 * </ul>
 */
public record VerbindungStatusEreignisAntwort(
        Instant timestamp,
        String spielerName,
        VerbindungsstatusTyp status,
        /** Nur bei {@link VerbindungsstatusTyp#GETRENNT} gesetzt, sonst 0. */
        int reconnectTimeoutSekunden
) {

    /**
     * Erzeugt ein "Getrennt"-Ereignis mit aktivem Reconnect-Timeout.
     */
    public static VerbindungStatusEreignisAntwort getrennt(String spielerName, int timeoutSekunden) {
        return new VerbindungStatusEreignisAntwort(Instant.now(), spielerName, VerbindungsstatusTyp.GETRENNT, timeoutSekunden);
    }

    /**
     * Erzeugt ein "Verbunden"-Ereignis (Erstverbindung oder Reconnect).
     */
    public static VerbindungStatusEreignisAntwort verbunden(String spielerName) {
        return new VerbindungStatusEreignisAntwort(Instant.now(), spielerName, VerbindungsstatusTyp.VERBUNDEN, 0);
    }

    /**
     * Erzeugt ein "KI-Übernahme"-Ereignis nach abgelaufenem Reconnect-Timeout.
     */
    public static VerbindungStatusEreignisAntwort kiUebernommen(String spielerName) {
        return new VerbindungStatusEreignisAntwort(Instant.now(), spielerName, VerbindungsstatusTyp.KI_UEBERNOMMEN, 0);
    }
}
