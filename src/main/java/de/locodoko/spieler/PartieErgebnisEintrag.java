package de.locodoko.spieler;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * Projection der {@code partie_ergebnis_view} — read-only, nicht persistent.
 * Die VIEW berechnet Rangplatz und Endpunktestand live aus {@code partie}
 * und {@code partie_teilnehmer}; keine Schreiboperationen noetig.
 */
@Table("partie_ergebnis_view")
public class PartieErgebnisEintrag {

    @Id
    @Column("partie_id")
    private UUID partieId;

    @Column("spieler_id")
    private UUID spielerId;

    @Column("tisch_name")
    private String tischName;

    @Column("datum")
    private Instant datum;

    @Column("regelvariante")
    private String regelvariante;

    @Column("end_punktestand")
    private int endPunktestand;

    @Column("rangplatz")
    private int rangplatz;

    @Column("spielanzahl")
    private int spielanzahl;

    protected PartieErgebnisEintrag() {
    }

    public UUID partieId() { return partieId; }
    public UUID spielerId() { return spielerId; }
    public String tischName() { return tischName; }
    public Instant datum() { return datum; }
    public String regelvariante() { return regelvariante; }
    public int endPunktestand() { return endPunktestand; }
    public int rangplatz() { return rangplatz; }
    public int spielanzahl() { return spielanzahl; }
}
