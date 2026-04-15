package de.locodoko.tisch;

import io.swagger.v3.oas.annotations.media.Schema;

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
@Schema(description = "Verbindungsstatus-Aenderung eines Spielers am Tisch.")
public record VerbindungStatusEreignisAntwort(
        @Schema(description = "Zeitpunkt der Statusaenderung.", example = "2026-04-15T14:30:00Z")
        Instant timestamp,
        @Schema(description = "Name des betroffenen Spielers.", example = "Karlchen")
        String spielerName,
        @Schema(description = "Neuer Verbindungsstatus.")
        VerbindungsstatusTyp status,
        /** Nur bei {@link VerbindungsstatusTyp#GETRENNT} gesetzt, sonst 0. */
        @Schema(description = "Reconnect-Timeout in Sekunden; nur bei GETRENNT gesetzt, sonst 0.", example = "30")
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
