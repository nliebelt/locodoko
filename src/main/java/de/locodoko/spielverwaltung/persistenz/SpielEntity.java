package de.locodoko.spielverwaltung.persistenz;

import de.locodoko.spiel.karten.SpielerPosition;
import de.locodoko.spiel.karten.Spieltyp;
import de.locodoko.spiel.partie.VorbehaltAnsage;
import de.locodoko.spiel.partie.Partei;
import de.locodoko.spiel.partie.Spielergebnis;
import de.locodoko.spiel.partie.Spielphase;
import de.locodoko.spiel.partie.Sonderpunkt;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Entity
@Table(name = "spiel")
public class SpielEntity extends AbstraktePersistenzEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "partie_id", nullable = false)
    private PartieEntity partie;

    @Min(1)
    @Column(nullable = false)
    private int spielNummer;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SpielerPosition geberPosition;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Spieltyp spieltyp;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Spielphase phase;

    @Valid
    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "spiel_vorbehalt", joinColumns = @JoinColumn(name = "spiel_id"))
    @OrderColumn(name = "vorbehalt_index")
    private List<VorbehaltMeldungEmbeddable> vorbehalte = new ArrayList<>();

    @Valid
    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "spiel_ansage", joinColumns = @JoinColumn(name = "spiel_id"))
    @OrderColumn(name = "ansage_index")
    private List<AnsageEreignisEmbeddable> ansagen = new ArrayList<>();

    @Valid
    @Embedded
    private SpielErgebnisEmbeddable ergebnis;

    @Enumerated(EnumType.STRING)
    @Column
    private SpielerPosition armutSpielerPosition;

    @Column(nullable = false)
    private int armutAktuellerAntwortIndex;

    @Column(nullable = false)
    private boolean armutAngebotAbgegeben;

    @Enumerated(EnumType.STRING)
    @Column
    private SpielerPosition armutPartnerSpielerPosition;

    @Valid
    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "spiel_armut_angebot", joinColumns = @JoinColumn(name = "spiel_id"))
    @OrderColumn(name = "angebot_index")
    private List<HandKarteEmbeddable> armutAngeboteneKarten = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    @Column
    private SpielerPosition hochzeitSpielerPosition;

    @Column(nullable = false)
    private int hochzeitGeklaerteStiche;

    @Enumerated(EnumType.STRING)
    @Column
    private SpielerPosition hochzeitPartnerSpielerPosition;

    @Column(nullable = false)
    private boolean hochzeitStillesSolo;

    @Valid
    @OneToMany(mappedBy = "spiel", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("spielerPosition ASC")
    private List<HandEntity> haende = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    @Column
    private SpielerPosition aktuellerStichAufspielerPosition;

    @Valid
    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "spiel_aktueller_stich_karte", joinColumns = @JoinColumn(name = "spiel_id"))
    @OrderColumn(name = "karte_index")
    private List<AktuellerStichKarteEmbeddable> aktuellerStichKarten = new ArrayList<>();

    @Valid
    @OneToMany(mappedBy = "spiel", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("stichNummer ASC")
    private List<StichEntity> stiche = new ArrayList<>();

    @Valid
    @OneToMany(mappedBy = "spiel", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("partei ASC, sonderpunkt ASC")
    private List<SpielSonderpunktEntity> sonderpunkte = new ArrayList<>();

    protected SpielEntity() {
    }

    private SpielEntity(int spielNummer, SpielerPosition geberPosition, Spieltyp spieltyp, Spielphase phase) {
        this.spielNummer = spielNummer;
        this.geberPosition = Objects.requireNonNull(geberPosition, "geberPosition darf nicht null sein");
        this.spieltyp = Objects.requireNonNull(spieltyp, "spieltyp darf nicht null sein");
        this.phase = Objects.requireNonNull(phase, "phase darf nicht null sein");
    }

    public static SpielEntity neu(int spielNummer, SpielerPosition geberPosition, Spieltyp spieltyp, Spielphase phase) {
        return new SpielEntity(spielNummer, geberPosition, spieltyp, phase);
    }

    void setzePartie(PartieEntity partie) {
        this.partie = partie;
    }

    public void fuegeHandHinzu(HandEntity hand) {
        Objects.requireNonNull(hand, "hand darf nicht null sein");
        haende.add(hand);
        hand.setzeSpiel(this);
    }

    public void ersetzeHaende(List<HandEntity> neueHaende) {
        Objects.requireNonNull(neueHaende, "neueHaende duerfen nicht null sein");
        haende.clear();
        neueHaende.forEach(this::fuegeHandHinzu);
    }

    public void fuegeStichHinzu(StichEntity stich) {
        Objects.requireNonNull(stich, "stich darf nicht null sein");
        stiche.add(stich);
        stich.setzeSpiel(this);
    }

    public void ersetzeStiche(List<StichEntity> neueStiche) {
        Objects.requireNonNull(neueStiche, "neueStiche duerfen nicht null sein");
        stiche.clear();
        neueStiche.forEach(this::fuegeStichHinzu);
    }

    public void uebernehmeErgebnis(Spielergebnis spielergebnis) {
        Objects.requireNonNull(spielergebnis, "spielergebnis darf nicht null sein");
        ergebnis = SpielErgebnisEmbeddable.aus(spielergebnis);
        sonderpunkte.clear();
        for (Map.Entry<Partei, List<Sonderpunkt>> eintrag : spielergebnis.sonderpunkteProPartei().entrySet()) {
            for (Sonderpunkt sonderpunkt : eintrag.getValue()) {
                SpielSonderpunktEntity spielSonderpunktEntity = SpielSonderpunktEntity.neu(eintrag.getKey(), sonderpunkt);
                spielSonderpunktEntity.setzeSpiel(this);
                sonderpunkte.add(spielSonderpunktEntity);
            }
        }
    }

    public void leereErgebnis() {
        ergebnis = null;
        sonderpunkte.clear();
    }

    public void setzeSpieltyp(Spieltyp spieltyp) {
        this.spieltyp = Objects.requireNonNull(spieltyp, "spieltyp darf nicht null sein");
    }

    public void setzePhase(Spielphase phase) {
        this.phase = Objects.requireNonNull(phase, "phase darf nicht null sein");
    }

    public void ersetzeVorbehalte(List<VorbehaltMeldungEmbeddable> neueVorbehalte) {
        Objects.requireNonNull(neueVorbehalte, "neueVorbehalte duerfen nicht null sein");
        this.vorbehalte = new ArrayList<>(neueVorbehalte);
    }

    public void ersetzeAnsagen(List<AnsageEreignisEmbeddable> neueAnsagen) {
        Objects.requireNonNull(neueAnsagen, "neueAnsagen duerfen nicht null sein");
        this.ansagen = new ArrayList<>(neueAnsagen);
    }

    public void setzeArmutStatus(
        SpielerPosition armutSpielerPosition,
        int armutAktuellerAntwortIndex,
        boolean armutAngebotAbgegeben,
        SpielerPosition armutPartnerSpielerPosition,
        List<HandKarteEmbeddable> armutAngeboteneKarten
    ) {
        this.armutSpielerPosition = armutSpielerPosition;
        this.armutAktuellerAntwortIndex = armutAktuellerAntwortIndex;
        this.armutAngebotAbgegeben = armutAngebotAbgegeben;
        this.armutPartnerSpielerPosition = armutPartnerSpielerPosition;
        this.armutAngeboteneKarten = new ArrayList<>(Objects.requireNonNull(armutAngeboteneKarten, "armutAngeboteneKarten duerfen nicht null sein"));
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
        this.hochzeitSpielerPosition = hochzeitSpielerPosition;
        this.hochzeitGeklaerteStiche = hochzeitGeklaerteStiche;
        this.hochzeitPartnerSpielerPosition = hochzeitPartnerSpielerPosition;
        this.hochzeitStillesSolo = hochzeitStillesSolo;
    }

    public void leereHochzeitStatus() {
        setzeHochzeitStatus(null, 0, null, false);
    }

    public void setzeAktuellenStich(
        SpielerPosition aufspielerPosition,
        List<AktuellerStichKarteEmbeddable> neueKarten
    ) {
        this.aktuellerStichAufspielerPosition = aufspielerPosition;
        this.aktuellerStichKarten = new ArrayList<>(Objects.requireNonNull(neueKarten, "neueKarten duerfen nicht null sein"));
    }

    public void leereAktuellenStich() {
        setzeAktuellenStich(null, List.of());
    }

    public PartieEntity partie() {
        return partie;
    }

    public int spielNummer() {
        return spielNummer;
    }

    public SpielerPosition geberPosition() {
        return geberPosition;
    }

    public Spieltyp spieltyp() {
        return spieltyp;
    }

    public Spielphase phase() {
        return phase;
    }

    public List<VorbehaltMeldungEmbeddable> vorbehalte() {
        return List.copyOf(vorbehalte);
    }

    public List<AnsageEreignisEmbeddable> ansagen() {
        return List.copyOf(ansagen);
    }

    public SpielErgebnisEmbeddable ergebnis() {
        return ergebnis;
    }

    public SpielerPosition armutSpielerPosition() {
        return armutSpielerPosition;
    }

    public int armutAktuellerAntwortIndex() {
        return armutAktuellerAntwortIndex;
    }

    public boolean armutAngebotAbgegeben() {
        return armutAngebotAbgegeben;
    }

    public SpielerPosition armutPartnerSpielerPosition() {
        return armutPartnerSpielerPosition;
    }

    public List<HandKarteEmbeddable> armutAngeboteneKarten() {
        return List.copyOf(armutAngeboteneKarten);
    }

    public SpielerPosition hochzeitSpielerPosition() {
        return hochzeitSpielerPosition;
    }

    public int hochzeitGeklaerteStiche() {
        return hochzeitGeklaerteStiche;
    }

    public SpielerPosition hochzeitPartnerSpielerPosition() {
        return hochzeitPartnerSpielerPosition;
    }

    public boolean hochzeitStillesSolo() {
        return hochzeitStillesSolo;
    }

    public List<HandEntity> haende() {
        return List.copyOf(haende);
    }

    public SpielerPosition aktuellerStichAufspielerPosition() {
        return aktuellerStichAufspielerPosition;
    }

    public List<AktuellerStichKarteEmbeddable> aktuellerStichKarten() {
        return List.copyOf(aktuellerStichKarten);
    }

    public List<StichEntity> stiche() {
        return List.copyOf(stiche);
    }

    public List<SpielSonderpunktEntity> sonderpunkte() {
        return List.copyOf(sonderpunkte);
    }
}
