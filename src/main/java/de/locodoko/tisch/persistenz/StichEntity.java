package de.locodoko.tisch.persistenz;

import de.locodoko.system.AbstraktePersistenzEntity;
import de.locodoko.partie.SpielerPosition;

import org.springframework.data.annotation.Transient;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.MappedCollection;
import org.springframework.data.relational.core.mapping.Table;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Persistenz-Entity fuer einen abgeschlossenen Stich.
 * Owned by SpielEntity via @MappedCollection.
 * Besitzt GespielteKarteEntity-Eintraege via @MappedCollection (Map nach reihenfolge).
 */
@Table("stich")
public class StichEntity extends AbstraktePersistenzEntity {

    @Column("aufspieler_position")
    private String aufspielerPosition;

    @Column("gewinner_position")
    private String gewinnerPosition;

    @Column("augen")
    private int augen;

    @Column("stich_nummer")
    private int stichNummer;

    /**
     * Gespielte Karten: Owned by diesem Stich.
     * Map-Key = reihenfolge (0-basiert), wird in der reihenfolge-Spalte gespeichert.
     * Das reihenfolge-Feld wird NICHT in GespielteKarteEntity gespeichert (keyColumn uebernimmt das).
     */
    @MappedCollection(idColumn = "stich_id", keyColumn = "reihenfolge")
    private Map<Integer, GespielteKarteEntity> gespielteKartenMap = new LinkedHashMap<>();

    /** Rueckreferenz auf das Spiel (transient, wird in-memory gesetzt). */
    @Transient
    private SpielEntity spiel;

    protected StichEntity() {
    }

    private StichEntity(int stichNummer, SpielerPosition aufspielerPosition, SpielerPosition gewinnerPosition, int augen) {
        this.stichNummer = stichNummer;
        this.aufspielerPosition = Objects.requireNonNull(aufspielerPosition, "aufspielerPosition darf nicht null sein").name();
        this.gewinnerPosition = Objects.requireNonNull(gewinnerPosition, "gewinnerPosition darf nicht null sein").name();
        this.augen = augen;
    }

    public static StichEntity neu(int stichNummer, SpielerPosition aufspielerPosition, SpielerPosition gewinnerPosition, int augen) {
        return new StichEntity(stichNummer, aufspielerPosition, gewinnerPosition, augen);
    }

    void setzeSpiel(SpielEntity spiel) {
        this.spiel = spiel;
    }

    public void fuegeGespielteKarteHinzu(GespielteKarteEntity karte) {
        Objects.requireNonNull(karte, "karte darf nicht null sein");
        // Map-Key = reihenfolge der Karte
        gespielteKartenMap.put(karte.reihenfolge(), karte);
    }

    public SpielEntity spiel() {
        return spiel;
    }

    public int stichNummer() {
        return stichNummer;
    }

    public SpielerPosition aufspielerPosition() {
        return SpielerPosition.valueOf(aufspielerPosition);
    }

    public SpielerPosition gewinnerPosition() {
        return SpielerPosition.valueOf(gewinnerPosition);
    }

    public int augen() {
        return augen;
    }

    public List<GespielteKarteEntity> gespielteKarten() {
        // Sortiert nach reihenfolge (Map-Key), transientes Reihenfolge-Feld aus Map-Key setzen
        return gespielteKartenMap.entrySet().stream()
            .sorted(Map.Entry.comparingByKey())
            .peek(eintrag -> eintrag.getValue().setzeReihenfolge(eintrag.getKey()))
            .map(Map.Entry::getValue)
            .toList();
    }
}
