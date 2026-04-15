package de.locodoko.spieler;

import de.locodoko.partie.ereignisse.SpielBeendet;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;

/**
 * Service fuer Spieler-Profile und -Statistiken.
 *
 * <p>Lauscht auf {@link SpielBeendet}-Events und aktualisiert die
 * {@link SpielerStatistik} jedes beteiligten Spielers. KI-Spieler werden ignoriert.</p>
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
        LOGGER.info("SpielBeendet empfangen [tischId={}, spielNr={}]", ereignis.tischId(), ereignis.spielNummer());
        for (Map.Entry<UUID, SpielBeendet.SpielerSpielDaten> eintrag : ereignis.spielerDaten().entrySet()) {
            UUID spielerId = eintrag.getKey();
            SpielBeendet.SpielerSpielDaten daten = eintrag.getValue();

            spielerRepository.findById(spielerId).ifPresent(spieler -> {
                if (spieler.istKi()) return;
                aktualisiereStatistik(spielerId, daten);
            });
        }
    }

    /** Laedt oder erzeugt die Statistik eines Spielers und gibt sie zurueck. */
    @Transactional(readOnly = true)
    public SpielerStatistik ladeStatistik(UUID spielerId) {
        return statistikRepository.findBySpielerId(spielerId).orElse(SpielerStatistik.fuer(spielerId));
    }

    /** Laedt die letzten Partie-Ergebnisse eines Spielers (max. 20, neueste zuerst). */
    @Transactional(readOnly = true)
    public java.util.List<PartieErgebnisEintrag> ladePartieErgebnisse(UUID spielerId) {
        return partieErgebnisRepository.findBySpielerId(spielerId);
    }

    private void aktualisiereStatistik(UUID spielerId, SpielBeendet.SpielerSpielDaten daten) {
        SpielerStatistik statistik = statistikRepository.findBySpielerId(spielerId)
            .orElseGet(() -> SpielerStatistik.fuer(spielerId));
        statistik.verarbeiteSpiel(
            daten.sieger(), daten.spielpunkte(),
            daten.fuchsGefangen(), daten.fuchsVerloren(),
            daten.karlchenGespielt(), daten.doppelkoepfe(),
            daten.istSolist()
        );
        statistikRepository.save(statistik);
    }
}
