package de.locodoko.tisch;

import de.locodoko.spieler.SpielerId;
import de.locodoko.spieler.SpielerTischAbfrage;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Implementiert {@link SpielerTischAbfrage} im Tisch-Modul.
 * Erlaubt dem Spieler-Modul, Tisch-Informationen abzufragen ohne direkte Abhaengigkeit.
 */
@Service
class SpielerTischAbfrageImpl implements SpielerTischAbfrage {

    private final TischRepository tischRepository;

    SpielerTischAbfrageImpl(TischRepository tischRepository) {
        this.tischRepository = tischRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public boolean spielerSitztAmTisch(String sessionId) {
        return tischRepository.existsBySpieler_SessionId(sessionId);
    }

    @Override
    @Transactional(readOnly = true)
    public UUID ladeAktiveTischId(UUID spielerId) {
        return tischRepository.findBySpieler_Id(SpielerId.von(spielerId))
            .map(TischEntity::id)
            .orElse(null);
    }
}
