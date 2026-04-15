package de.locodoko.spieler;

import de.locodoko.system.AbstraktePersistenzEntity;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * Partie-Ergebnis-Eintrag (N:1 mit Spieler, max. 20 pro Spieler).
 * Wird bei Partie-Ende erzeugt und rotiert — aeltester Eintrag wird geloescht
 * wenn die maximale Anzahl ueberschritten ist.
 */
@Table("partie_ergebnis")
public class PartieErgebnisEintrag extends AbstraktePersistenzEntity {

    static final int MAXIMALE_EINTRAEGE = 20;

    @Column("spieler_id")
    private UUID spielerId;

    @Column("tisch_name")
    private String tischName;

    @Column("datum")
    private Instant datum;

    @Column("end_punktestand")
    private int endPunktestand;

    @Column("rangplatz")
    private int rangplatz;

    @Column("spielanzahl")
    private int spielanzahl;

    protected PartieErgebnisEintrag() {
    }

    public static PartieErgebnisEintrag erstelle(UUID spielerId, String tischName,
                                                  int endPunktestand, int rangplatz, int spielanzahl) {
        PartieErgebnisEintrag eintrag = new PartieErgebnisEintrag();
        eintrag.spielerId = spielerId;
        eintrag.tischName = tischName;
        eintrag.datum = Instant.now();
        eintrag.endPunktestand = endPunktestand;
        eintrag.rangplatz = rangplatz;
        eintrag.spielanzahl = spielanzahl;
        return eintrag;
    }

    public UUID spielerId() { return spielerId; }
    public String tischName() { return tischName; }
    public Instant datum() { return datum; }
    public int endPunktestand() { return endPunktestand; }
    public int rangplatz() { return rangplatz; }
    public int spielanzahl() { return spielanzahl; }
}
