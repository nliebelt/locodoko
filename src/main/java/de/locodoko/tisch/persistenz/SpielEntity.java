package de.locodoko.tisch.persistenz;

import de.locodoko.system.AbstraktePersistenzEntity;
import de.locodoko.partie.JsonKonverter;
import de.locodoko.partie.AktuellerStichKarteEmbeddable;
import de.locodoko.partie.Ansage;
import de.locodoko.partie.AnsageEreignisEmbeddable;
import de.locodoko.partie.HandJsonEintrag;
import de.locodoko.partie.HandKarteEmbeddable;
import de.locodoko.partie.SpielErgebnisEmbeddable;
import de.locodoko.partie.SpielerPosition;
import de.locodoko.partie.StichJsonEintrag;
import de.locodoko.partie.VorbehaltMeldungEmbeddable;

import com.fasterxml.jackson.core.type.TypeReference;
import de.locodoko.karten.Spieltyp;
import de.locodoko.partie.Partei;
import de.locodoko.partie.Spielergebnis;
import de.locodoko.partie.Spielphase;
import de.locodoko.partie.SonderpunktEreignis;
import org.springframework.data.annotation.Transient;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.MappedCollection;
import org.springframework.data.relational.core.mapping.Table;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Persistenz-Entity fuer ein einzelnes Doppelkopfspiel.
 * Owned by PartieEntity via @MappedCollection.
 * Haende und Stiche werden als JSON-Blobs in den Spalten 'haende_json' und 'stiche_json' gespeichert.
 * SpielSonderpunktEntity bleibt als @MappedCollection erhalten.
 * Komplexe Listen (vorbehalte, ansagen, etc.) werden als JSON-Text gespeichert.
 */
@Table("spiel")
public class SpielEntity extends AbstraktePersistenzEntity {

    /**
     * Spielnummer (transient).
     * Wird vom @MappedCollection keyColumn in PartieEntity verwaltet.
     * Wird nach dem Laden durch PartieEntity.spiele() aus dem Map-Key gesetzt.
     */
    @Transient
    private int spielNummer;

    @Column("geber_position")
    private String geberPosition;

    @Column("spieltyp")
    private String spieltyp;

    @Column("phase")
    private String phase;

    /** Vorbehalt-Meldungen als JSON-Array. */
    @Column("vorbehalte")
    private String vorbehalteJson;

    /** Ansage-Ereignisse als JSON-Array. */
    @Column("ansagen")
    private String ansagenJson;

    /** Armut-Status */
    @Column("armut_spieler_position")
    private String armutSpielerPosition;

    @Column("armut_aktueller_antwort_index")
    private int armutAktuellerAntwortIndex;

    @Column("armut_angebot_abgegeben")
    private boolean armutAngebotAbgegeben;

    @Column("armut_partner_spieler_position")
    private String armutPartnerSpielerPosition;

    /** Angebotene Armut-Karten als JSON-Array. */
    @Column("armut_angebotene_karten")
    private String armutAngeboteneKartenJson;

    /** Hochzeit-Status */
    @Column("hochzeit_spieler_position")
    private String hochzeitSpielerPosition;

    @Column("hochzeit_geklaerte_stiche")
    private int hochzeitGeklaerteStiche;

    @Column("hochzeit_partner_spieler_position")
    private String hochzeitPartnerSpielerPosition;

    @Column("hochzeit_stilles_solo")
    private boolean hochzeitStillesSolo;

    /** Parteien mit ausstehender Pflichtansage als JSON-Array (z.B. ["RE"] oder []). */
    @Column("pflicht_ansage_ausstehend")
    private String pflichtAnsageAusstehendJson = "[]";

    /** Ob die Schweinchen-Regel fuer dieses Spiel aktiv ist (ein Spieler haelt beide Karo-Asse). */
    @Column("schweinchen_aktiv")
    private boolean schweinchenAktiv;

    /** Aktueller Stich */
    @Column("aktueller_stich_aufspieler_position")
    private String aktuellerStichAufspielerPosition;

    /** Karten des aktuellen Stichs als JSON-Array. */
    @Column("aktueller_stich_karten")
    private String aktuellerStichKartenJson;

    /** Spielergebnis (eingebettet als Spalten, nullable). */
    @Column("re_augen")
    private Integer reAugen;

    @Column("kontra_augen")
    private Integer kontraAugen;

    @Column("sieger_partei")
    private String siegerPartei;

    @Column("spielwert")
    private Integer spielwert;

