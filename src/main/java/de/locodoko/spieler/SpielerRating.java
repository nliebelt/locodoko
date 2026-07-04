package de.locodoko.spieler;

import de.locodoko.system.AbstraktePersistenzEntity;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * Globales TrueSkill-Rating eines Spielers ueber alle Regelvarianten hinweg.
 * Eine Zeile pro Spieler (im Gegensatz zu {@link SpielerStatistik}, die pro Regelvariante gefuehrt wird).
 * Wird bei jedem abgeschlossenen Spiel neben der Statistik aktualisiert.
 */
@Table("spieler_rating")
public class SpielerRating extends AbstraktePersistenzEntity implements TrueSkillTeilnehmer {

    @Column("spieler_id")
    private UUID spielerId;

    @Column("rating_mu")
    private double ratingMu = TrueSkillRechner.MU_INIT;

    @Column("rating_sigma")
    private double ratingSigma = TrueSkillRechner.SIGMA_INIT;

    @Column("anzahl_spiele")
    private int anzahlSpiele;

    @Column("anzahl_siege")
    private int anzahlSiege;

    @Column("zuletzt_aktualisiert")
    private Instant zuletztAktualisiert;

    protected SpielerRating() {}

    public static SpielerRating fuer(UUID spielerId) {
        SpielerRating r = new SpielerRating();
        r.spielerId = spielerId;
        return r;
    }

    public UUID spielerId() { return spielerId; }
    @Override public double ratingMu() { return ratingMu; }
    @Override public double ratingSigma() { return ratingSigma; }
    public int anzahlSpiele() { return anzahlSpiele; }
    public int anzahlSiege() { return anzahlSiege; }
    public Instant zuletztAktualisiert() { return zuletztAktualisiert; }
    /** Konservative Skill-Schaetzung fuer die Bestenliste: μ − 3σ. */
    public double konservativesRating() { return ratingMu - 3.0 * ratingSigma; }
    /** Wertungspunkte als gerundete Ganzzahl (μ − 3σ), leicht peilbar fuer Spieler. */
    public int wertungspunkte() { return (int) Math.round(konservativesRating()); }

    @Override
    public void aktualisiereRating(double neueMu, double neueSigma) {
        this.ratingMu = neueMu;
        this.ratingSigma = neueSigma;
    }

    public void verarbeiteSpiel(boolean sieger) {
        this.anzahlSpiele++;
        if (sieger) this.anzahlSiege++;
        this.zuletztAktualisiert = Instant.now();
    }
}
