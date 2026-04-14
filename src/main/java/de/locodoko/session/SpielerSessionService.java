package de.locodoko.session;

import de.locodoko.session.SpielerEntity;
import de.locodoko.session.SpielerRepository;
import de.locodoko.tisch.TischRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Kapselt die gesamte Spieler-Session-Logik: Registrierung, Laden, Timeout und Namensaenderung. */

@Service
public class SpielerSessionService {

    private final SpielerRepository spielerRepository;
    private final TischRepository tischRepository;
    private final SpielerSessionEigenschaften eigenschaften;

    public SpielerSessionService(
        SpielerRepository spielerRepository,
        TischRepository tischRepository,
        SpielerSessionEigenschaften eigenschaften
    ) {
        this.spielerRepository = spielerRepository;
        this.tischRepository = tischRepository;
        this.eigenschaften = eigenschaften;
    }

    @Transactional
    public SpielerRegistrierung registriereSpieler(HttpServletRequest request, String name) {
        HttpSession vorhandeneSession = request.getSession(false);
        if (vorhandeneSession != null) {
            uebernehmeTimeout(vorhandeneSession);
            SpielerEntity bestehenderSpieler = spielerRepository.findBySessionId(vorhandeneSession.getId()).orElse(null);
            if (bestehenderSpieler != null) {
                return new SpielerRegistrierung(bestehenderSpieler, false);
            }
            request.changeSessionId();
        }

        HttpSession session = request.getSession(true);
        uebernehmeTimeout(session);
        SpielerEntity spieler = spielerRepository.saveAndFlush(SpielerEntity.menschlich(name, session.getId()));
        return new SpielerRegistrierung(spieler, true);
    }

    /**
     * Laedt den aktiven Spieler aus einer HTTP-Anfrage: prueft auf vorhandene Session,
     * uebernimmt den Timeout und wirft bei fehlender oder unbekannter Session eine
     * {@link SpielerSessionUngueltigException}. Zentralisiert die in allen REST-Controllern
     * benoetigt Session-Validierung an einem einzigen Ort.
     */
    @Transactional(readOnly = true)
    public SpielerEntity ladeAktivenSpieler(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session == null) {
            throw new SpielerSessionUngueltigException("Es ist keine aktive Spieler-Session vorhanden.");
        }
        uebernehmeTimeout(session);
        return ladeAktivenSpieler(session.getId());
    }

    @Transactional(readOnly = true)
    public SpielerEntity ladeAktivenSpieler(String sessionId) {
        return spielerRepository.findBySessionId(sessionId)
            .filter(spieler -> !spieler.istKi())
            .orElseThrow(() -> new SpielerSessionUngueltigException(
                "Die Spieler-Session ist ungueltig oder serverseitig nicht mehr bekannt."
            ));
    }

    @Transactional
    public SpielerEntity aendereNamen(String sessionId, String neuerName) {
        SpielerEntity spieler = ladeAktivenSpieler(sessionId);
        if (tischRepository.existsBySpieler_SessionId(sessionId)) {
            throw new SpielerNameAenderungNichtErlaubtException(
                "Der Spielername darf nur geaendert werden, solange der Spieler keinem Tisch zugeordnet ist."
            );
        }
        spieler.aendereName(neuerName);
        return spielerRepository.saveAndFlush(spieler);
    }

    /**
     * Gibt die ID des Tisches zurueck, an dem der Spieler aktuell sitzt.
     * Wird fuer Session-Recovery im Frontend benoetigt ({@code GET /api/spieler/session}).
     *
     * @param spielerId Spieler-ID
     * @return Tisch-ID oder {@code null}, wenn der Spieler an keinem Tisch sitzt
     */
    @Transactional(readOnly = true)
    public java.util.UUID ladeAktiveTischId(java.util.UUID spielerId) {
        return tischRepository.findBySpieler_Id(SpielerId.von(spielerId))
            .map(tisch -> tisch.id())
            .orElse(null);
    }

    public void uebernehmeTimeout(HttpSession session) {
        session.setMaxInactiveInterval((int) eigenschaften.getTimeout().toSeconds());
    }
}
