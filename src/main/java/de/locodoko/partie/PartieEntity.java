package de.locodoko.partie;

import de.locodoko.lobby.TischEntity;

import de.locodoko.karten.SpielerPosition;
import org.springframework.data.annotation.Transient;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.MappedCollection;
import org.springframework.data.relational.core.mapping.Table;

import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Persistenz-Entity fuer eine Partie (Abfolge von Spielen).
 * Standalone Aggregate Root.
 * Besitzt SpielEntity via @MappedCollection (Map nach spiel_nummer).
 * Gesamtpunktestand wird direkt als Spalten gespeichert (eine pro SpielerPosition).
 * Rueckreferenz zum Tisch ist transient (in-memory only).
 */
@Table("partie")
public class PartieEntity extends AbstraktePersistenzEntity {

    @Column("anzahl_spiele")
    private int anzahlSpiele;

    @Column("aktuelles_spiel_nummer")
    private int aktuellesSpielNummer;

    @Column("status")
    private String status;

    /** Gesamtpunktestand direkt als Spalten (eine pro SpielerPosition). */
    @Column("punkte_sued")
    private int punkteSued = 0;

    @Column("punkte_west")
    private int punkteWest = 0;

    @Column("punkte_nord")
    private int punkteNord = 0;

    @Column("punkte_ost")
    private int punkteOst = 0;

    /**
     * Spiele: Owned by dieser Partie via @MappedCollection.
     * Map-Key = spiel_nummer (1-basiert).
     * SpielEntity hat KEIN @Column("spiel_nummer") — der keyColumn schreibt es.
     */
    @MappedCollection(idColumn = "partie_id", keyColumn = "spiel_nummer")
    private Map<Integer, SpielEntity> spieleMap = new LinkedHashMap<>();

    /** Rueckreferenz auf den Tisch (transient, wird in-memory gesetzt). */
    @Transient
    private TischEntity tisch;

    protected PartieEntity() {
    }

    private PartieEntity(int anzahlSpiele) {
        this.anzahlSpiele = anzahlSpiele;
        this.status = PartieStatus.LAUFEND.name();
        this.punkteSued = 0;
        this.punkteWest = 0;
        this.punkteNord = 0;
        this.punkteOst = 0;
    }

    public static PartieEntity neu(int anzahlSpiele) {
        return new PartieEntity(anzahlSpiele);
    }

    /** Setzt die transiente Tisch-Referenz (in-memory, nicht persistiert). */
    public void setzeTisch(TischEntity tisch) {
        this.tisch = tisch;
    }

    public void fuegeSpielHinzu(SpielEntity spiel) {
        Objects.requireNonNull(spiel, "spiel darf nicht null sein");
        spieleMap.put(spiel.spielNummer(), spiel);
        spiel.setzePartie(this);
        aktuellesSpielNummer = Math.max(aktuellesSpielNummer, spiel.spielNummer());
    }

    public void setzeGesamtpunktestand(SpielerPosition spielerPosition, int spielpunkte) {
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        switch (spielerPosition) {
            case SUED -> this.punkteSued = spielpunkte;
            case WEST -> this.punkteWest = spielpunkte;
            case NORD -> this.punkteNord = spielpunkte;
            case OST -> this.punkteOst = spielpunkte;
        }
    }

    public void markiereAlsBeendet() {
        this.status = PartieStatus.BEENDET.name();
    }

    /** Markiert diese Partie als abgebrochen (Spieler hat Tisch verlassen). */
    public void markiereAlsAbgebrochen() {
        this.status = PartieStatus.ABGEBROCHEN.name();
    }

    public int anzahlSpiele() {
        return anzahlSpiele;
    }

    public int aktuellesSpielNummer() {
        return aktuellesSpielNummer;
    }

    public PartieStatus status() {
        return PartieStatus.valueOf(status);
    }

    public TischEntity tisch() {
        return tisch;
    }

    public List<SpielEntity> spiele() {
        // Spiele nach spiel_nummer (Map-Key) sortiert zurueckgeben
        // Transiente Partie-Rueckreferenz in Kindentitaeten setzen
        return spieleMap.entrySet().stream()
            .sorted(Map.Entry.comparingByKey())
            .peek(eintrag -> {
                eintrag.getValue().setzeSpielNummer(eintrag.getKey());
                eintrag.getValue().setzePartie(this);
            })
            .map(Map.Entry::getValue)
            .toList();
    }

    public Map<SpielerPosition, Integer> gesamtpunktestand() {
        EnumMap<SpielerPosition, Integer> map = new EnumMap<>(SpielerPosition.class);
        map.put(SpielerPosition.SUED, punkteSued);
        map.put(SpielerPosition.WEST, punkteWest);
        map.put(SpielerPosition.NORD, punkteNord);
        map.put(SpielerPosition.OST, punkteOst);
        return Map.copyOf(map);
    }
}
