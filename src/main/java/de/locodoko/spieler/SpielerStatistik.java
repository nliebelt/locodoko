package de.locodoko.spieler;

import de.locodoko.system.AbstraktePersistenzEntity;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.util.UUID;

/**
 * Spieler-Statistik (1:1 mit Spieler). Append-only — wird niemals zurueckgesetzt.
 * Wird bei jedem abgeschlossenen Spiel via {@link SpielerProfilService} aktualisiert.
 */
@Table("spieler_statistik")
public class SpielerStatistik extends AbstraktePersistenzEntity {

    @Column("spieler_id")
    private UUID spielerId;

    @Column("anzahl_spiele")
    private int anzahlSpiele;

    @Column("anzahl_siege")
    private int anzahlSiege;

    @Column("gesamt_punkte")
    private int gesamtPunkte;

    @Column("fuchs_gefangen")
    private int fuchsGefangen;

    @Column("fuchs_verloren")
    private int fuchsVerloren;

    @Column("karlchen_gespielt")
    private int karlchenGespielt;

    @Column("doppelkoepfe")
    private int doppelkoepfe;

    @Column("solos_siege")
    private int solosSiege;

    @Column("solos_niederlagen")
    private int solosNiederlagen;

    protected SpielerStatistik() {
    }

    /** Erzeugt eine neue leere Statistik fuer den angegebenen Spieler. */
    public static SpielerStatistik fuer(UUID spielerId) {
        SpielerStatistik statistik = new SpielerStatistik();
        statistik.spielerId = spielerId;
        return statistik;
    }

    public UUID spielerId() { return spielerId; }
    public int anzahlSpiele() { return anzahlSpiele; }
    public int anzahlSiege() { return anzahlSiege; }
    public int gesamtPunkte() { return gesamtPunkte; }
    public int fuchsGefangen() { return fuchsGefangen; }
    public int fuchsVerloren() { return fuchsVerloren; }
    public int karlchenGespielt() { return karlchenGespielt; }
    public int doppelkoepfe() { return doppelkoepfe; }
    public int solosSiege() { return solosSiege; }
    public int solosNiederlagen() { return solosNiederlagen; }

    /** Aktualisiert die Statistik nach einem abgeschlossenen Spiel. */
    public void verarbeiteSpiel(boolean sieger, int spielpunkte, int neuerFuchsGefangen,
                                int neuerFuchsVerloren, int neuerKarlchenGespielt,
                                int neueDoppelkoepfe, boolean istSolist) {
        this.anzahlSpiele++;
        if (sieger) this.anzahlSiege++;
        this.gesamtPunkte += spielpunkte;
        this.fuchsGefangen += neuerFuchsGefangen;
        this.fuchsVerloren += neuerFuchsVerloren;
        this.karlchenGespielt += neuerKarlchenGespielt;
        this.doppelkoepfe += neueDoppelkoepfe;
        if (istSolist) {
            if (sieger) this.solosSiege++;
            else this.solosNiederlagen++;
        }
    }
}
