package de.locodoko.tisch;

import de.locodoko.partie.AbstraktePersistenzEntity;
import de.locodoko.partie.PartieEntity;
import de.locodoko.session.SpielerEntity;

import de.locodoko.tisch.Tischhintergrund;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.data.annotation.Transient;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Embedded;
import org.springframework.data.relational.core.mapping.MappedCollection;
import org.springframework.data.relational.core.mapping.Table;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * Persistenz-Entity fuer einen Spieltisch.
 * Standalone Aggregate Root.
 * Referenziert SpielerEntity via Join-Tabelle (TischSpielerRelation).
 * Referenziert PartieEntity via UUID (partieId).
 * Konfiguration wird direkt als Spalten eingebettet.
 */
@Table("tisch")
public class TischEntity extends AbstraktePersistenzEntity {

    @NotBlank
    @Column("name")
    private String name;

    @Column("status")
    private String status;

    /** Konfiguration direkt als Spalten eingebettet. Bean-Validierung kaskadiert via @Valid. */
    @Valid
    @Embedded.Nullable
    private TischkonfigurationEmbeddable konfiguration;

    /** Fremdschluessel auf den erstellenden Spieler. */
    @Column("erstellt_von_spieler_id")
    private UUID erstelltVonSpielerId;

    /** Fremdschluessel auf die Partie (nullable, solange kein Spiel laeuft). */
    @Column("partie_id")
    private UUID partieId;

    /** Join-Tabellen-Eintraege fuer die Spieler am Tisch. */
    @MappedCollection(idColumn = "tisch_id", keyColumn = "tisch_spieler_key")
    private List<TischSpielerRelation> spielerRelationen = new ArrayList<>();

    /** Transiente Rueckreferenz: erstellender Spieler (wird in-memory gesetzt). */
    @Transient
    private SpielerEntity erstelltVon;

    /** Transiente Liste der Spieler-Objekte (wird nach dem Laden befuellt). */
    @Transient
    private List<SpielerEntity> spieler = new ArrayList<>();

    /** Transiente Partie-Referenz (wird in-memory gesetzt). */
    @Transient
    private PartieEntity partie;

    protected TischEntity() {
    }

    private TischEntity(String name, SpielerEntity erstelltVon, TischkonfigurationEmbeddable konfiguration) {
        this.name = Objects.requireNonNull(name, "name darf nicht null sein");
        this.erstelltVon = Objects.requireNonNull(erstelltVon, "erstelltVon darf nicht null sein");
        this.erstelltVonSpielerId = erstelltVon.id();
        this.konfiguration = Objects.requireNonNull(konfiguration, "konfiguration darf nicht null sein");
        this.status = TischStatus.WARTEND.name();
    }

    public static TischEntity neu(String name, SpielerEntity erstelltVon, TischkonfigurationEmbeddable konfiguration) {
        return new TischEntity(name, erstelltVon, konfiguration);
    }

    public void fuegeSpielerHinzu(SpielerEntity spielerEntity) {
        Objects.requireNonNull(spielerEntity, "spieler darf nicht null sein");
        if (spieler.size() >= 4) {
            throw new IllegalStateException("Ein Tisch darf hoechstens vier Spieler enthalten");
        }
        if (enthaeltSpieler(spielerEntity)) {
            return;
        }
        spieler.add(spielerEntity);
        spielerRelationen.add(new TischSpielerRelation(spielerEntity.id()));
    }

    public void entferneSpieler(SpielerEntity spielerEntity) {
        Objects.requireNonNull(spielerEntity, "spieler darf nicht null sein");
        spieler.removeIf(vorhandenerSpieler -> gleicherSpieler(vorhandenerSpieler, spielerEntity));
        spielerRelationen.removeIf(relation -> Objects.equals(relation.spielerId(), spielerEntity.id()));
    }

    public boolean enthaeltSpieler(SpielerEntity spielerEntity) {
        Objects.requireNonNull(spielerEntity, "spieler darf nicht null sein");
        return spieler.stream().anyMatch(vorhandenerSpieler -> gleicherSpieler(vorhandenerSpieler, spielerEntity));
    }

    public boolean istVoll() {
        return spieler.size() >= 4;
    }

    public void aktualisiereKonfiguration(TischkonfigurationEmbeddable konfiguration) {
        this.konfiguration = Objects.requireNonNull(konfiguration, "konfiguration darf nicht null sein");
    }

    public void setzeErstelltVon(SpielerEntity erstelltVon) {
        this.erstelltVon = Objects.requireNonNull(erstelltVon, "erstelltVon darf nicht null sein");
        this.erstelltVonSpielerId = erstelltVon.id();
    }

    public void setzePartie(PartieEntity partie) {
        this.partie = Objects.requireNonNull(partie, "partie darf nicht null sein");
        this.partieId = partie.id();
        partie.setzeTisch(this);
        this.status = TischStatus.IM_SPIEL.name();
    }

    /**
     * Setzt die transiente Partie-Referenz ohne den Status zu aendern
     * (wird beim Laden aus der Datenbank verwendet).
     */
    void setzePartieTransient(PartieEntity partie) {
        this.partie = partie;
        if (partie != null) {
            this.partieId = partie.id();
            partie.setzeTisch(this);
        }
    }

    /**
     * Befuellt die transiente Spielerliste aus den geladenen Spieler-Objekten.
     * Wird nach dem Laden aus der Datenbank aufgerufen.
     */
    void setzeSpielerListe(List<SpielerEntity> spielerListe) {
        this.spieler = new ArrayList<>(spielerListe);
    }

    /**
     * Befuellt die transiente erstelltVon-Referenz.
     * Wird nach dem Laden aus der Datenbank aufgerufen.
     */
    void setzeErstelltVonTransient(SpielerEntity erstelltVon) {
        this.erstelltVon = erstelltVon;
    }

    public UUID erstelltVonSpielerId() {
        return erstelltVonSpielerId;
    }

    public UUID partieId() {
        return partieId;
    }

    public List<TischSpielerRelation> spielerRelationen() {
        return List.copyOf(spielerRelationen);
    }

    public String name() {
        return name;
    }

    public TischStatus status() {
        return TischStatus.valueOf(status);
    }

    public TischkonfigurationEmbeddable konfiguration() {
        return konfiguration;
    }

    public SpielerEntity erstelltVon() {
        return erstelltVon;
    }

    public List<SpielerEntity> spieler() {
        return List.copyOf(spieler);
    }

    public PartieEntity partie() {
        return partie;
    }

    private boolean gleicherSpieler(SpielerEntity links, SpielerEntity rechts) {
        if (links.id() != null && rechts.id() != null) {
            return links.id().equals(rechts.id());
        }
        if (links.sessionId() != null && rechts.sessionId() != null) {
            return links.sessionId().equals(rechts.sessionId());
        }
        return links == rechts;
    }
}
