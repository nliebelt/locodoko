package de.locodoko.session;

import de.locodoko.session.SpielerEntity;
import de.locodoko.session.SpielerRepository;
import de.locodoko.lobby.TischRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    public void uebernehmeTimeout(HttpSession session) {
        session.setMaxInactiveInterval((int) eigenschaften.getTimeout().toSeconds());
    }
}
