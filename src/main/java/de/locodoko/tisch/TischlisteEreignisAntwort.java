package de.locodoko.tisch;

import de.locodoko.tisch.TischListenEintragAntwort;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.List;

/**
 * WebSocket-Ereignis fuer die globale Tischliste auf {@code /topic/tische}.
 *
 * <p>Wird an alle verbundenen Clients gesendet, wenn sich die Tischliste aendert
 * (neuer Tisch, Spieler beigetreten/verlassen, Tischstatus geaendert).</p>
 */
@Schema(description = "WebSocket-Ereignis fuer die globale Tischliste.")
public record TischlisteEreignisAntwort(
    @Schema(description = "Zeitpunkt des Ereignisses.", example = "2026-04-15T14:30:00Z")
    Instant timestamp,
    @Schema(description = "Typ des Tischlisten-Ereignisses.")
    TischlisteEreignisTyp ereignisTyp,
    @Schema(description = "Aktuelle Liste aller Tische.")
    List<TischListenEintragAntwort> tische
) {

    public static TischlisteEreignisAntwort snapshot(List<TischListenEintragAntwort> tische) {
        return new TischlisteEreignisAntwort(Instant.now(), TischlisteEreignisTyp.SNAPSHOT, List.copyOf(tische));
    }

    public static TischlisteEreignisAntwort aktualisiert(List<TischListenEintragAntwort> tische) {
        return new TischlisteEreignisAntwort(Instant.now(), TischlisteEreignisTyp.AKTUALISIERT, List.copyOf(tische));
    }
}
