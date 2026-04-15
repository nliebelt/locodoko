package de.locodoko.tisch;

import de.locodoko.tisch.PartieStandAntwort;
import de.locodoko.tisch.TischAntwort;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.UUID;

/**
 * WebSocket-Ereignis-Wrapper fuer Tisch-Updates auf {@code /topic/tisch/{id}}.
 *
 * <p>Wird bei allen tischrelevanten Aktionen (Beitreten, Verlassen, Konfiguration, Spielstart)
 * gesendet und enthaelt den aktuellen {@link TischAntwort}-Snapshot sowie optional einen
 * {@link PartieStandAntwort} nach dem Spielstart.</p>
 */
@Schema(description = "WebSocket-Ereignis-Wrapper fuer Tisch-Updates.")
public record TischEreignisAntwort(
    @Schema(description = "Zeitpunkt des Ereignisses.", example = "2026-04-15T14:30:00Z")
    Instant timestamp,
    @Schema(description = "Typ des Tisch-Ereignisses.")
    TischEreignisTyp ereignisTyp,
    @Schema(description = "ID des betroffenen Tisches.", example = "f47ac10b-58cc-4372-a567-0e02b2c3d479")
    UUID tischId,
    @Schema(description = "Aktueller Tisch-Snapshot; null bei TISCH_ENTFERNT.")
    TischAntwort tisch,
    @Schema(description = "Aktueller Partiestand; null falls keine Partie laeuft.")
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

    /**
     * Ereignis: Partie wurde abgebrochen, weil ein Spieler den Tisch verlassen hat.
     * Kein Tisch-Snapshot noetig — alle Spieler werden zur Lobby weitergeleitet.
     */
    public static TischEreignisAntwort partieAbgebrochen(UUID tischId) {
        return new TischEreignisAntwort(Instant.now(), TischEreignisTyp.PARTIE_ABGEBROCHEN, tischId, null, null);
    }
}
