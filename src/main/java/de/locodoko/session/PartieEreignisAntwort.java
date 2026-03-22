package de.locodoko.session;

import de.locodoko.lobby.PartieStandAntwort;

import java.time.Instant;

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
