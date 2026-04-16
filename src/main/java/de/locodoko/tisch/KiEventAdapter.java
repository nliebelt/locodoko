package de.locodoko.tisch;

import de.locodoko.partie.ereignisse.NaechsterSpielerErwartet;
import de.locodoko.partie.ereignisse.VorbehaltErwartet;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

/**
 * Reagiert auf Spielereignisse und loest KI-Zuege aus.
 *
 * <p>Lauscht auf {@link NaechsterSpielerErwartet} und {@link VorbehaltErwartet}
 * via {@code @ApplicationModuleListener} (Outbox-Semantik: Events werden erst nach DB-Commit
 * asynchron in eigener Transaktion zugestellt).
 * Falls der naechste Spieler eine KI ist, fuehrt {@link KiOrchestrierungService#automatisiereTisch}
 * den Zug aus. Menschliche Spieler agieren eigenstaendig ueber WebSocket und werden ignoriert.</p>
 *
 * <p>KI-Timing: In der Stichphase broadcastet {@link KiOrchestrierungService#automatisiereTisch}
 * nach jedem KI-Zug sofort den aktuellen Stand. Das Frontend puffert eingehende
 * KI-Karten-Updates mit 800ms Verzoegerung, damit jede Karte einzeln animiert erscheint.</p>
 */
@Component
class KiEventAdapter {

    private final KiOrchestrierungService kiOrchestrierungService;
    private final TischRepository tischRepository;

    KiEventAdapter(KiOrchestrierungService kiOrchestrierungService, TischRepository tischRepository) {
        this.kiOrchestrierungService = kiOrchestrierungService;
        this.tischRepository = tischRepository;
    }

    @ApplicationModuleListener
    void beiNaechsterSpielerErwartet(NaechsterSpielerErwartet ereignis) {
        tischRepository.findById(TischId.von(ereignis.tischId()))
            .ifPresent(kiOrchestrierungService::automatisiereTisch);
    }

    @ApplicationModuleListener
    void beiVorbehaltErwartet(VorbehaltErwartet ereignis) {
        tischRepository.findById(TischId.von(ereignis.tischId()))
            .ifPresent(kiOrchestrierungService::automatisiereTisch);
    }

}
