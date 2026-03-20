package de.locodoko.spielverwaltung.persistenz;

import de.locodoko.spiel.karten.Farbe;
import de.locodoko.spiel.karten.Karte;
import de.locodoko.spiel.karten.Kartenwert;
import de.locodoko.spiel.karten.SpielerPosition;
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
@Table(name = "gespielte_karte")
public class GespielteKarteEntity extends AbstraktePersistenzEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "stich_id", nullable = false)
    private StichEntity stich;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SpielerPosition spielerPosition;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Farbe farbe;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Kartenwert wert;

    @Column(nullable = false)
    private int exemplarIndex;

    @Column(nullable = false)
    private int reihenfolge;

    protected GespielteKarteEntity() {
    }

    private GespielteKarteEntity(SpielerPosition spielerPosition, Karte karte, int reihenfolge) {
        this.spielerPosition = Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        Objects.requireNonNull(karte, "karte darf nicht null sein");
        this.farbe = karte.farbe();
        this.wert = karte.wert();
        this.exemplarIndex = karte.exemplarIndex();
        this.reihenfolge = reihenfolge;
    }

    public static GespielteKarteEntity neu(SpielerPosition spielerPosition, Karte karte, int reihenfolge) {
        return new GespielteKarteEntity(spielerPosition, karte, reihenfolge);
    }

    void setzeStich(StichEntity stich) {
        this.stich = stich;
    }

    public StichEntity stich() {
        return stich;
    }

    public SpielerPosition spielerPosition() {
        return spielerPosition;
    }

    public Farbe farbe() {
        return farbe;
    }

    public Kartenwert wert() {
        return wert;
    }

    public int exemplarIndex() {
        return exemplarIndex;
    }

    public int reihenfolge() {
        return reihenfolge;
    }
}
