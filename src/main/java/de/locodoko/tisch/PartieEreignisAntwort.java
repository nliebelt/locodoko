package de.locodoko.tisch;

import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.lang.Nullable;

import java.time.Instant;
import java.util.List;

/**
 * Basis-Interface fuer alle Partie-Ereignisse.
 * Ermoeglicht typsichere Discriminated Unions in der OpenAPI-Spec.
 */
@Schema(
    description = "Ein Ereignis innerhalb einer laufenden Partie.",
    oneOf = {
        PartieEreignisAntwort.Snapshot.class,
        PartieEreignisAntwort.KarteGespielt.class,
        PartieEreignisAntwort.KiZugSequenz.class,
        PartieEreignisAntwort.StichAbgeschlossen.class,
        PartieEreignisAntwort.SpielBeendet.class,
        PartieEreignisAntwort.AnsageErfolgt.class,
        PartieEreignisAntwort.SchweinchenGemeldet.class,
        PartieEreignisAntwort.SpielGestartet.class
    }
)
public sealed interface PartieEreignisAntwort {

    @Schema(description = "Zeitpunkt des Ereignisses.")
    Instant timestamp();

    @Schema(description = "Aktuelle Sequenznummer/Version der Partie.", example = "42")
    long version();

    @Schema(description = "Typ des Partie-Ereignisses zur Unterscheidung im Frontend.")
    PartieEreignisTyp ereignisTyp();

    @Schema(description = "Aktueller Partiestand-Snapshot (Snapshot-in-Event fuer Robustheit).")
    PartieStandAntwort partieStand();

    // --- Implementierungen (ereignisTyp muss Komponente sein fuer Jackson-Serialisierung) ---

    @Schema(description = "Expliziter Snapshot des gesamten Spielstands.")
    record Snapshot(Instant timestamp, long version, PartieEreignisTyp ereignisTyp, PartieStandAntwort partieStand) implements PartieEreignisAntwort {}

    @Schema(description = "Ein Spieler (Mensch oder KI-Einzelkarte) hat eine Karte gespielt.")
    record KarteGespielt(Instant timestamp, long version, PartieEreignisTyp ereignisTyp, PartieStandAntwort partieStand) implements PartieEreignisAntwort {}

    @Schema(description = "Eine Sequenz von KI-Karten wurde gespielt.")
    record KiZugSequenz(
        Instant timestamp,
        long version,
        PartieEreignisTyp ereignisTyp,
        PartieStandAntwort partieStand,
        @Schema(description = "Die Liste der gespielten Karten in zeitlicher Reihenfolge.")
        List<GespielteKarteAntwort> kiKartenSequenz
    ) implements PartieEreignisAntwort {}

    @Schema(description = "Ein Stich wurde beendet und eingezogen.")
    record StichAbgeschlossen(
        Instant timestamp,
        long version,
        PartieEreignisTyp ereignisTyp,
        PartieStandAntwort partieStand,
        @Schema(description = "Neue Sonderpunkte, die in diesem Stich erzielt wurden.")
        List<SonderpunktEreignisAntwort> neueSonderpunkte
    ) implements PartieEreignisAntwort {}

    @Schema(description = "Ein Einzelspiel wurde beendet (Auswertung abgeschlossen).")
    record SpielBeendet(Instant timestamp, long version, PartieEreignisTyp ereignisTyp, PartieStandAntwort partieStand) implements PartieEreignisAntwort {}

    @Schema(description = "Ein Spieler hat eine Ansage (Re, Kontra, etc.) getaetigt.")
    record AnsageErfolgt(Instant timestamp, long version, PartieEreignisTyp ereignisTyp, PartieStandAntwort partieStand) implements PartieEreignisAntwort {}

    @Schema(description = "Ein Spieler hat Schweinchen gemeldet.")
    record SchweinchenGemeldet(Instant timestamp, long version, PartieEreignisTyp ereignisTyp, PartieStandAntwort partieStand) implements PartieEreignisAntwort {}

    @Schema(description = "Eine neue Partie an diesem Tisch wurde gestartet.")
    record SpielGestartet(Instant timestamp, long version, PartieEreignisTyp ereignisTyp, PartieStandAntwort partieStand) implements PartieEreignisAntwort {}

    // --- Statische Factory-Methoden ---

    static PartieEreignisAntwort snapshot(PartieStandAntwort stand) {
        return new Snapshot(Instant.now(), stand.version(), PartieEreignisTyp.SNAPSHOT, stand);
    }

    static PartieEreignisAntwort karteGespielt(PartieStandAntwort stand) {
        return new KarteGespielt(Instant.now(), stand.version(), PartieEreignisTyp.KARTE_GESPIELT, stand);
    }

    static PartieEreignisAntwort kiZugSequenz(PartieStandAntwort stand, List<GespielteKarteAntwort> sequenz) {
        return new KiZugSequenz(Instant.now(), stand.version(), PartieEreignisTyp.KI_ZUG_SEQUENZ, stand, sequenz);
    }

    static PartieEreignisAntwort stichAbgeschlossen(PartieStandAntwort stand, List<SonderpunktEreignisAntwort> sonderpunkte) {
        return new StichAbgeschlossen(Instant.now(), stand.version(), PartieEreignisTyp.STICH_ABGESCHLOSSEN, stand, sonderpunkte);
    }

    static PartieEreignisAntwort spielBeendet(PartieStandAntwort stand) {
        return new SpielBeendet(Instant.now(), stand.version(), PartieEreignisTyp.SPIEL_BEENDET, stand);
    }

    static PartieEreignisAntwort ansageErfolgt(PartieStandAntwort stand) {
        return new AnsageErfolgt(Instant.now(), stand.version(), PartieEreignisTyp.ANSAGE_ERFOLGT, stand);
    }

    static PartieEreignisAntwort schweinchenGemeldet(PartieStandAntwort stand) {
        return new SchweinchenGemeldet(Instant.now(), stand.version(), PartieEreignisTyp.SCHWEINCHEN_GEMELDET, stand);
    }

    static PartieEreignisAntwort spielGestartet(PartieStandAntwort stand) {
        return new SpielGestartet(Instant.now(), stand.version(), PartieEreignisTyp.SPIEL_GESTARTET, stand);
    }
}
