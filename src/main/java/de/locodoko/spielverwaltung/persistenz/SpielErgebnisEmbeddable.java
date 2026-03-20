package de.locodoko.spielverwaltung.persistenz;

import de.locodoko.spiel.karten.SpielerPosition;
import de.locodoko.spiel.partie.Partei;
import de.locodoko.spiel.partie.Spielergebnis;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;

@Embeddable
public class SpielErgebnisEmbeddable {

    @Column(name = "re_augen")
    private Integer reAugen;

    @Column(name = "kontra_augen")
    private Integer kontraAugen;

    @Enumerated(EnumType.STRING)
    @Column(name = "sieger_partei")
    private Partei siegerPartei;

    @Column(name = "spielwert")
    private Integer spielwert;

    @Column(name = "spielpunkte_sued")
    private Integer spielpunkteSued;

    @Column(name = "spielpunkte_west")
    private Integer spielpunkteWest;

    @Column(name = "spielpunkte_nord")
    private Integer spielpunkteNord;

    @Column(name = "spielpunkte_ost")
    private Integer spielpunkteOst;

    protected SpielErgebnisEmbeddable() {
    }

    private SpielErgebnisEmbeddable(Spielergebnis spielergebnis) {
        this.reAugen = spielergebnis.augenVon(Partei.RE);
        this.kontraAugen = spielergebnis.augenVon(Partei.KONTRA);
        this.siegerPartei = spielergebnis.siegerPartei();
        this.spielwert = spielergebnis.spielwert();
        this.spielpunkteSued = spielergebnis.spielpunkteVon(SpielerPosition.SUED);
        this.spielpunkteWest = spielergebnis.spielpunkteVon(SpielerPosition.WEST);
        this.spielpunkteNord = spielergebnis.spielpunkteVon(SpielerPosition.NORD);
        this.spielpunkteOst = spielergebnis.spielpunkteVon(SpielerPosition.OST);
    }

    public static SpielErgebnisEmbeddable aus(Spielergebnis spielergebnis) {
        return new SpielErgebnisEmbeddable(spielergebnis);
    }

    public Integer reAugen() {
        return reAugen;
    }

    public Integer kontraAugen() {
        return kontraAugen;
    }

    public Partei siegerPartei() {
        return siegerPartei;
    }

    public Integer spielwert() {
        return spielwert;
    }

    public Integer spielpunkteSued() {
        return spielpunkteSued;
    }

    public Integer spielpunkteWest() {
        return spielpunkteWest;
    }

    public Integer spielpunkteNord() {
        return spielpunkteNord;
    }

    public Integer spielpunkteOst() {
        return spielpunkteOst;
    }
}
