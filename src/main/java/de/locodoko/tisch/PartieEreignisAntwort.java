package de.locodoko.tisch;

import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.lang.Nullable;

import java.time.Instant;
import java.util.List;

@Schema(description = "WebSocket-Ereignis-Wrapper fuer Partie-Updates.")
public record PartieEreignisAntwort(
    @Schema(description = "Zeitpunkt des Ereignisses.")
    Instant timestamp,
    @Schema(description = "Typ des Partie-Ereignisses.")
    PartieEreignisTyp ereignisTyp,
    @Schema(description = "Aktueller Partiestand-Snapshot.")
    PartieStandAntwort partieStand,
    @Schema(description = "KI-Kartenzug-Sequenz (nur bei KI_ZUG_SEQUENZ).")
    @Nullable List<GespielteKarteAntwort> kiKartenSequenz,
    @Schema(description = "Neue Sonderpunkte (nur bei STICH_ABGESCHLOSSEN).")
    @Nullable List<SonderpunktEreignisAntwort> neueSonderpunkte
) {

    public static PartieEreignisAntwort snapshot(PartieStandAntwort partieStand) {
        return new PartieEreignisAntwort(Instant.now(), PartieEreignisTyp.SNAPSHOT, partieStand, null, null);
    }

    public static PartieEreignisAntwort karteGespielt(PartieStandAntwort partieStand) {
        return new PartieEreignisAntwort(Instant.now(), PartieEreignisTyp.KARTE_GESPIELT, partieStand, null, null);
    }

    public static PartieEreignisAntwort kiZugSequenz(PartieStandAntwort partieStand, List<GespielteKarteAntwort> sequenz) {
        return new PartieEreignisAntwort(Instant.now(), PartieEreignisTyp.KI_ZUG_SEQUENZ, partieStand, sequenz, null);
    }

    public static PartieEreignisAntwort stichAbgeschlossen(PartieStandAntwort partieStand, List<SonderpunktEreignisAntwort> sonderpunkte) {
        return new PartieEreignisAntwort(Instant.now(), PartieEreignisTyp.STICH_ABGESCHLOSSEN, partieStand, null, sonderpunkte);
    }

    /** @deprecated Verwende snapshot() oder karteGespielt() stattdessen. */
    @Deprecated
    public static PartieEreignisAntwort aktualisiert(PartieEreignisTyp ereignisTyp, PartieStandAntwort partieStand) {
        return new PartieEreignisAntwort(Instant.now(), ereignisTyp, partieStand, null, null);
    }
}
