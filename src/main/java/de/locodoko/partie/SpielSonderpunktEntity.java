package de.locodoko.partie;

import de.locodoko.partie.Partei;
import de.locodoko.partie.Sonderpunkt;
import org.springframework.data.annotation.Transient;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.util.Objects;

/**
 * Persistenz-Entity fuer einen Sonderpunkt in einem Spiel.
 * Owned by SpielEntity via @MappedCollection.
 */
@Table("spiel_sonderpunkt")
public class SpielSonderpunktEntity extends AbstraktePersistenzEntity {

    @Column("partei")
    private String partei;

    @Column("sonderpunkt")
    private String sonderpunkt;

    /** Rueckreferenz auf das Spiel (transient, wird in-memory gesetzt). */
    @Transient
    private SpielEntity spiel;

    protected SpielSonderpunktEntity() {
    }

    private SpielSonderpunktEntity(Partei partei, Sonderpunkt sonderpunkt) {
        this.partei = Objects.requireNonNull(partei, "partei darf nicht null sein").name();
        this.sonderpunkt = Objects.requireNonNull(sonderpunkt, "sonderpunkt darf nicht null sein").name();
    }

    public static SpielSonderpunktEntity neu(Partei partei, Sonderpunkt sonderpunkt) {
        return new SpielSonderpunktEntity(partei, sonderpunkt);
    }

    void setzeSpiel(SpielEntity spiel) {
        this.spiel = spiel;
    }

    public SpielEntity spiel() {
        return spiel;
    }

    public Partei partei() {
        return Partei.valueOf(partei);
    }

    public Sonderpunkt sonderpunkt() {
        return Sonderpunkt.valueOf(sonderpunkt);
    }
}
