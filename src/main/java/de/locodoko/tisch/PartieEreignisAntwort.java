package de.locodoko.tisch;

import de.locodoko.tisch.PartieStandAntwort;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

/**
 * WebSocket-Ereignis-Wrapper fuer Partie-Updates.
 *
 * <p>Wird nach jeder Spielaktion an {@code /topic/partie/{id}} gesendet und enthaelt
 * den aktuellen {@link PartieStandAntwort}-Snapshot. Der {@code ereignisTyp} unterscheidet
 * zwischen einem vollstaendigen Snapshot (auf Anfrage) und einer Aktualisierung (nach Aktion).</p>
 */
@Schema(description = "WebSocket-Ereignis-Wrapper fuer Partie-Updates.")
public record PartieEreignisAntwort(
    @Schema(description = "Zeitpunkt des Ereignisses.", example = "2026-04-15T14:30:00Z")
    Instant timestamp,
    @Schema(description = "Typ des Partie-Ereignisses.")
    PartieEreignisTyp ereignisTyp,
    @Schema(description = "Aktueller Partiestand-Snapshot.")
    PartieStandAntwort partieStand
) {

    public static PartieEreignisAntwort snapshot(PartieStandAntwort partieStand) {
        return new PartieEreignisAntwort(Instant.now(), PartieEreignisTyp.PARTIE_SNAPSHOT, partieStand);
    }

    public static PartieEreignisAntwort aktualisiert(PartieEreignisTyp ereignisTyp, PartieStandAntwort partieStand) {
        return new PartieEreignisAntwort(Instant.now(), ereignisTyp, partieStand);
    }
}
