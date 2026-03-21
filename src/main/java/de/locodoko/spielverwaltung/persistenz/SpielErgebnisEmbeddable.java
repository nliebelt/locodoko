package de.locodoko.spielverwaltung.persistenz;

import de.locodoko.spiel.karten.SpielerPosition;
import de.locodoko.spiel.partie.Partei;
import de.locodoko.spiel.partie.Spielergebnis;

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
    private Integer spielpunkteSued;
    private Integer spielpunkteWest;
    private Integer spielpunkteNord;
    private Integer spielpunkteOst;

    protected SpielErgebnisEmbeddable() {
    }

    private SpielErgebnisEmbeddable(Spielergebnis spielergebnis) {
        this.reAugen = spielergebnis.augenVon(Partei.RE);
        this.kontraAugen = spielergebnis.augenVon(Partei.KONTRA);
        this.siegerPartei = spielergebnis.siegerPartei().name();
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
        return siegerPartei != null ? Partei.valueOf(siegerPartei) : null;
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

    // Getter/Setter fuer Spring Data JDBC (ohne @Embedded brauchen wir flache Felder direkt in SpielEntity)
    void setReAugen(Integer reAugen) { this.reAugen = reAugen; }
    void setKontraAugen(Integer kontraAugen) { this.kontraAugen = kontraAugen; }
    void setSiegerPartei(String siegerPartei) { this.siegerPartei = siegerPartei; }
    void setSpielwert(Integer spielwert) { this.spielwert = spielwert; }
    void setSpielpunkteSued(Integer spielpunkteSued) { this.spielpunkteSued = spielpunkteSued; }
    void setSpielpunkteWest(Integer spielpunkteWest) { this.spielpunkteWest = spielpunkteWest; }
    void setSpielpunkteNord(Integer spielpunkteNord) { this.spielpunkteNord = spielpunkteNord; }
    void setSpielpunkteOst(Integer spielpunkteOst) { this.spielpunkteOst = spielpunkteOst; }
}
