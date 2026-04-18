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
 * den Zug aus und persistiert den aktualisierten Zustand. Menschliche Spieler agieren
 * eigenstaendig ueber WebSocket und werden ignoriert.</p>
 *
 * <p>KI-Timing: In der Stichphase broadcastet {@link KiOrchestrierungService#automatisiereTisch}
 * nach jedem KI-Zug sofort den aktuellen Stand. Das Frontend puffert eingehende
 * KI-Karten-Updates mit 800ms Verzoegerung, damit jede Karte einzeln animiert erscheint.</p>
 */
@Component
class KiEventAdapter {

    private final KiOrchestrierungService kiOrchestrierungService;
    private final TischRepository tischRepository;
    private final SpielRegistry spielRegistry;

    KiEventAdapter(KiOrchestrierungService kiOrchestrierungService, TischRepository tischRepository, SpielRegistry spielRegistry) {
        this.kiOrchestrierungService = kiOrchestrierungService;
        this.tischRepository = tischRepository;
        this.spielRegistry = spielRegistry;
    }

    @ApplicationModuleListener
    void beiNaechsterSpielerErwartet(NaechsterSpielerErwartet ereignis) {
        fuehreKiSchritteAus(TischId.von(ereignis.tischId()));
    }

    @ApplicationModuleListener
    void beiVorbehaltErwartet(VorbehaltErwartet ereignis) {
        fuehreKiSchritteAus(TischId.von(ereignis.tischId()));
    }

    private void fuehreKiSchritteAus(TischId tischId) {
        tischRepository.findById(tischId).ifPresent(tisch -> {
            boolean hatKiGespielt = kiOrchestrierungService.automatisiereTisch(tisch);
            if (hatKiGespielt) {
                tischRepository.save(tisch);
                synchronisiereRegistry(tischId, tisch);
            }
        });
    }

    private void synchronisiereRegistry(TischId tischId, TischEntity tisch) {
        if (tisch.partie() == null) {
            spielRegistry.entferne(tischId);
            return;
        }
        tisch.partie().spiele().stream()
            .filter(s -> s.ergebnisEmbeddable() == null)
            .reduce((a, b) -> b)
            .ifPresentOrElse(
                s -> { s.hydriere(tisch.konfiguration().alsSpielregeln()); spielRegistry.registriere(tischId, s); },
                () -> spielRegistry.entferne(tischId)
            );
    }

}
