package de.locodoko.partie;

import de.locodoko.karten.Spieltyp;

import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.ReadOnlyProperty;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.MappedCollection;
import org.springframework.data.relational.core.mapping.Table;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * Persistiertes Archiv eines abgeschlossenen Doppelkopf-Spiels.
 *
 * <p>Statistik-queryable Aggregate Root. Wird nach jedem Spielende aus dem
 * {@link Spielergebnis} erzeugt und als Kind von {@link Partie} via
 * {@code @MappedCollection} persistiert.</p>
 *
 * <p>Im Gegensatz zu {@link Spiel}, das den laufenden Spielstand haelt,
 * kapselt dieses Archiv die unveraenderlichen Enddaten eines Spiels
 * (Augen, Spielwert, Sonderpunkte) fuer Statistik und Verlaufsanzeigen.</p>
 */
@Table("spielergebnis_archiv")
public class SpielergebnisArchiv {

    @Id
    @Column("id")
    private UUID id;

    @Column("partie_id")
    private UUID partieId;

    @ReadOnlyProperty
    @Column("spiel_nummer")
    private int spielNummer;

    @Column("geber_position")
    private SpielerPosition geberPosition;

    @Column("spieltyp")
    private Spieltyp spieltyp;

    @Column("ist_solo")
    private boolean istSolo;

    @Column("solo_typ")
    private Spieltyp soloTyp;

    @Column("re_augen")
    private int reAugen;

    @Column("kontra_augen")
    private int kontraAugen;

    @Column("sieger_partei")
    private Partei siegerPartei;

    @Column("spielwert")
    private int spielwert;

    @Column("grundwert")
    private int grundwert;

    @Column("absage_punkte")
    private int absagePunkte;

    @Column("gegen_die_alten_punkte")
    private int gegenDieAltenPunkte;

    @Column("solo_multiplikator")
    private int soloMultiplikator;

    @Column("spielpunkte_sued")
    private int spielpunkteSued;

    @Column("spielpunkte_west")
    private int spielpunkteWest;

    @Column("spielpunkte_nord")
    private int spielpunkteNord;

    @Column("spielpunkte_ost")
    private int spielpunkteOst;

    @Column("abgeschlossen_am")
    private Instant abgeschlossenAm;

    @MappedCollection(idColumn = "spielergebnis_archiv_id")
    private Set<SonderpunktEintrag> sonderpunkte = new HashSet<>();

    /** Fuer Spring Data JDBC (Reflektion). */
    protected SpielergebnisArchiv() {}

    private SpielergebnisArchiv(
        UUID id, UUID partieId, int spielNummer,
        SpielerPosition geberPosition, Spieltyp spieltyp,
        boolean istSolo, Spieltyp soloTyp,
        int reAugen, int kontraAugen, Partei siegerPartei,
        int spielwert, int grundwert, int absagePunkte,
        int gegenDieAltenPunkte, int soloMultiplikator,
        int spielpunkteSued, int spielpunkteWest,
        int spielpunkteNord, int spielpunkteOst,
        Set<SonderpunktEintrag> sonderpunkte
    ) {
        this.id = Objects.requireNonNull(id, "id darf nicht null sein");
        this.partieId = Objects.requireNonNull(partieId, "partieId darf nicht null sein");
        this.spielNummer = spielNummer;
        this.geberPosition = Objects.requireNonNull(geberPosition, "geberPosition darf nicht null sein");
        this.spieltyp = Objects.requireNonNull(spieltyp, "spieltyp darf nicht null sein");
        this.istSolo = istSolo;
        this.soloTyp = soloTyp;
        this.reAugen = reAugen;
        this.kontraAugen = kontraAugen;
        this.siegerPartei = Objects.requireNonNull(siegerPartei, "siegerPartei darf nicht null sein");
        this.spielwert = spielwert;
        this.grundwert = grundwert;
        this.absagePunkte = absagePunkte;
        this.gegenDieAltenPunkte = gegenDieAltenPunkte;
        this.soloMultiplikator = soloMultiplikator;
        this.spielpunkteSued = spielpunkteSued;
        this.spielpunkteWest = spielpunkteWest;
        this.spielpunkteNord = spielpunkteNord;
        this.spielpunkteOst = spielpunkteOst;
        this.sonderpunkte = new HashSet<>(sonderpunkte);
        this.abgeschlossenAm = Instant.now();
    }

