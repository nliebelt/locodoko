package de.locodoko.spieler;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Loescht ein Spieler-Konto vollstaendig gemaess DSGVO Art. 17.
 *
 * <p>Die Datenbank uebernimmt die Kaskadenbereinigung:
 * {@code tisch_spieler} und {@code spieler_statistik} via CASCADE,
 * {@code partie_teilnehmer} via SET NULL (Spielhistorie anonym erhalten).</p>
 */
@Service
public class KontoLoeschungsService {

    private static final Logger log = LoggerFactory.getLogger(KontoLoeschungsService.class);

    private final SpielerRepository spielerRepository;

    public KontoLoeschungsService(SpielerRepository spielerRepository) {
        this.spielerRepository = spielerRepository;
    }

    /**
     * Loescht den Spieler aus der Datenbank und invalidiert die HTTP-Session.
     *
     * @param spielerId ID des zu loeschenden Spielers (muss dem aktiven Spieler entsprechen)
     * @param request   aktuelle HTTP-Anfrage (fuer Session-Invalidierung)
     */
    @Transactional
    public void loescheKonto(UUID spielerId, HttpServletRequest request) {
        log.info("Konto-Loeschung gestartet [spielerId={}]", spielerId);
        spielerRepository.deleteById(spielerId);
        log.info("Konto-Loeschung abgeschlossen [spielerId={}]", spielerId);

        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
    }
}
