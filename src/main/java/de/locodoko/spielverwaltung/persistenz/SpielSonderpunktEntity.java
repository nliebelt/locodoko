package de.locodoko.spielverwaltung.persistenz;

import de.locodoko.spiel.partie.Partei;
import de.locodoko.spiel.partie.Sonderpunkt;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.util.Objects;

@Entity
@Table(name = "spiel_sonderpunkt")
public class SpielSonderpunktEntity extends AbstraktePersistenzEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "spiel_id", nullable = false)
    private SpielEntity spiel;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Partei partei;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Sonderpunkt sonderpunkt;

    protected SpielSonderpunktEntity() {
    }

    private SpielSonderpunktEntity(Partei partei, Sonderpunkt sonderpunkt) {
        this.partei = Objects.requireNonNull(partei, "partei darf nicht null sein");
        this.sonderpunkt = Objects.requireNonNull(sonderpunkt, "sonderpunkt darf nicht null sein");
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
        return partei;
    }

    public Sonderpunkt sonderpunkt() {
        return sonderpunkt;
    }
}
