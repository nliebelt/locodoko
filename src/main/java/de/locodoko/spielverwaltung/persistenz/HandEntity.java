package de.locodoko.spielverwaltung.persistenz;

import de.locodoko.spiel.karten.Karte;
import de.locodoko.spiel.karten.SpielerPosition;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Entity
@Table(name = "hand")
public class HandEntity extends AbstraktePersistenzEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "spiel_id", nullable = false)
    private SpielEntity spiel;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SpielerPosition spielerPosition;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "hand_karte", joinColumns = @JoinColumn(name = "hand_id"))
    @OrderColumn(name = "karten_index")
    private List<HandKarteEmbeddable> karten = new ArrayList<>();

    protected HandEntity() {
    }

    private HandEntity(SpielerPosition spielerPosition, List<HandKarteEmbeddable> karten) {
        this.spielerPosition = Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        this.karten = new ArrayList<>(karten);
    }

    public static HandEntity neu(SpielerPosition spielerPosition, List<Karte> karten) {
        return new HandEntity(
            spielerPosition,
            karten.stream().map(HandKarteEmbeddable::aus).toList()
        );
    }

    public void ersetzeKarten(List<Karte> neueKarten) {
        Objects.requireNonNull(neueKarten, "neueKarten duerfen nicht null sein");
        this.karten = neueKarten.stream()
            .map(HandKarteEmbeddable::aus)
            .toList();
    }

    void setzeSpiel(SpielEntity spiel) {
        this.spiel = spiel;
    }

    public SpielEntity spiel() {
        return spiel;
    }

    public SpielerPosition spielerPosition() {
        return spielerPosition;
    }

    public List<HandKarteEmbeddable> karten() {
        return List.copyOf(karten);
    }
}
