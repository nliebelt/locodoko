package de.locodoko.tisch;

import de.locodoko.partie.SpielerPosition;
import io.swagger.v3.oas.annotations.media.Schema;

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
        PartieEreignisAntwort.StichAbgeschlossen.class,
        PartieEreignisAntwort.SpielBeendet.class,
        PartieEreignisAntwort.AnsageErfolgt.class,
        PartieEreignisAntwort.SchweinchenGemeldet.class,
        PartieEreignisAntwort.HochzeitPartnerGefunden.class,
        PartieEreignisAntwort.SpielGestartet.class,
        PartieEreignisAntwort.AktionAbgelehnt.class
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

    @Schema(description = "Ein Spieler (Mensch oder KI) hat eine Karte gespielt.")
    record KarteGespielt(
        Instant timestamp,
        long version,
        PartieEreignisTyp ereignisTyp,
        PartieStandAntwort partieStand,
        @Schema(description = "Position des spielenden Spielers.")
        SpielerPosition spielerPosition,
        @Schema(description = "ID der gespielten Karte im Format FARBE-WERT-INDEX.", example = "KREUZ-AS-1")
        String karteId
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

    @Schema(description = "Der Hochzeit-Partner wurde gefunden.")
    record HochzeitPartnerGefunden(
        Instant timestamp,
        long version,
        PartieEreignisTyp ereignisTyp,
        PartieStandAntwort partieStand,
        @Schema(description = "Position des gefundenen Partners.")
        SpielerPosition partnerPosition
    ) implements PartieEreignisAntwort {}

    @Schema(description = "Eine neue Partie an diesem Tisch wurde gestartet.")
    record SpielGestartet(Instant timestamp, long version, PartieEreignisTyp ereignisTyp, PartieStandAntwort partieStand) implements PartieEreignisAntwort {}

    @Schema(description = "Eine Spieleraktion wurde abgelehnt (z.B. ungueltiger Kartenzug).")
    record AktionAbgelehnt(
        Instant timestamp,
        long version,
        PartieEreignisTyp ereignisTyp,
        PartieStandAntwort partieStand,
        @Schema(description = "Fehlercode der abgelehnten Aktion.", example = "KARTE_UNGUELTIG")
        String fehlerCode
    ) implements PartieEreignisAntwort {}

    // --- Statische Factory-Methoden ---

    static PartieEreignisAntwort snapshot(PartieStandAntwort stand) {
        return new Snapshot(Instant.now(), stand.version(), PartieEreignisTyp.SNAPSHOT, stand);
    }

    static PartieEreignisAntwort karteGespielt(PartieStandAntwort stand, SpielerPosition spielerPosition, String karteId) {
        return new KarteGespielt(Instant.now(), stand.version(), PartieEreignisTyp.KARTE_GESPIELT, stand, spielerPosition, karteId);
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

    static PartieEreignisAntwort hochzeitPartnerGefunden(PartieStandAntwort stand, SpielerPosition partnerPosition) {
        return new HochzeitPartnerGefunden(Instant.now(), stand.version(), PartieEreignisTyp.HOCHZEIT_PARTNER_GEFUNDEN, stand, partnerPosition);
    }

    static PartieEreignisAntwort spielGestartet(PartieStandAntwort stand) {
        return new SpielGestartet(Instant.now(), stand.version(), PartieEreignisTyp.SPIEL_GESTARTET, stand);
    }

    static PartieEreignisAntwort aktionAbgelehnt(PartieStandAntwort stand, String fehlerCode) {
        return new AktionAbgelehnt(Instant.now(), stand.version(), PartieEreignisTyp.AKTION_ABGELEHNT, stand, fehlerCode);
    }
}
