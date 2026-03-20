package de.locodoko.spielverwaltung.persistenz;

import de.locodoko.spiel.karten.Farbe;
import de.locodoko.spiel.karten.Karte;
import de.locodoko.spiel.karten.Kartenwert;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;

@Embeddable
public class HandKarteEmbeddable {

    @Enumerated(EnumType.STRING)
    @Column(name = "farbe", nullable = false)
    private Farbe farbe;

    @Enumerated(EnumType.STRING)
    @Column(name = "wert", nullable = false)
    private Kartenwert wert;

    @Column(name = "exemplar_index", nullable = false)
    private int exemplarIndex;

    protected HandKarteEmbeddable() {
    }

    private HandKarteEmbeddable(Farbe farbe, Kartenwert wert, int exemplarIndex) {
        this.farbe = farbe;
        this.wert = wert;
        this.exemplarIndex = exemplarIndex;
    }

    public static HandKarteEmbeddable aus(Karte karte) {
        return new HandKarteEmbeddable(karte.farbe(), karte.wert(), karte.exemplarIndex());
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
}
