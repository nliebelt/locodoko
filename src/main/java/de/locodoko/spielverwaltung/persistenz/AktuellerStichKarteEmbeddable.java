package de.locodoko.spielverwaltung.persistenz;

import de.locodoko.spiel.karten.Farbe;
import de.locodoko.spiel.karten.GespielteKarte;
import de.locodoko.spiel.karten.Karte;
import de.locodoko.spiel.karten.Kartenwert;
import de.locodoko.spiel.karten.SpielerPosition;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;

import java.util.Objects;

@Embeddable
public class AktuellerStichKarteEmbeddable {

    @Enumerated(EnumType.STRING)
    @Column(name = "spieler_position", nullable = false)
    private SpielerPosition spielerPosition;

    @Enumerated(EnumType.STRING)
    @Column(name = "farbe", nullable = false)
    private Farbe farbe;

    @Enumerated(EnumType.STRING)
    @Column(name = "wert", nullable = false)
    private Kartenwert wert;

    @Column(name = "exemplar_index", nullable = false)
    private int exemplarIndex;

    @Column(name = "reihenfolge", nullable = false)
    private int reihenfolge;

    protected AktuellerStichKarteEmbeddable() {
    }

    private AktuellerStichKarteEmbeddable(
        SpielerPosition spielerPosition,
        Farbe farbe,
        Kartenwert wert,
        int exemplarIndex,
        int reihenfolge
    ) {
        this.spielerPosition = Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        this.farbe = Objects.requireNonNull(farbe, "farbe darf nicht null sein");
        this.wert = Objects.requireNonNull(wert, "wert darf nicht null sein");
        this.exemplarIndex = exemplarIndex;
        this.reihenfolge = reihenfolge;
    }

    public static AktuellerStichKarteEmbeddable aus(GespielteKarte gespielteKarte) {
        Objects.requireNonNull(gespielteKarte, "gespielteKarte darf nicht null sein");
        Karte karte = Objects.requireNonNull(gespielteKarte.karte(), "karte darf nicht null sein");
        return new AktuellerStichKarteEmbeddable(
            gespielteKarte.spieler(),
            karte.farbe(),
            karte.wert(),
            karte.exemplarIndex(),
            gespielteKarte.reihenfolge()
        );
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
