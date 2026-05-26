package de.locodoko.partie;

import de.locodoko.karten.Kartendeck;
import de.locodoko.karten.Spielregeln;
import de.locodoko.system.AbstraktePersistenzEntity;

import org.springframework.data.annotation.Transient;
import org.springframework.data.annotation.Version;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.MappedCollection;
import org.springframework.data.relational.core.mapping.Table;

import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/**
 * Eine Partie Doppelkopf — eine geordnete Folge von Einzelspielen.
 *
 * <p>Eine Partie besteht aus einer festen Anzahl von {@link Spiel}-Instanzen. Sie verwaltet
 * die Geberrotation (jeder Spieler gibt einmal pro Runde), den kumulierten Gesamtpunktestand
 * aller Spieler sowie die gemeinsamen {@link Spielregeln}. Jedes abgeschlossene Spiel wird
 * in der Historienliste archiviert; das laufende Spiel ist separat zugreifbar.</p>
 *
 * <p>Aggregate Root des {@code partie}-Bounded-Context. Gleichzeitig Persistenz-Entity
 * (Spring Data JDBC). Domain-Felder sind {@code @Transient}; DB-Felder werden ueber
 * entity-kompatible Methoden gelesen/geschrieben.</p>
 */
@Table("partie")
public class Partie extends AbstraktePersistenzEntity {

    @Version
    private Long version;

    @Column("anzahl_spiele")
    private int anzahlSpiele;

    @Column("spielregeln")
    private Spielregeln spielregeln;

    @Transient private SpielerPosition naechsterGeber;
    @Transient private List<Spiel> abgeschlosseneSpieleIntern;
    @Transient private Spiel aktuellesSpiel;
    @Transient private Map<SpielerPosition, Integer> gesamtpunktestand;

    @Column("bockrunden_zaehler")
    private int bockrundenZaehler = 0;

    @Transient private SpielerPosition solistDesLetztenSpiels;

    // ── DB-Spalten (aus Partie (ehemals PartieEntity)) ───────────────────────────

    @Column("aktuelles_spiel_nummer")
    private int aktuellesSpielNummer;

    @Column("status")
    private String statusDb;

    @Column("punkte_sued")
    private int punkteSued = 0;

    @Column("punkte_west")
    private int punkteWest = 0;

    @Column("punkte_nord")
    private int punkteNord = 0;

    @Column("punkte_ost")
    private int punkteOst = 0;

    @Column("solist_des_letzten_spiels")
    private String solistDesLetztenSpielsDb = null;

    @Column("beendet_am")
    private Instant beendetAm = null;

    @MappedCollection(idColumn = "partie_id", keyColumn = "spiel_nummer")
    private Map<Integer, SpielergebnisArchiv> archivierteSpieleMap = new LinkedHashMap<>();

    @MappedCollection(idColumn = "partie_id", keyColumn = "spiel_nummer")
    private Map<Integer, Spiel> spieleMap = new LinkedHashMap<>();

    // ── Konstruktoren ───────────────────────────────────────────────────────

    /** Fuer Spring Data JDBC (Reflektion). */
    protected Partie() {
        super();
    }

    private Partie(
        int anzahlSpiele,
        Spielregeln spielregeln,
        SpielerPosition naechsterGeber,
        List<Spiel> abgeschlosseneSpieleIntern,
        Spiel aktuellesSpiel,
        Map<SpielerPosition, Integer> gesamtpunktestand,
        int bockrundenZaehler,
        SpielerPosition solistDesLetztenSpiels,
        Long version
    ) {
        super();
        if (anzahlSpiele < 1) {
            throw new IllegalArgumentException("Eine Partie muss mindestens ein Spiel enthalten");
        }
        this.anzahlSpiele = anzahlSpiele;
        this.spielregeln = Objects.requireNonNull(spielregeln, "spielregeln duerfen nicht null sein");
        this.naechsterGeber = Objects.requireNonNull(naechsterGeber, "naechsterGeber darf nicht null sein");
        this.abgeschlosseneSpieleIntern = List.copyOf(abgeschlosseneSpieleIntern);
        this.aktuellesSpiel = aktuellesSpiel;
        this.gesamtpunktestand = Map.copyOf(gesamtpunktestand);
        if (bockrundenZaehler < 0) {
            throw new IllegalArgumentException("bockrundenZaehler darf nicht negativ sein");
        }
        this.bockrundenZaehler = bockrundenZaehler;
        this.solistDesLetztenSpiels = solistDesLetztenSpiels;
        this.version = version;
    }

    // ── Statische Factory-Methoden ──────────────────────────────────────────

