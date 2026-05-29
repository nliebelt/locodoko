package de.locodoko.tisch;

import de.locodoko.spieler.SpielerEntity;
import de.locodoko.spieler.SpielerId;
import de.locodoko.spieler.SpielerRepository;
import org.springframework.stereotype.Component;

/**
 * Gemeinsamer Zugriffs-Collaborator fuer Tisch- und Spieler-Stammdaten.
 *
 * <p>Buendelt die wiederkehrenden Lade- und Guard-Operationen, die zuvor in
 * {@link TischVerwaltungsService} und {@link SpielAktionsService} dupliziert waren:
 * Laden eines Tisches/Spielers per ID (mit fachlicher „nicht gefunden"-Exception),
 * Laden mit Schreibsperre und die WARTEND-Statuspruefung.</p>
 */
@Component
public class TischZugriff {

    private final TischRepository tischRepository;
    private final SpielerRepository spielerRepository;

    public TischZugriff(TischRepository tischRepository, SpielerRepository spielerRepository) {
        this.tischRepository = tischRepository;
        this.spielerRepository = spielerRepository;
    }

    public TischEntity ladeTischEntity(TischId tischId) {
        return tischRepository.findById(tischId)
            .orElseThrow(() -> new SpielverwaltungNichtGefundenException(
                "TISCH_NICHT_GEFUNDEN",
                "Es wurde kein Tisch mit der ID " + tischId + " gefunden."
            ));
    }

    /**
     * Laedt einen Tisch mit exklusiver Datenbanksperre (PESSIMISTIC_WRITE).
     * Muss fuer alle schreibenden Operationen verwendet werden, die zuerst den
     * Tischzustand pruefen (z.B. istVoll, Status WARTEND) und dann mutieren —
     * sonst koennen zwei gleichzeitige Requests beide die Pruefung bestehen und
     * den Tisch in einen inkonsistenten Zustand bringen.
     */
    public TischEntity ladeTischEntityMitSperre(TischId tischId) {
        return tischRepository.findByIdWithLock(tischId)
            .orElseThrow(() -> new SpielverwaltungNichtGefundenException(
                "TISCH_NICHT_GEFUNDEN",
                "Es wurde kein Tisch mit der ID " + tischId + " gefunden."
            ));
    }

    public SpielerEntity ladeSpieler(SpielerId spielerId) {
        return spielerRepository.findById(spielerId)
            .orElseThrow(() -> new SpielverwaltungNichtGefundenException(
                "SPIELER_NICHT_GEFUNDEN",
                "Es wurde kein Spieler mit der ID " + spielerId + " gefunden."
            ));
    }

    public void pruefeWartendenTisch(TischEntity tisch, String fehlerCode, String nachricht) {
        if (tisch.status() != TischStatus.WARTEND) {
            throw new SpielverwaltungKonfliktException(fehlerCode, nachricht);
        }
    }
}
