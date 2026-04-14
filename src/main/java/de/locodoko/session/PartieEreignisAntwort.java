package de.locodoko.session;

import de.locodoko.tisch.PartieStandAntwort;

import java.time.Instant;

/**
 * WebSocket-Ereignis-Wrapper fuer Partie-Updates.
 *
 * <p>Wird nach jeder Spielaktion an {@code /topic/partie/{id}} gesendet und enthaelt
 * den aktuellen {@link PartieStandAntwort}-Snapshot. Der {@code ereignisTyp} unterscheidet
 * zwischen einem vollstaendigen Snapshot (auf Anfrage) und einer Aktualisierung (nach Aktion).</p>
 */
public record PartieEreignisAntwort(
    Instant timestamp,
    PartieEreignisTyp ereignisTyp,
    PartieStandAntwort partieStand
) {

    public static PartieEreignisAntwort snapshot(PartieStandAntwort partieStand) {
        return new PartieEreignisAntwort(Instant.now(), PartieEreignisTyp.PARTIE_SNAPSHOT, partieStand);
    }

    public static PartieEreignisAntwort aktualisiert(PartieEreignisTyp ereignisTyp, PartieStandAntwort partieStand) {
        return new PartieEreignisAntwort(Instant.now(), ereignisTyp, partieStand);
    }
}
