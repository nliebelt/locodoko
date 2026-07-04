package de.locodoko.spieler;

import de.locodoko.partie.ereignisse.SpielBeendet;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import org.springframework.dao.DuplicateKeyException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Service fuer Spieler-Profile und -Statistiken.
 *
 * <p>Lauscht auf {@link SpielBeendet}-Events und aktualisiert die
 * {@link SpielerStatistik} jedes beteiligten Spielers pro Regelvariante.
 * KI-Spieler werden ignoriert.</p>
 */
@Service
public class SpielerProfilService {

    private static final Logger LOGGER = LoggerFactory.getLogger(SpielerProfilService.class);

    private final SpielerRepository spielerRepository;
    private final SpielerStatistikRepository statistikRepository;
    private final SpielerRatingRepository ratingRepository;
    private final PartieErgebnisRepository partieErgebnisRepository;
    private final TransactionTemplate requiresNewTx;

    public SpielerProfilService(SpielerRepository spielerRepository,
                                SpielerStatistikRepository statistikRepository,
                                SpielerRatingRepository ratingRepository,
                                PartieErgebnisRepository partieErgebnisRepository,
                                PlatformTransactionManager txManager) {
        this.spielerRepository = spielerRepository;
        this.statistikRepository = statistikRepository;
        this.ratingRepository = ratingRepository;
        this.partieErgebnisRepository = partieErgebnisRepository;
        TransactionTemplate tmpl = new TransactionTemplate(txManager);
        tmpl.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.requiresNewTx = tmpl;
    }

    /** Aktualisiert Statistiken und TrueSkill-Rating aller beteiligten menschlichen Spieler nach einem Spiel. */
    @ApplicationModuleListener
    void beiSpielBeendet(SpielBeendet ereignis) {
        LOGGER.info("SpielBeendet empfangen [tischId={}, spielNr={}, partieBeendet={}]",
            ereignis.tischId(), ereignis.spielNummer(), ereignis.partieBeendet());

        String regelvarianteName = ereignis.regelvariante() != null ? ereignis.regelvariante().name() : "FREI";

        // Alle menschlichen Spieler-Statistiken und globale Ratings vorab laden
        Map<UUID, SpielerStatistik> statsMap = new LinkedHashMap<>();
        Map<UUID, SpielerRating> ratingsMap = new LinkedHashMap<>();
        for (UUID spielerId : ereignis.spielerDaten().keySet()) {
            spielerRepository.findById(spielerId).ifPresent(spieler -> {
                if (!spieler.istKi()) {
                    SpielerStatistik stat = statistikRepository
                        .findBySpielerIdAndRegelvariante(spielerId, regelvarianteName)
                        .orElseGet(() -> SpielerStatistik.fuer(spielerId, regelvarianteName));
                    statsMap.put(spielerId, stat);
                    SpielerRating rating = ladeOderErstelleRating(spielerId);
                    ratingsMap.put(spielerId, rating);
                }
            });
        }

        // TrueSkill-Rating aktualisieren: per-Variante (Profil-Statistik) + globaler Pool (Bestenliste)
        aktualisiereTeamRatings(statsMap, ereignis.spielerDaten());
        aktualisiereTeamRatings(ratingsMap, ereignis.spielerDaten());

        // Individuelle Spielstatistik und globales Rating speichern
        for (Map.Entry<UUID, SpielerStatistik> eintrag : statsMap.entrySet()) {
            UUID spielerId = eintrag.getKey();
            SpielBeendet.SpielerSpielDaten daten = ereignis.spielerDaten().get(spielerId);
            SpielerStatistik statistik = eintrag.getValue();
            statistik.verarbeiteSpiel(
                daten.sieger(), daten.spielpunkte(), daten.fuchsGefangen(), daten.fuchsVerloren(),
                daten.karlchenGespielt(), daten.doppelkoepfe(), daten.istSolist(), daten.istReSpieler(),
                daten.spieltypName() != null ? daten.spieltypName() : "",
                daten.hatArmutAngesagt(), daten.hatArmutUebernommen(), daten.teamAugen()
            );
            statistikRepository.save(statistik);
        }
        for (Map.Entry<UUID, SpielerRating> eintrag : ratingsMap.entrySet()) {
            SpielBeendet.SpielerSpielDaten daten = ereignis.spielerDaten().get(eintrag.getKey());
            SpielerRating r = eintrag.getValue();
            r.verarbeiteSpiel(daten.sieger());
            ratingRepository.save(r);
        }
    }

