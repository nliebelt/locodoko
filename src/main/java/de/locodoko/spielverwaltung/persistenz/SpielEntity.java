package de.locodoko.spielverwaltung.persistenz;

import de.locodoko.spiel.karten.SpielerPosition;
import de.locodoko.spiel.karten.Spieltyp;
import de.locodoko.spiel.partie.Partei;
import de.locodoko.spiel.partie.Spielergebnis;
import de.locodoko.spiel.partie.Spielphase;
import de.locodoko.spiel.partie.Sonderpunkt;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
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
import java.util.Map;
import java.util.Objects;

@Entity
@Table(name = "spiel")
public class SpielEntity extends AbstraktePersistenzEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "partie_id", nullable = false)
    private PartieEntity partie;

    @Min(1)
    @Column(nullable = false)
    private int spielNummer;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SpielerPosition geberPosition;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Spieltyp spieltyp;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Spielphase phase;

    @Valid
    @Embedded
    private SpielErgebnisEmbeddable ergebnis;

    @Valid
    @OneToMany(mappedBy = "spiel", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("spielerPosition ASC")
    private List<HandEntity> haende = new ArrayList<>();

    @Valid
    @OneToMany(mappedBy = "spiel", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("stichNummer ASC")
    private List<StichEntity> stiche = new ArrayList<>();

    @Valid
    @OneToMany(mappedBy = "spiel", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("partei ASC, sonderpunkt ASC")
    private List<SpielSonderpunktEntity> sonderpunkte = new ArrayList<>();

    protected SpielEntity() {
    }

    private SpielEntity(int spielNummer, SpielerPosition geberPosition, Spieltyp spieltyp, Spielphase phase) {
        this.spielNummer = spielNummer;
        this.geberPosition = Objects.requireNonNull(geberPosition, "geberPosition darf nicht null sein");
        this.spieltyp = Objects.requireNonNull(spieltyp, "spieltyp darf nicht null sein");
        this.phase = Objects.requireNonNull(phase, "phase darf nicht null sein");
    }

    public static SpielEntity neu(int spielNummer, SpielerPosition geberPosition, Spieltyp spieltyp, Spielphase phase) {
        return new SpielEntity(spielNummer, geberPosition, spieltyp, phase);
    }

    void setzePartie(PartieEntity partie) {
        this.partie = partie;
    }

    public void fuegeHandHinzu(HandEntity hand) {
        Objects.requireNonNull(hand, "hand darf nicht null sein");
        haende.add(hand);
        hand.setzeSpiel(this);
    }

    public void fuegeStichHinzu(StichEntity stich) {
        Objects.requireNonNull(stich, "stich darf nicht null sein");
        stiche.add(stich);
        stich.setzeSpiel(this);
    }

    public void uebernehmeErgebnis(Spielergebnis spielergebnis) {
        Objects.requireNonNull(spielergebnis, "spielergebnis darf nicht null sein");
        ergebnis = SpielErgebnisEmbeddable.aus(spielergebnis);
        sonderpunkte.clear();
        for (Map.Entry<Partei, List<Sonderpunkt>> eintrag : spielergebnis.sonderpunkteProPartei().entrySet()) {
            for (Sonderpunkt sonderpunkt : eintrag.getValue()) {
                SpielSonderpunktEntity spielSonderpunktEntity = SpielSonderpunktEntity.neu(eintrag.getKey(), sonderpunkt);
                spielSonderpunktEntity.setzeSpiel(this);
                sonderpunkte.add(spielSonderpunktEntity);
            }
        }
    }

    public PartieEntity partie() {
        return partie;
    }

    public int spielNummer() {
        return spielNummer;
    }

    public SpielerPosition geberPosition() {
        return geberPosition;
    }

    public Spieltyp spieltyp() {
        return spieltyp;
    }

    public Spielphase phase() {
        return phase;
    }

    public SpielErgebnisEmbeddable ergebnis() {
        return ergebnis;
    }

    public List<HandEntity> haende() {
        return List.copyOf(haende);
    }

    public List<StichEntity> stiche() {
        return List.copyOf(stiche);
    }

    public List<SpielSonderpunktEntity> sonderpunkte() {
        return List.copyOf(sonderpunkte);
    }
}
