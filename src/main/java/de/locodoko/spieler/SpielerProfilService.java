package de.locodoko.spieler;

import de.locodoko.partie.ereignisse.SpielBeendet;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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
    private final PartieErgebnisRepository partieErgebnisRepository;
    private final JdbcClient jdbcClient;

    public SpielerProfilService(SpielerRepository spielerRepository,
                                SpielerStatistikRepository statistikRepository,
                                PartieErgebnisRepository partieErgebnisRepository,
                                JdbcClient jdbcClient) {
        this.spielerRepository = spielerRepository;
        this.statistikRepository = statistikRepository;
        this.partieErgebnisRepository = partieErgebnisRepository;
        this.jdbcClient = jdbcClient;
    }

    /** Aktualisiert Statistiken und TrueSkill-Rating aller beteiligten menschlichen Spieler nach einem Spiel. */
    @ApplicationModuleListener
    void beiSpielBeendet(SpielBeendet ereignis) {
        LOGGER.info("SpielBeendet empfangen [tischId={}, spielNr={}, partieBeendet={}]",
            ereignis.tischId(), ereignis.spielNummer(), ereignis.partieBeendet());

        String regelvarianteName = ereignis.regelvariante() != null ? ereignis.regelvariante().name() : "FREI";

        // Alle menschlichen Spieler-Statistiken vorab laden (Grundlage fuer TrueSkill-Update)
        Map<UUID, SpielerStatistik> statsMap = new LinkedHashMap<>();
        for (UUID spielerId : ereignis.spielerDaten().keySet()) {
            spielerRepository.findById(spielerId).ifPresent(spieler -> {
                if (!spieler.istKi()) {
                    SpielerStatistik stat = statistikRepository
                        .findBySpielerIdAndRegelvariante(spielerId, regelvarianteName)
                        .orElseGet(() -> SpielerStatistik.fuer(spielerId, regelvarianteName));
                    statsMap.put(spielerId, stat);
                }
            });
        }

        // TrueSkill-Rating aktualisieren (benoetigt alle Spieler gleichzeitig)
        aktualisiereRatings(statsMap, ereignis.spielerDaten());

        // Individuelle Spielstatistik aktualisieren und speichern
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
    }

    private void aktualisiereRatings(Map<UUID, SpielerStatistik> statsMap,
                                      Map<UUID, SpielBeendet.SpielerSpielDaten> spielerDaten) {
        List<SpielerStatistik> reTeam = new ArrayList<>();
        List<SpielerStatistik> kontraTeam = new ArrayList<>();
        boolean reSieger = false;

        for (Map.Entry<UUID, SpielerStatistik> eintrag : statsMap.entrySet()) {
            UUID spielerId = eintrag.getKey();
            SpielBeendet.SpielerSpielDaten daten = spielerDaten.get(spielerId);
            if (daten.istReSpieler()) {
                reTeam.add(eintrag.getValue());
                if (daten.sieger()) reSieger = true;
            } else {
                kontraTeam.add(eintrag.getValue());
            }
        }

        // TrueSkill benoetigt mindestens einen Spieler pro Team
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

    /** Laedt die Top-50 Spieler aggregiert ueber alle Regelvarianten, sortiert nach konservativem Rating. */
    @Transactional(readOnly = true)
    public List<BestenlisteStatistikAggregat> ladeBestenlisteAggregiert() {
        return jdbcClient.sql(
            "SELECT spieler_id, SUM(anzahl_spiele) AS anzahl_spiele, SUM(anzahl_siege) AS anzahl_siege, " +
            "AVG(rating_mu) AS rating_mu, AVG(rating_sigma) AS rating_sigma " +
            "FROM spieler_statistik GROUP BY spieler_id HAVING SUM(anzahl_spiele) > 0 " +
            "ORDER BY (AVG(rating_mu) - 3 * AVG(rating_sigma)) DESC LIMIT 50"
        ).query((rs, rowNum) -> new BestenlisteStatistikAggregat(
            UUID.fromString(rs.getString("spieler_id")),
            rs.getInt("anzahl_spiele"),
            rs.getInt("anzahl_siege"),
            rs.getDouble("rating_mu"),
            rs.getDouble("rating_sigma")
        )).list();
    }


}
