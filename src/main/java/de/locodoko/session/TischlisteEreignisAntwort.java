package de.locodoko.session;

import de.locodoko.lobby.TischListenEintragAntwort;

import java.time.Instant;
import java.util.List;

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
