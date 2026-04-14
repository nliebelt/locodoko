package de.locodoko.partie;

import de.locodoko.partie.Partei;
import de.locodoko.partie.Spielergebnis;

/**
 * Eingebettetes Ergebnis eines Spiels.
 * Die Felder werden direkt als Spalten in der 'spiel'-Tabelle gespeichert.
 * Spring Data JDBC unterstuetzt @Embedded nativ — kein JPA noetig.
 */
public class SpielErgebnisEmbeddable {

    private Integer reAugen;
    private Integer kontraAugen;
    private String siegerPartei;
    private Integer spielwert;
    private Integer grundwert;
    private Integer absagePunkte;
    private Integer gegenDieAltenPunkte;
    private Integer soloMultiplikator;
    private Integer spielpunkteSued;
    private Integer spielpunkteWest;
    private Integer spielpunkteNord;
    private Integer spielpunkteOst;

    protected SpielErgebnisEmbeddable() {
    }

    private SpielErgebnisEmbeddable(Spielergebnis spielergebnis) {
        this.reAugen = spielergebnis.augenVon(Partei.RE).wert();
        this.kontraAugen = spielergebnis.augenVon(Partei.KONTRA).wert();
        this.siegerPartei = spielergebnis.siegerPartei().name();
        this.spielwert = spielergebnis.spielwert().wert();
        this.grundwert = spielergebnis.grundwert();
        this.absagePunkte = spielergebnis.absagePunkte();
        this.gegenDieAltenPunkte = spielergebnis.gegenDieAltenPunkte();
        this.soloMultiplikator = spielergebnis.soloMultiplikator();
        this.spielpunkteSued = spielergebnis.spielpunkteVon(SpielerPosition.SUED).wert();
        this.spielpunkteWest = spielergebnis.spielpunkteVon(SpielerPosition.WEST).wert();
        this.spielpunkteNord = spielergebnis.spielpunkteVon(SpielerPosition.NORD).wert();
        this.spielpunkteOst = spielergebnis.spielpunkteVon(SpielerPosition.OST).wert();
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
        return siegerPartei != null ? Partei.valueOf(siegerPartei) : null;
    }

    public Integer spielwert() {
        return spielwert;
    }

    public Integer grundwert() {
        return grundwert;
    }

    public Integer absagePunkte() {
        return absagePunkte;
    }

    public Integer gegenDieAltenPunkte() {
        return gegenDieAltenPunkte;
    }

    public Integer soloMultiplikator() {
        return soloMultiplikator;
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

    // Getter/Setter fuer Spring Data JDBC (ohne @Embedded brauchen wir flache Felder direkt in SpielEntity)
    void setReAugen(Integer reAugen) { this.reAugen = reAugen; }
    void setKontraAugen(Integer kontraAugen) { this.kontraAugen = kontraAugen; }
    void setSiegerPartei(String siegerPartei) { this.siegerPartei = siegerPartei; }
    void setSpielwert(Integer spielwert) { this.spielwert = spielwert; }
    void setGrundwert(Integer grundwert) { this.grundwert = grundwert; }
    void setAbsagePunkte(Integer absagePunkte) { this.absagePunkte = absagePunkte; }
    void setGegenDieAltenPunkte(Integer gegenDieAltenPunkte) { this.gegenDieAltenPunkte = gegenDieAltenPunkte; }
    void setSoloMultiplikator(Integer soloMultiplikator) { this.soloMultiplikator = soloMultiplikator; }
    void setSpielpunkteSued(Integer spielpunkteSued) { this.spielpunkteSued = spielpunkteSued; }
    void setSpielpunkteWest(Integer spielpunkteWest) { this.spielpunkteWest = spielpunkteWest; }
    void setSpielpunkteNord(Integer spielpunkteNord) { this.spielpunkteNord = spielpunkteNord; }
    void setSpielpunkteOst(Integer spielpunkteOst) { this.spielpunkteOst = spielpunkteOst; }
}
