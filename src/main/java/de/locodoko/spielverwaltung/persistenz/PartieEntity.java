package de.locodoko.spielverwaltung.persistenz;

import de.locodoko.spiel.karten.SpielerPosition;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapKeyColumn;
import jakarta.persistence.MapKeyEnumerated;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Entity
@Table(name = "partie")
public class PartieEntity extends AbstraktePersistenzEntity {

    @Min(1)
    @Column(nullable = false)
    private int anzahlSpiele;

    @Column(nullable = false)
    private int aktuellesSpielNummer;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PartieStatus status;

    @OneToOne(mappedBy = "partie", fetch = FetchType.LAZY)
    private TischEntity tisch;

    @Valid
    @OneToMany(mappedBy = "partie", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("spielNummer ASC")
    private List<SpielEntity> spiele = new ArrayList<>();

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "partie_gesamtpunktestand", joinColumns = @JoinColumn(name = "partie_id"))
    @MapKeyEnumerated(EnumType.STRING)
    @MapKeyColumn(name = "spieler_position")
    @Column(name = "spielpunkte", nullable = false)
    private Map<SpielerPosition, Integer> gesamtpunktestand = new EnumMap<>(SpielerPosition.class);

    protected PartieEntity() {
    }

    private PartieEntity(int anzahlSpiele) {
        this.anzahlSpiele = anzahlSpiele;
        this.status = PartieStatus.LAUFEND;
        for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
            gesamtpunktestand.put(position, 0);
        }
    }

    public static PartieEntity neu(int anzahlSpiele) {
        return new PartieEntity(anzahlSpiele);
    }

    void setzeTisch(TischEntity tisch) {
        this.tisch = tisch;
    }

    public void fuegeSpielHinzu(SpielEntity spiel) {
        Objects.requireNonNull(spiel, "spiel darf nicht null sein");
        spiele.add(spiel);
        spiel.setzePartie(this);
        aktuellesSpielNummer = Math.max(aktuellesSpielNummer, spiel.spielNummer());
    }

    public void setzeGesamtpunktestand(SpielerPosition spielerPosition, int spielpunkte) {
        gesamtpunktestand.put(Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein"), spielpunkte);
    }

    public void markiereAlsBeendet() {
        this.status = PartieStatus.BEENDET;
    }

    public int anzahlSpiele() {
        return anzahlSpiele;
    }

    public int aktuellesSpielNummer() {
        return aktuellesSpielNummer;
    }

    public PartieStatus status() {
        return status;
    }

    public TischEntity tisch() {
        return tisch;
    }

    public List<SpielEntity> spiele() {
        return List.copyOf(spiele);
    }

    public Map<SpielerPosition, Integer> gesamtpunktestand() {
        return Map.copyOf(gesamtpunktestand);
    }
}
