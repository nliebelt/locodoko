package de.locodoko.spieler;

import de.locodoko.partie.ereignisse.SpielBeendet;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    public SpielerProfilService(SpielerRepository spielerRepository,
                                SpielerStatistikRepository statistikRepository,
                                PartieErgebnisRepository partieErgebnisRepository) {
        this.spielerRepository = spielerRepository;
        this.statistikRepository = statistikRepository;
        this.partieErgebnisRepository = partieErgebnisRepository;
    }

    /** Aktualisiert Statistiken aller beteiligten menschlichen Spieler nach einem Spiel. */
    @ApplicationModuleListener
    void beiSpielBeendet(SpielBeendet ereignis) {
        LOGGER.info("SpielBeendet empfangen [tischId={}, spielNr={}, partieBeendet={}]",
            ereignis.tischId(), ereignis.spielNummer(), ereignis.partieBeendet());

        String regelvarianteName = ereignis.regelvariante() != null ? ereignis.regelvariante().name() : "FREI";

        for (Map.Entry<UUID, SpielBeendet.SpielerSpielDaten> eintrag : ereignis.spielerDaten().entrySet()) {
            UUID spielerId = eintrag.getKey();
            SpielBeendet.SpielerSpielDaten daten = eintrag.getValue();

            spielerRepository.findById(spielerId).ifPresent(spieler -> {
                if (spieler.istKi()) return;
                aktualisiereStatistik(spielerId, regelvarianteName, daten);
            });
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

    private void aktualisiereStatistik(UUID spielerId, String regelvariante, SpielBeendet.SpielerSpielDaten daten) {
        SpielerStatistik statistik = statistikRepository.findBySpielerIdAndRegelvariante(spielerId, regelvariante)
            .orElseGet(() -> SpielerStatistik.fuer(spielerId, regelvariante));
        statistik.verarbeiteSpiel(
            daten.sieger(), daten.spielpunkte(),
            daten.fuchsGefangen(), daten.fuchsVerloren(),
            daten.karlchenGespielt(), daten.doppelkoepfe(),
            daten.istSolist(), daten.istReSpieler(),
            daten.spieltypName() != null ? daten.spieltypName() : "",
            daten.hatArmutAngesagt(), daten.hatArmutUebernommen()
        );
        statistikRepository.save(statistik);
    }
}
