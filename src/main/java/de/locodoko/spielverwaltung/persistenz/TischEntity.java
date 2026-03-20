package de.locodoko.spielverwaltung.persistenz;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Entity
@Table(name = "tisch")
public class TischEntity extends AbstraktePersistenzEntity {

    @NotBlank
    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TischStatus status;

    @Valid
    @Embedded
    private TischkonfigurationEmbeddable konfiguration;

    @Valid
    @ManyToOne(fetch = FetchType.LAZY, cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    @JoinColumn(name = "erstellt_von_spieler_id", nullable = false)
    private SpielerEntity erstelltVon;

    @Valid
    @Size(max = 4)
    @OneToMany(cascade = {CascadeType.PERSIST, CascadeType.MERGE}, fetch = FetchType.LAZY)
    @JoinTable(
        name = "tisch_spieler",
        joinColumns = @JoinColumn(name = "tisch_id"),
        inverseJoinColumns = @JoinColumn(name = "spieler_id", unique = true)
    )
    @OrderColumn(name = "sitz_reihenfolge")
    private List<SpielerEntity> spieler = new ArrayList<>();

    @Valid
    @OneToOne(cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @JoinColumn(name = "partie_id")
    private PartieEntity partie;

    protected TischEntity() {
    }

    private TischEntity(String name, SpielerEntity erstelltVon, TischkonfigurationEmbeddable konfiguration) {
        this.name = Objects.requireNonNull(name, "name darf nicht null sein");
        this.erstelltVon = Objects.requireNonNull(erstelltVon, "erstelltVon darf nicht null sein");
        this.konfiguration = Objects.requireNonNull(konfiguration, "konfiguration darf nicht null sein");
        this.status = TischStatus.WARTEND;
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
    }

    public void entferneSpieler(SpielerEntity spielerEntity) {
        Objects.requireNonNull(spielerEntity, "spieler darf nicht null sein");
        spieler.removeIf(vorhandenerSpieler -> gleicherSpieler(vorhandenerSpieler, spielerEntity));
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
    }

    public void setzePartie(PartieEntity partie) {
        this.partie = Objects.requireNonNull(partie, "partie darf nicht null sein");
        partie.setzeTisch(this);
        this.status = TischStatus.IM_SPIEL;
    }

    public String name() {
        return name;
    }

    public TischStatus status() {
        return status;
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
