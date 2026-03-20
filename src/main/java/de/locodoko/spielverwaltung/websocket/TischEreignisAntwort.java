package de.locodoko.spielverwaltung.websocket;

import de.locodoko.spielverwaltung.tisch.PartieStandAntwort;
import de.locodoko.spielverwaltung.tisch.TischAntwort;

import java.time.Instant;
import java.util.UUID;

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
