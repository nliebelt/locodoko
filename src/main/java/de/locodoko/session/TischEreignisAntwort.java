package de.locodoko.session;

import de.locodoko.lobby.PartieStandAntwort;
import de.locodoko.lobby.TischAntwort;

import java.time.Instant;
import java.util.UUID;

/**
 * WebSocket-Ereignis-Wrapper fuer Tisch-Updates auf {@code /topic/tisch/{id}}.
 *
 * <p>Wird bei allen tischrelevanten Aktionen (Beitreten, Verlassen, Konfiguration, Spielstart)
 * gesendet und enthaelt den aktuellen {@link TischAntwort}-Snapshot sowie optional einen
 * {@link PartieStandAntwort} nach dem Spielstart.</p>
 */
public record TischEreignisAntwort(
    Instant timestamp,
    TischEreignisTyp ereignisTyp,
    UUID tischId,
    TischAntwort tisch,
    PartieStandAntwort partieStand
) {

    public static TischEreignisAntwort snapshot(TischAntwort tisch, PartieStandAntwort partieStand) {
        return new TischEreignisAntwort(Instant.now(), TischEreignisTyp.TISCH_SNAPSHOT, tisch.id(), tisch, partieStand);
    }

    public static TischEreignisAntwort aktualisiert(TischEreignisTyp ereignisTyp, TischAntwort tisch) {
        return new TischEreignisAntwort(Instant.now(), ereignisTyp, tisch.id(), tisch, null);
    }

    public static TischEreignisAntwort spielGestartet(TischAntwort tisch, PartieStandAntwort partieStand) {
        return new TischEreignisAntwort(Instant.now(), TischEreignisTyp.SPIEL_GESTARTET, tisch.id(), tisch, partieStand);
    }

    public static TischEreignisAntwort tischEntfernt(UUID tischId) {
        return new TischEreignisAntwort(Instant.now(), TischEreignisTyp.TISCH_ENTFERNT, tischId, null, null);
    }
}
