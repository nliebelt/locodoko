package de.locodoko.partie;

import de.locodoko.system.AbstraktePersistenzEntity;

import org.springframework.data.annotation.Transient;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.util.Objects;

/**
 * Persistenz-Entity fuer einen Sonderpunkt in einem Spiel.
 * Owned by Spiel via @MappedCollection.
 */
@Table("spiel_sonderpunkt")
public class SpielSonderpunktEntity extends AbstraktePersistenzEntity {

    @Column("partei")
    private String partei;

    @Column("sonderpunkt")
    private String sonderpunkt;

    @Column("taeter")
    private String taeter;

    @Column("opfer")
    private String opfer;

    /** Rueckreferenz auf das Spiel (transient, wird in-memory gesetzt). */
    @Transient
    private Spiel spiel;

    protected SpielSonderpunktEntity() {
    }

    private SpielSonderpunktEntity(Partei partei, SonderpunktEreignis ereignis) {
        this.partei = Objects.requireNonNull(partei, "partei darf nicht null sein").name();
        this.sonderpunkt = Objects.requireNonNull(ereignis.art(), "art darf nicht null sein").name();
        this.taeter = Objects.requireNonNull(ereignis.taeter(), "taeter darf nicht null sein").name();
        this.opfer = ereignis.opfer() != null ? ereignis.opfer().name() : null;
    }

    public static SpielSonderpunktEntity neu(Partei partei, SonderpunktEreignis ereignis) {
        return new SpielSonderpunktEntity(partei, ereignis);
    }

    public void setzeSpiel(Spiel spiel) {
        this.spiel = spiel;
    }

    public Spiel spiel() {
        return spiel;
    }

    public Partei partei() {
        return Partei.valueOf(partei);
    }

    public Sonderpunkt sonderpunkt() {
        return Sonderpunkt.valueOf(sonderpunkt);
    }

    public SpielerPosition taeter() {
        return taeter != null ? SpielerPosition.valueOf(taeter) : null;
    }

    public SpielerPosition opfer() {
        return opfer != null ? SpielerPosition.valueOf(opfer) : null;
    }

    public SonderpunktEreignis alsEreignis() {
        return new SonderpunktEreignis(sonderpunkt(), taeter(), opfer());
    }
}
