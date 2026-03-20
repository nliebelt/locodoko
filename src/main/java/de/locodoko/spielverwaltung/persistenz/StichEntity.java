package de.locodoko.spielverwaltung.persistenz;

import de.locodoko.spiel.karten.SpielerPosition;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Entity
@Table(name = "stich")
public class StichEntity extends AbstraktePersistenzEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "spiel_id", nullable = false)
    private SpielEntity spiel;

    @Min(1)
    @Column(nullable = false)
    private int stichNummer;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SpielerPosition aufspielerPosition;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SpielerPosition gewinnerPosition;

    @Min(0)
    @Column(nullable = false)
    private int augen;

    @Valid
    @OneToMany(mappedBy = "stich", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("reihenfolge ASC")
    private List<GespielteKarteEntity> gespielteKarten = new ArrayList<>();

    protected StichEntity() {
    }

    private StichEntity(int stichNummer, SpielerPosition aufspielerPosition, SpielerPosition gewinnerPosition, int augen) {
        this.stichNummer = stichNummer;
        this.aufspielerPosition = Objects.requireNonNull(aufspielerPosition, "aufspielerPosition darf nicht null sein");
        this.gewinnerPosition = Objects.requireNonNull(gewinnerPosition, "gewinnerPosition darf nicht null sein");
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
        gespielteKarten.add(karte);
        karte.setzeStich(this);
    }

    public SpielEntity spiel() {
        return spiel;
    }

    public int stichNummer() {
        return stichNummer;
    }

    public SpielerPosition aufspielerPosition() {
        return aufspielerPosition;
    }

    public SpielerPosition gewinnerPosition() {
        return gewinnerPosition;
    }

    public int augen() {
        return augen;
    }

    public List<GespielteKarteEntity> gespielteKarten() {
        return List.copyOf(gespielteKarten);
    }
}
