package de.locodoko.partie;

import de.locodoko.karten.SpielerPosition;
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

    @Column("taeter")
    private String taeter;

    @Column("opfer")
    private String opfer;

    /** Rueckreferenz auf das Spiel (transient, wird in-memory gesetzt). */
    @Transient
    private SpielEntity spiel;

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