    @Column("spielpunkte_sued")
    private Integer spielpunkteSued;

    @Column("spielpunkte_west")
    private Integer spielpunkteWest;

    @Column("spielpunkte_nord")
    private Integer spielpunkteNord;

    @Column("spielpunkte_ost")
    private Integer spielpunkteOst;

    /** Haende aller Spieler als JSON-Array von HandJsonEintrag. */
    @Column("haende_json")
    private String haendeJson;

    /** Abgeschlossene Stiche als JSON-Array von StichJsonEintrag. */
    @Column("stiche_json")
    private String sticheJson;

    /**
     * Sonderpunkte: Owned by diesem Spiel.
     * spiel_key ist der 0-basierte Listenindex, den Spring Data JDBC verwaltet.
     */
    @MappedCollection(idColumn = "spiel_id", keyColumn = "spiel_key")
    private List<SpielSonderpunktEntity> sonderpunkte = new ArrayList<>();

    /** Rueckreferenz auf die Partie (transient, wird in-memory gesetzt). */
    @Transient
    private PartieEntity partie;

    protected SpielEntity() {
    }

    private SpielEntity(int spielNummer, SpielerPosition geberPosition, Spieltyp spieltyp, Spielphase phase) {
        this.spielNummer = spielNummer;
        this.geberPosition = Objects.requireNonNull(geberPosition, "geberPosition darf nicht null sein").name();
        this.spieltyp = Objects.requireNonNull(spieltyp, "spieltyp darf nicht null sein").name();
        this.phase = Objects.requireNonNull(phase, "phase darf nicht null sein").name();
    }

    public static SpielEntity neu(int spielNummer, SpielerPosition geberPosition, Spieltyp spieltyp, Spielphase phase) {
        return new SpielEntity(spielNummer, geberPosition, spieltyp, phase);
    }

    public void setzePartie(PartieEntity partie) {
        this.partie = partie;
    }

    /** Setzt die Spielnummer (wird nach dem Laden aus dem Map-Key gesetzt). */
    void setzeSpielNummer(int spielNummer) {
        this.spielNummer = spielNummer;
    }

    public void fuegeHandHinzu(HandJsonEintrag hand) {
        Objects.requireNonNull(hand, "hand darf nicht null sein");
        List<HandJsonEintrag> aktuelleHaende = new ArrayList<>(haende());
        aktuelleHaende.removeIf(h -> h.spielerPosition() == hand.spielerPosition());
        aktuelleHaende.add(hand);
        this.haendeJson = JsonKonverter.schreibeAlsJson(aktuelleHaende);
    }

    public void ersetzeHaende(List<HandJsonEintrag> neueHaende) {
        Objects.requireNonNull(neueHaende, "neueHaende duerfen nicht null sein");
        this.haendeJson = JsonKonverter.schreibeAlsJson(neueHaende);
    }

    public void fuegeStichHinzu(StichJsonEintrag stich) {
        Objects.requireNonNull(stich, "stich darf nicht null sein");
        List<StichJsonEintrag> aktuelleStiche = new ArrayList<>(stiche());
        aktuelleStiche.add(stich);
        this.sticheJson = JsonKonverter.schreibeAlsJson(aktuelleStiche);
    }

    public void ersetzeStiche(List<StichJsonEintrag> neueStiche) {
        Objects.requireNonNull(neueStiche, "neueStiche duerfen nicht null sein");
        this.sticheJson = JsonKonverter.schreibeAlsJson(neueStiche);
    }

    public void uebernehmeErgebnis(Spielergebnis spielergebnis) {
        Objects.requireNonNull(spielergebnis, "spielergebnis darf nicht null sein");
        SpielErgebnisEmbeddable ergebnis = SpielErgebnisEmbeddable.aus(spielergebnis);
        this.reAugen = ergebnis.reAugen();
        this.kontraAugen = ergebnis.kontraAugen();
        this.siegerPartei = ergebnis.siegerPartei() != null ? ergebnis.siegerPartei().name() : null;
        this.spielwert = ergebnis.spielwert();
        this.spielpunkteSued = ergebnis.spielpunkteSued();
        this.spielpunkteWest = ergebnis.spielpunkteWest();
        this.spielpunkteNord = ergebnis.spielpunkteNord();
        this.spielpunkteOst = ergebnis.spielpunkteOst();
        sonderpunkte.clear();
        for (Map.Entry<Partei, List<SonderpunktEreignis>> eintrag : spielergebnis.sonderpunkteProPartei().entrySet()) {
            for (SonderpunktEreignis ereignis : eintrag.getValue()) {
                SpielSonderpunktEntity sonderpunktEntity = SpielSonderpunktEntity.neu(eintrag.getKey(), ereignis);
                sonderpunktEntity.setzeSpiel(this);
                sonderpunkte.add(sonderpunktEntity);
            }
        }
    }

