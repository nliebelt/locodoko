package de.locodoko.ki.orchestrierung;

import de.locodoko.tisch.TischEntity;
import de.locodoko.tisch.TischId;
import de.locodoko.tisch.TischRepository;
import de.locodoko.tisch.KiUebernahmeEreignis;

import de.locodoko.partie.ereignisse.NaechsterSpielerErwartet;
import de.locodoko.partie.ereignisse.VorbehaltErwartet;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Reagiert auf Spielereignisse und loest KI-Zuege aus.
 *
 * <p>Lauscht auf {@link NaechsterSpielerErwartet} und {@link VorbehaltErwartet}
 * via {@code @TransactionalEventListener(AFTER_COMMIT)}: Events werden erst nach DB-Commit
 * zugestellt, damit die KI nie auf einem noch nicht persistierten Spielstand operiert.
 * Falls der naechste Spieler eine KI ist, fuehrt {@link KiOrchestrierungService#automatisiereTisch}
 * den Zug aus und persistiert den aktualisierten Zustand. Menschliche Spieler agieren
 * eigenstaendig ueber WebSocket und werden ignoriert.</p>
 */
@Component
class KiEventAdapter {

    private final KiOrchestrierungService kiOrchestrierungService;
    private final TischRepository tischRepository;

    KiEventAdapter(KiOrchestrierungService kiOrchestrierungService, TischRepository tischRepository) {
        this.kiOrchestrierungService = kiOrchestrierungService;
        this.tischRepository = tischRepository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    void beiNaechsterSpielerErwartet(NaechsterSpielerErwartet ereignis) {
        fuehreKiSchritteAus(TischId.von(ereignis.tischId()));
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    void beiVorbehaltErwartet(VorbehaltErwartet ereignis) {
        fuehreKiSchritteAus(TischId.von(ereignis.tischId()));
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    void beiKiUebernahme(KiUebernahmeEreignis ereignis) {
        fuehreKiSchritteAus(ereignis.tischId());
    }

    private void fuehreKiSchritteAus(TischId tischId) {
        tischRepository.findById(tischId).ifPresent(tisch ->
            kiOrchestrierungService.automatisiereTisch(tisch)
        );
    }
}
