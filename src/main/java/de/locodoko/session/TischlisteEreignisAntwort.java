package de.locodoko.session;

import de.locodoko.tisch.TischListenEintragAntwort;

import java.time.Instant;
import java.util.List;

/**
 * WebSocket-Ereignis fuer die globale Tischliste auf {@code /topic/tische}.
 *
 * <p>Wird an alle verbundenen Clients gesendet, wenn sich die Tischliste aendert
 * (neuer Tisch, Spieler beigetreten/verlassen, Tischstatus geaendert).</p>
 */
public record TischlisteEreignisAntwort(
    Instant timestamp,
    TischlisteEreignisTyp ereignisTyp,
    List<TischListenEintragAntwort> tische
) {

    public static TischlisteEreignisAntwort snapshot(List<TischListenEintragAntwort> tische) {
        return new TischlisteEreignisAntwort(Instant.now(), TischlisteEreignisTyp.SNAPSHOT, List.copyOf(tische));
    }

    public static TischlisteEreignisAntwort aktualisiert(List<TischListenEintragAntwort> tische) {
        return new TischlisteEreignisAntwort(Instant.now(), TischlisteEreignisTyp.AKTUALISIERT, List.copyOf(tische));
    }
}