    /**
     * Erzeugt ein Archiv-Aggregate aus einem abgeschlossenen Spielergebnis.
     *
     * <p>Alle sonderpunkte werden aus der partei-bezogenen Map des Spielergebnisses
     * in einzelne {@link SonderpunktEintrag}-Zeilen ueberfuehrt.</p>
     *
     * @param ergebnis      das Spielergebnis (Augen, Spielwert, Sonderpunkte)
     * @param partieId      UUID der uebergeordneten Partie
     * @param spielNummer   Nummer dieses Spiels innerhalb der Partie
     * @param geberPosition Position des Gebers
     * @param spieltyp      Spieltyp (Normal, Solo-Variante, etc.)
     */
    public static SpielergebnisArchiv aus(
        Spielergebnis ergebnis,
        UUID partieId,
        int spielNummer,
        SpielerPosition geberPosition,
        Spieltyp spieltyp
    ) {
        Objects.requireNonNull(ergebnis, "ergebnis darf nicht null sein");
        Objects.requireNonNull(partieId, "partieId darf nicht null sein");
        Objects.requireNonNull(geberPosition, "geberPosition darf nicht null sein");
        Objects.requireNonNull(spieltyp, "spieltyp darf nicht null sein");

        boolean istSolo = spieltyp.name().startsWith("SOLO");
        Spieltyp soloTyp = istSolo ? spieltyp : null;

        Set<SonderpunktEintrag> eintraege = new HashSet<>();
        for (Map.Entry<Partei, List<SonderpunktEreignis>> eintrag : ergebnis.sonderpunkteProPartei().entrySet()) {
            for (SonderpunktEreignis ereignis : eintrag.getValue()) {
                eintraege.add(SonderpunktEintrag.aus(eintrag.getKey(), ereignis));
            }
        }

        return new SpielergebnisArchiv(
            UUID.randomUUID(), partieId, spielNummer,
            geberPosition, spieltyp,
            istSolo, soloTyp,
            ergebnis.augenVon(Partei.RE).wert(),
            ergebnis.augenVon(Partei.KONTRA).wert(),
            ergebnis.siegerPartei(),
            ergebnis.spielwert().wert(),
            ergebnis.grundwert(),
            ergebnis.absagePunkte(),
            ergebnis.gegenDieAltenPunkte(),
            ergebnis.soloMultiplikator(),
            ergebnis.spielpunkteVon(SpielerPosition.SUED).wert(),
            ergebnis.spielpunkteVon(SpielerPosition.WEST).wert(),
            ergebnis.spielpunkteVon(SpielerPosition.NORD).wert(),
            ergebnis.spielpunkteVon(SpielerPosition.OST).wert(),
            eintraege
        );
    }

    // ── Getter ──────────────────────────────────────────────────────────────

    public UUID id() { return id; }
    public UUID partieId() { return partieId; }
    public int spielNummer() { return spielNummer; }
    public SpielerPosition geberPosition() { return geberPosition; }
    public Spieltyp spieltyp() { return spieltyp; }
    public boolean istSolo() { return istSolo; }
    public Spieltyp soloTyp() { return soloTyp; }
    public int reAugen() { return reAugen; }
    public int kontraAugen() { return kontraAugen; }
    public Partei siegerPartei() { return siegerPartei; }
    public int spielwert() { return spielwert; }
    public int grundwert() { return grundwert; }
    public int absagePunkte() { return absagePunkte; }
    public int gegenDieAltenPunkte() { return gegenDieAltenPunkte; }
    public int soloMultiplikator() { return soloMultiplikator; }
    public int spielpunkteSued() { return spielpunkteSued; }
    public int spielpunkteWest() { return spielpunkteWest; }
    public int spielpunkteNord() { return spielpunkteNord; }
    public int spielpunkteOst() { return spielpunkteOst; }
    public Instant abgeschlossenAm() { return abgeschlossenAm; }
    public List<SonderpunktEintrag> sonderpunkte() { return List.copyOf(sonderpunkte); }

    /** Spielpunkte des Spielers an der gegebenen Position. */
    public int spielpunkteVon(SpielerPosition position) {
        return switch (position) {
            case SUED -> spielpunkteSued;
            case WEST -> spielpunkteWest;
            case NORD -> spielpunkteNord;
            case OST -> spielpunkteOst;
        };
    }
}