    public void leereErgebnis() {
        this.reAugen = null;
        this.kontraAugen = null;
        this.siegerPartei = null;
        this.spielwert = null;
        this.spielpunkteSued = null;
        this.spielpunkteWest = null;
        this.spielpunkteNord = null;
        this.spielpunkteOst = null;
        sonderpunkte.clear();
    }

    public void setzeSpieltyp(Spieltyp spieltyp) {
        this.spieltyp = Objects.requireNonNull(spieltyp, "spieltyp darf nicht null sein").name();
    }

    public void setzePhase(Spielphase phase) {
        this.phase = Objects.requireNonNull(phase, "phase darf nicht null sein").name();
    }

    public void ersetzeVorbehalte(List<VorbehaltMeldungEmbeddable> neueVorbehalte) {
        Objects.requireNonNull(neueVorbehalte, "neueVorbehalte duerfen nicht null sein");
        this.vorbehalteJson = JsonKonverter.schreibeAlsJson(neueVorbehalte);
    }

    public void ersetzeAnsagen(List<AnsageEreignisEmbeddable> neueAnsagen) {
        Objects.requireNonNull(neueAnsagen, "neueAnsagen duerfen nicht null sein");
        this.ansagenJson = JsonKonverter.schreibeAlsJson(neueAnsagen);
    }

    public void setzeArmutStatus(
        SpielerPosition armutSpielerPosition,
        int armutAktuellerAntwortIndex,
        boolean armutAngebotAbgegeben,
        SpielerPosition armutPartnerSpielerPosition,
        List<HandKarteEmbeddable> armutAngeboteneKarten
    ) {
        this.armutSpielerPosition = armutSpielerPosition != null ? armutSpielerPosition.name() : null;
        this.armutAktuellerAntwortIndex = armutAktuellerAntwortIndex;
        this.armutAngebotAbgegeben = armutAngebotAbgegeben;
        this.armutPartnerSpielerPosition = armutPartnerSpielerPosition != null ? armutPartnerSpielerPosition.name() : null;
        this.armutAngeboteneKartenJson = JsonKonverter.schreibeAlsJson(
            Objects.requireNonNull(armutAngeboteneKarten, "armutAngeboteneKarten duerfen nicht null sein")
        );
    }

    public void leereArmutStatus() {
        setzeArmutStatus(null, 0, false, null, List.of());
    }

    public void setzeHochzeitStatus(
        SpielerPosition hochzeitSpielerPosition,
        int hochzeitGeklaerteStiche,
        SpielerPosition hochzeitPartnerSpielerPosition,
        boolean hochzeitStillesSolo
    ) {
        this.hochzeitSpielerPosition = hochzeitSpielerPosition != null ? hochzeitSpielerPosition.name() : null;
        this.hochzeitGeklaerteStiche = hochzeitGeklaerteStiche;
        this.hochzeitPartnerSpielerPosition = hochzeitPartnerSpielerPosition != null ? hochzeitPartnerSpielerPosition.name() : null;
        this.hochzeitStillesSolo = hochzeitStillesSolo;
    }

    public void leereHochzeitStatus() {
        setzeHochzeitStatus(null, 0, null, false);
    }

    public void setzeAktuellenStich(
        SpielerPosition aufspielerPosition,
        List<AktuellerStichKarteEmbeddable> neueKarten
    ) {
        this.aktuellerStichAufspielerPosition = aufspielerPosition != null ? aufspielerPosition.name() : null;
        this.aktuellerStichKartenJson = JsonKonverter.schreibeAlsJson(
            Objects.requireNonNull(neueKarten, "neueKarten duerfen nicht null sein")
        );
    }

    public void leereAktuellenStich() {
        setzeAktuellenStich(null, List.of());
    }

    public boolean schweinchenAktiv() {
        return schweinchenAktiv;
    }

    public void setzeSchweinchenAktiv(boolean schweinchenAktiv) {
        this.schweinchenAktiv = schweinchenAktiv;
    }

    public void setzePflichtansageAusstehend(java.util.Set<Partei> parteien) {
        Objects.requireNonNull(parteien, "parteien duerfen nicht null sein");
        List<String> namen = parteien.stream().map(Enum::name).toList();
        this.pflichtAnsageAusstehendJson = JsonKonverter.schreibeAlsJson(namen);
    }

