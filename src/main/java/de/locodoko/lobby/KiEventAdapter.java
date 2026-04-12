package de.locodoko.lobby;

import de.locodoko.partie.ereignisse.NaechsterSpielerErwartet;
import de.locodoko.partie.ereignisse.VorbehaltErwartet;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Reagiert auf Spielereignisse und loest KI-Zuege aus.
 *
 * <p>Lauscht auf {@link NaechsterSpielerErwartet} und {@link VorbehaltErwartet}.
 * Falls der naechste Spieler eine KI ist, fuehrt {@link KiOrchestrierungService#automatisiereTisch}
 * den Zug synchron im selben Transaktionskontext aus. Menschliche Spieler agieren
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

    @EventListener
    void beiNaechsterSpielerErwartet(NaechsterSpielerErwartet ereignis) {
        tischRepository.findById(TischId.von(ereignis.tischId()))
            .ifPresent(kiOrchestrierungService::automatisiereTisch);
    }

    @EventListener
    void beiVorbehaltErwartet(VorbehaltErwartet ereignis) {
        tischRepository.findById(TischId.von(ereignis.tischId()))
            .ifPresent(kiOrchestrierungService::automatisiereTisch);
    }
}
