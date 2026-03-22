package de.locodoko.partie;

import de.locodoko.karten.Farbe;
import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartenwert;
import de.locodoko.karten.SpielerPosition;
import org.springframework.data.annotation.Transient;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.util.Objects;

/**
 * Persistenz-Entity fuer eine gespielte Karte innerhalb eines Stichs.
 * Owned by StichEntity via @MappedCollection (Map mit reihenfolge als Key).
 * Das Feld 'reihenfolge' ist @Transient, da es vom @MappedCollection keyColumn verwaltet wird.
 * Es wird nach dem Laden manuell gesetzt (durch den Map-Key aus StichEntity).
 */
@Table("gespielte_karte")
public class GespielteKarteEntity extends AbstraktePersistenzEntity {

    @Column("spieler_position")
    private String spielerPosition;

    @Column("farbe")
    private String farbe;

    @Column("wert")
    private String wert;

    @Column("exemplar_index")
    private int exemplarIndex;

    /**
     * Reihenfolge der Karte im Stich (0-basiert).
     * Transient — wird vom @MappedCollection keyColumn in StichEntity verwaltet.
     * Wird nach dem Laden aus dem Map-Key gesetzt.
     */
    @Transient
    private int reihenfolge;

    protected GespielteKarteEntity() {
    }

    private GespielteKarteEntity(SpielerPosition spielerPosition, Karte karte, int reihenfolge) {
        this.spielerPosition = Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein").name();
        Objects.requireNonNull(karte, "karte darf nicht null sein");
        this.farbe = karte.farbe().name();
        this.wert = karte.wert().name();
        this.exemplarIndex = karte.exemplarIndex();
        this.reihenfolge = reihenfolge;
    }

    public static GespielteKarteEntity neu(SpielerPosition spielerPosition, Karte karte, int reihenfolge) {
        return new GespielteKarteEntity(spielerPosition, karte, reihenfolge);
    }

    /** Setzt die Reihenfolge (wird nach dem Laden aus dem Map-Key des uebergeordneten Stichs gesetzt). */
    void setzeReihenfolge(int reihenfolge) {
        this.reihenfolge = reihenfolge;
    }

    public SpielerPosition spielerPosition() {
        return SpielerPosition.valueOf(spielerPosition);
    }

    public Farbe farbe() {
        return Farbe.valueOf(farbe);
    }

    public Kartenwert wert() {
        return Kartenwert.valueOf(wert);
    }

    public int exemplarIndex() {
        return exemplarIndex;
    }

    public int reihenfolge() {
        return reihenfolge;
    }
}