    public List<String> pflichtansageAusstehend() {
        return JsonKonverter.liesList(pflichtAnsageAusstehendJson, new TypeReference<List<String>>() {});
    }

    /** Gibt das Ergebnis als SpielErgebnisEmbeddable zurueck, oder null wenn kein Ergebnis vorhanden. */
    public SpielErgebnisEmbeddable ergebnis() {
        if (reAugen == null && kontraAugen == null && siegerPartei == null) {
            return null;
        }
        SpielErgebnisEmbeddable ergebnis = new SpielErgebnisEmbeddable();
        ergebnis.setReAugen(reAugen);
        ergebnis.setKontraAugen(kontraAugen);
        ergebnis.setSiegerPartei(siegerPartei);
        ergebnis.setSpielwert(spielwert);
        ergebnis.setSpielpunkteSued(spielpunkteSued);
        ergebnis.setSpielpunkteWest(spielpunkteWest);
        ergebnis.setSpielpunkteNord(spielpunkteNord);
        ergebnis.setSpielpunkteOst(spielpunkteOst);
        return ergebnis;
    }

    public PartieEntity partie() {
        return partie;
    }

    public int spielNummer() {
        return spielNummer;
    }

    public SpielerPosition geberPosition() {
        return SpielerPosition.valueOf(geberPosition);
    }

    public Spieltyp spieltyp() {
        return Spieltyp.valueOf(spieltyp);
    }

    /** Gibt den Phasennamen als String zurueck (z.B. "STICHPHASE"). */
    public String phasenName() {
        return phase;
    }

    public List<VorbehaltMeldungEmbeddable> vorbehalte() {
        return JsonKonverter.liesList(vorbehalteJson, new TypeReference<List<VorbehaltMeldungEmbeddable>>() {});
    }

    public List<AnsageEreignisEmbeddable> ansagen() {
        return JsonKonverter.liesList(ansagenJson, new TypeReference<List<AnsageEreignisEmbeddable>>() {});
    }

    public SpielerPosition armutSpielerPosition() {
        return armutSpielerPosition != null ? SpielerPosition.valueOf(armutSpielerPosition) : null;
    }

    public int armutAktuellerAntwortIndex() {
        return armutAktuellerAntwortIndex;
    }

    public boolean armutAngebotAbgegeben() {
        return armutAngebotAbgegeben;
    }

    public SpielerPosition armutPartnerSpielerPosition() {
        return armutPartnerSpielerPosition != null ? SpielerPosition.valueOf(armutPartnerSpielerPosition) : null;
    }

    public List<HandKarteEmbeddable> armutAngeboteneKarten() {
        return JsonKonverter.liesList(armutAngeboteneKartenJson, new TypeReference<List<HandKarteEmbeddable>>() {});
    }

    public SpielerPosition hochzeitSpielerPosition() {
        return hochzeitSpielerPosition != null ? SpielerPosition.valueOf(hochzeitSpielerPosition) : null;
    }

    public int hochzeitGeklaerteStiche() {
        return hochzeitGeklaerteStiche;
    }

    public SpielerPosition hochzeitPartnerSpielerPosition() {
        return hochzeitPartnerSpielerPosition != null ? SpielerPosition.valueOf(hochzeitPartnerSpielerPosition) : null;
    }

    public boolean hochzeitStillesSolo() {
        return hochzeitStillesSolo;
    }

    public List<HandJsonEintrag> haende() {
        return JsonKonverter.liesList(haendeJson, new TypeReference<List<HandJsonEintrag>>() {});
    }

    public SpielerPosition aktuellerStichAufspielerPosition() {
        return aktuellerStichAufspielerPosition != null ? SpielerPosition.valueOf(aktuellerStichAufspielerPosition) : null;
    }

    public List<AktuellerStichKarteEmbeddable> aktuellerStichKarten() {
        return JsonKonverter.liesList(aktuellerStichKartenJson, new TypeReference<List<AktuellerStichKarteEmbeddable>>() {});
    }

    public List<StichJsonEintrag> stiche() {
        return JsonKonverter.liesList(sticheJson, new TypeReference<List<StichJsonEintrag>>() {});
    }

    public List<SpielSonderpunktEntity> sonderpunkte() {
        sonderpunkte.forEach(sp -> sp.setzeSpiel(this));
        return List.copyOf(sonderpunkte);
    }
}