    public static Partie ausPersistiertemStand(
        int anzahlSpiele,
        Spielregeln spielregeln,
        SpielerPosition naechsterGeber,
        List<Spiel> abgeschlosseneSpieleIntern,
        Spiel aktuellesSpiel,
        Map<SpielerPosition, Integer> gesamtpunktestand,
        int bockrundenZaehler,
        SpielerPosition solistDesLetztenSpiels,
        Long version
    ) {
        return new Partie(anzahlSpiele, spielregeln, naechsterGeber, abgeschlosseneSpieleIntern, aktuellesSpiel, gesamtpunktestand, bockrundenZaehler, solistDesLetztenSpiels, version);
    }

    public static Partie neu(int anzahlSpiele, SpielerPosition ersterGeber, Spielregeln spielregeln) {
        EnumMap<SpielerPosition, Integer> gesamtpunktestand = new EnumMap<>(SpielerPosition.class);
        for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
            gesamtpunktestand.put(position, 0);
        }
        return new Partie(anzahlSpiele, spielregeln, ersterGeber, List.of(), null, gesamtpunktestand, 0, null, null);
    }

    /** Erstellt eine neue Persistenz-Partie. */
    public static Partie neuePersistenz(int anzahlSpiele) {
        Partie p = new Partie();
        p.anzahlSpiele = anzahlSpiele;
        p.statusDb = PartieStatus.LAUFEND.name();
        return p;
    }

    // ── Domain-Aktionen (erzeugen neue Instanzen) ───────────────────────────

    public Partie starteNaechstesSpiel(Kartendeck kartendeck) {
        Objects.requireNonNull(kartendeck, "kartendeck darf nicht null sein");
        if (istBeendet()) {
            throw new SpielzugKonfliktException("Die Partie ist bereits beendet");
        }
        if (aktuellesSpiel != null) {
            throw new SpielzugKonfliktException("Es laeuft bereits ein Spiel");
        }
        Spiel neuesSpiel = solistDesLetztenSpiels != null
            ? Spiel.neuMitSolistAufspieler(naechsterGeber, solistDesLetztenSpiels, spielregeln, kartendeck)
            : Spiel.neu(naechsterGeber, spielregeln, kartendeck);
        return new Partie(
            anzahlSpiele,
            spielregeln,
            naechsterGeber,
            abgeschlosseneSpieleIntern,
            neuesSpiel,
            gesamtpunktestand,
            bockrundenZaehler,
            null,
            version
        );
    }

    public Partie mitAktuellemSpiel(Spiel spiel) {
        Objects.requireNonNull(spiel, "spiel darf nicht null sein");
        if (aktuellesSpiel == null) {
            throw new SpielzugKonfliktException("Es gibt kein aktuelles Spiel");
        }
        return new Partie(anzahlSpiele, spielregeln, naechsterGeber, abgeschlosseneSpieleIntern, spiel, gesamtpunktestand, bockrundenZaehler, solistDesLetztenSpiels, version);
    }

    public Partie schliesseAktuellesSpielAb() {
        Spiel spiel = aktuellesSpiel();
        if (!(spiel.phase() instanceof Spielphase.GesamtstandAktualisieren)) {
            throw new SpielzugKonfliktException("Nur vollstaendig ausgewertete Spiele duerfen abgeschlossen werden");
        }
        Spielergebnis ergebnis = spiel.ergebnis()
            .orElseThrow(() -> new IllegalStateException("Ein abgeschlossenes Spiel braucht ein Ergebnis"));

        int neueTrigger = 0;
        if (spielregeln.bockrundenAktiv()) {
            if (spiel.hatHerzDurchgegangenenStich()) {
                neueTrigger++;
            }
            if (ergebnis.siegerPartei() == Partei.RE
                    && spiel.ansagen().hatGrundansage(Partei.KONTRA, spiel.parteien())) {
                neueTrigger++;
            }
            neueTrigger += spiel.einwurfZaehler();
        }

        int multiplikator = (spielregeln.bockrundenAktiv() && bockrundenZaehler > 0) ? 2 : 1;
        Map<SpielerPosition, Integer> neuerGesamtpunktestand = new EnumMap<>(SpielerPosition.class);
        neuerGesamtpunktestand.putAll(gesamtpunktestand);
        for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
            neuerGesamtpunktestand.merge(position, ergebnis.spielpunkteVon(position).wert() * multiplikator, Integer::sum);
        }

        int neuerBockrundenZaehler = (bockrundenZaehler > 0 ? bockrundenZaehler - 1 : 0) + neueTrigger;
        List<Spiel> neueAbgeschlosseneSpiele = new ArrayList<>(abgeschlosseneSpieleIntern);
        neueAbgeschlosseneSpiele.add(spiel);

        boolean warSolo = spiel.parteien() != null && spiel.parteien().spielerVon(Partei.RE).size() == 1;
        SpielerPosition neuerGeber = warSolo ? spiel.geber() : spiel.geber().naechsteImUhrzeigersinn();
        SpielerPosition neuerSolist = warSolo ? spiel.parteien().spielerVon(Partei.RE).get(0) : null;
        return new Partie(
            anzahlSpiele,
            spielregeln,
            neuerGeber,
            neueAbgeschlosseneSpiele,
            null,
            neuerGesamtpunktestand,
            neuerBockrundenZaehler,
            neuerSolist,
            version
        );
    }

    public Partie schliesseAktuellesSpielAbUndStarteNaechstes() {
        Spiel spiel = aktuellesSpiel();
        if (spiel.phase() instanceof Spielphase.Auswertung) {
            spiel.werteAus();
        }
        Partie abgeschlossenePartie = schliesseAktuellesSpielAb();
        if (abgeschlossenePartie.istBeendet()) {
            return abgeschlossenePartie;
        }
        Kartendeck kartendeck = Kartendeck.neu(abgeschlossenePartie.spielregeln()).gemischt();
        Partie partieNaechstesSpiel = abgeschlossenePartie.starteNaechstesSpiel(kartendeck);
        partieNaechstesSpiel.aktuellesSpiel().teileKartenAus();
        return partieNaechstesSpiel;
    }

    // ── Domain-Getter ───────────────────────────────────────────────────────

    public boolean istBeendet() {
        return abgeschlosseneSpieleIntern != null && abgeschlosseneSpieleIntern.size() >= anzahlSpiele;
    }

    public int anzahlSpiele() {
        return anzahlSpiele;
    }

    public Spielregeln spielregeln() {
        return spielregeln;
    }

    public SpielerPosition naechsterGeber() {
        return naechsterGeber;
    }

    /**
     * Liefert die abgeschlossenen Spiele als persistierte Archiv-Aggregate.
     *
     * <p>Diese Liste wird aus der Datenbank geladen (via {@code @MappedCollection})
     * und enthält alle abgeschlossenen Spiele mit ihren Ergebnissen und Sonderpunkten.</p>
     */
    public List<SpielergebnisArchiv> abgeschlosseneSpiele() {
        return archivierteSpieleMap.entrySet().stream()
            .sorted(Map.Entry.comparingByKey())
            .map(Map.Entry::getValue)
            .toList();
    }

    /**
     * Anzahl der abgeschlossenen Spiele gemaess dem laufenden Domain-Stand.
     *
     * <p>Wird fuer Domain-Logik (Bockrunden, {@code istBeendet()}) verwendet,
     * da {@code abgeschlosseneSpiele()} die persistierte Archiv-Liste zurueckgibt.</p>
     */
    public int anzahlAbgeschlossenerSpiele() {
        return abgeschlosseneSpieleIntern != null ? abgeschlosseneSpieleIntern.size() : 0;
    }

    public Optional<Spiel> aktuellesSpielOptional() {
        return Optional.ofNullable(aktuellesSpiel);
    }

    public Spiel aktuellesSpiel() {
        return Optional.ofNullable(aktuellesSpiel)
            .orElseThrow(() -> new IllegalStateException("Es gibt aktuell kein laufendes Spiel"));
    }

    public Map<SpielerPosition, Integer> gesamtpunktestand() {
        return gesamtpunktestand;
    }

    public int bockrundenZaehler() {
        return bockrundenZaehler;
    }

    public Long version() {
        return version != null ? version : 0L;
    }

    public Optional<SpielerPosition> solistDesLetztenSpiels() {
        return Optional.ofNullable(solistDesLetztenSpiels);
    }

    // ── Persistenz-Methoden (Entity-kompatibel) ─────────────────────────────

    /** Setzt die Spielregeln direkt (fuer Test-Setup ohne DB-Laden). */
    public void setzeSpielregeln(Spielregeln spielregeln) {
        this.spielregeln = Objects.requireNonNull(spielregeln, "spielregeln duerfen nicht null sein");
    }

    public void fuegeSpielHinzu(Spiel spiel) {
        Objects.requireNonNull(spiel, "spiel darf nicht null sein");
        spieleMap.put(spiel.spielNummer(), spiel);
        aktuellesSpielNummer = Math.max(aktuellesSpielNummer, spiel.spielNummer());
    }

    /** Fuegt ein Spielergebnis-Archiv zur Partie hinzu (wird beim Spielende aufgerufen). */
    public void fuegeArchivHinzu(SpielergebnisArchiv archiv) {
        Objects.requireNonNull(archiv, "archiv darf nicht null sein");
        archivierteSpieleMap.put(archiv.spielNummer(), archiv);
    }

    /** Ersetzt ein Spiel in der spieleMap (fuer Domain-Ergebnisuebernahme). */
    public void ersetzeSpiel(Spiel spiel) {
        Objects.requireNonNull(spiel, "spiel darf nicht null sein");
        spieleMap.put(spiel.spielNummer(), spiel);
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
        this.statusDb = PartieStatus.BEENDET.name();
        this.beendetAm = Instant.now();
    }

    public void markiereAlsAbgebrochen() {
        this.statusDb = PartieStatus.ABGEBROCHEN.name();
    }

    public int aktuellesSpielNummer() {
        return aktuellesSpielNummer;
    }

    public PartieStatus statusAusDb() {
        return PartieStatus.valueOf(statusDb);
    }

    public PartieStatus status() {
        return statusAusDb();
    }

    /** Gibt die Spiele aus der spieleMap sortiert zurueck und setzt die Spielnummer. */
    public List<Spiel> spiele() {
        return spieleMap.entrySet().stream()
            .sorted(Map.Entry.comparingByKey())
            .peek(eintrag -> eintrag.getValue().setzeSpielNummer(eintrag.getKey()))
            .map(Map.Entry::getValue)
            .toList();
    }

    public int bockrundenZaehlerAusDb() {
        return bockrundenZaehler;
    }

    public void setzeBockrundenZaehlerDb(int bockrundenZaehler) {
        if (bockrundenZaehler < 0) {
            throw new IllegalArgumentException("bockrundenZaehler darf nicht negativ sein");
        }
        this.bockrundenZaehler = bockrundenZaehler;
    }

    public SpielerPosition solistDesLetztenSpielsAusDb() {
        return solistDesLetztenSpielsDb != null ? SpielerPosition.valueOf(solistDesLetztenSpielsDb) : null;
    }

    public void setzeSolistDesLetztenSpielsDb(SpielerPosition position) {
        this.solistDesLetztenSpielsDb = position != null ? position.name() : null;
    }

    public Map<SpielerPosition, Integer> gesamtpunktestandAusDb() {
        EnumMap<SpielerPosition, Integer> map = new EnumMap<>(SpielerPosition.class);
        map.put(SpielerPosition.SUED, punkteSued);
        map.put(SpielerPosition.WEST, punkteWest);
        map.put(SpielerPosition.NORD, punkteNord);
        map.put(SpielerPosition.OST, punkteOst);
        return Map.copyOf(map);
    }

    public int anzahlSpieleAusDb() {
        return anzahlSpiele;
    }

    /** Rekonstruiert transiente Domain-Felder nach dem Laden aus der Datenbank. */
    public void initialisiereDomainFelderNachLaden() {
        this.solistDesLetztenSpiels = solistDesLetztenSpielsDb != null ? SpielerPosition.valueOf(solistDesLetztenSpielsDb) : null;

        EnumMap<SpielerPosition, Integer> gps = new EnumMap<>(SpielerPosition.class);
        gps.put(SpielerPosition.SUED, punkteSued);
        gps.put(SpielerPosition.WEST, punkteWest);
        gps.put(SpielerPosition.NORD, punkteNord);
        gps.put(SpielerPosition.OST, punkteOst);
        this.gesamtpunktestand = Map.copyOf(gps);

        List<Spiel> sortierteSpiele = spieleMap.entrySet().stream()
            .sorted(Map.Entry.comparingByKey())
            .peek(e -> e.getValue().setzeSpielNummer(e.getKey()))
            .map(Map.Entry::getValue)
            .toList();
        Spiel letztes = sortierteSpiele.isEmpty() ? null : sortierteSpiele.getLast();
        if (letztes != null && letztes.ergebnis().isEmpty()) {
            this.abgeschlosseneSpieleIntern = sortierteSpiele.subList(0, sortierteSpiele.size() - 1);
            this.aktuellesSpiel = letztes;
        } else {
            this.abgeschlosseneSpieleIntern = sortierteSpiele;
            this.aktuellesSpiel = null;
        }

        if (!abgeschlosseneSpieleIntern.isEmpty()) {
            Spiel letztesAbgeschlossenes = abgeschlosseneSpieleIntern.getLast();
            boolean warSolo = letztesAbgeschlossenes.hatParteien()
                && letztesAbgeschlossenes.parteien().spielerVon(Partei.RE).size() == 1;
            this.naechsterGeber = warSolo ? letztesAbgeschlossenes.geber() : letztesAbgeschlossenes.geber().naechsteImUhrzeigersinn();
        } else if (aktuellesSpiel != null) {
            this.naechsterGeber = aktuellesSpiel.geber();
        } else {
            this.naechsterGeber = SpielerPosition.SUED;
        }
    }
}