    /**
     * Laedt das globale Rating eines Spielers oder legt eine neue Zeile an.
     *
     * <p>Der INSERT laeuft in einer eigenen REQUIRES_NEW-Subtransaktion, damit eine
     * DuplicateKeyException bei gleichzeitiger Anlage durch einen anderen Thread ausschliesslich
     * diese Subtransaktion zurueckrollt — nicht die aufrufende beiSpielBeendet-Transaktion.
     * Nach dem INSERT (oder dem Conflict-Ignore) wird die Zeile aus der DB geladen.</p>
     */
    private SpielerRating ladeOderErstelleRating(UUID spielerId) {
        Optional<SpielerRating> vorhandenes = ratingRepository.findBySpielerId(spielerId);
        if (vorhandenes.isPresent()) {
            return vorhandenes.get();
        }
        requiresNewTx.execute(status -> {
            try {
                ratingRepository.save(SpielerRating.fuer(spielerId));
            } catch (DuplicateKeyException e) {
                // Gleichzeitiger INSERT eines anderen Threads — ignorieren
            }
            return null;
        });
        return ratingRepository.findBySpielerId(spielerId)
            .orElseThrow(() -> new IllegalStateException(
                "SpielerRating fuer " + spielerId + " fehlt"));
    }

    private <T extends TrueSkillTeilnehmer> void aktualisiereTeamRatings(
            Map<UUID, T> teilnehmerMap,
            Map<UUID, SpielBeendet.SpielerSpielDaten> spielerDaten) {
        List<T> reTeam = new ArrayList<>();
        List<T> kontraTeam = new ArrayList<>();
        boolean reSieger = false;

        for (Map.Entry<UUID, T> eintrag : teilnehmerMap.entrySet()) {
            UUID spielerId = eintrag.getKey();
            SpielBeendet.SpielerSpielDaten daten = spielerDaten.get(spielerId);
            if (daten.istReSpieler()) {
                reTeam.add(eintrag.getValue());
                if (daten.sieger()) reSieger = true;
            } else {
                kontraTeam.add(eintrag.getValue());
            }
        }

        if (reTeam.isEmpty() || kontraTeam.isEmpty()) return;

        if (reSieger) {
            TrueSkillRechner.aktualisiereZweiTeams(reTeam, kontraTeam);
        } else {
            TrueSkillRechner.aktualisiereZweiTeams(kontraTeam, reTeam);
        }
    }

    /** Laedt alle Statistik-Zeilen eines Spielers (eine pro Regelvariante). */
    @Transactional(readOnly = true)
    public List<SpielerStatistik> ladeStatistiken(UUID spielerId) {
        return statistikRepository.findBySpielerId(spielerId);
    }

    /** Laedt die Partie-Ergebnisse eines Spielers aus der VIEW (neueste zuerst). */
    @Transactional(readOnly = true)
    public List<PartieErgebnisEintrag> ladePartieErgebnisse(UUID spielerId) {
        return partieErgebnisRepository.findBySpielerId(spielerId);
    }

    /** Laedt die Top-50 Spieler aus dem globalen Rating-Pool, sortiert nach konservativem Rating (μ−3σ). */
    @Transactional(readOnly = true)
    public List<BestenlisteStatistikAggregat> ladeBestenlisteAggregiert() {
        return ratingRepository.findTopGeordertNachRating().stream()
            .map(r -> new BestenlisteStatistikAggregat(
                r.spielerId(), r.anzahlSpiele(), r.anzahlSiege(), r.ratingMu(), r.ratingSigma()))
            .toList();
    }


}
