package de.locodoko.ki.orchestrierung;

import de.locodoko.tisch.SpielRegistry;
import de.locodoko.tisch.TischEntity;
import de.locodoko.tisch.TischId;
import de.locodoko.tisch.TischRepository;
import de.locodoko.tisch.KiUebernahmeEreignis;

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

    @ApplicationModuleListener
    void beiKiUebernahme(KiUebernahmeEreignis ereignis) {
        fuehreKiSchritteAus(ereignis.tischId());
    }

    private void fuehreKiSchritteAus(TischId tischId) {
        // Lock auf TischId holen, um parallele Orchestrierungen und Race-Conditions
        // mit menschlichen Aktionen (via SpielAktionsService) zu verhindern.
        // Da automatisiereTisch() Delays (Thread.sleep) nutzt, ist Serialisierung kritisch.
        spielRegistry.mitLock(tischId, () -> {
            // Tisch NEU LADEN nachdem der Lock gehalten wird, damit wir nicht auf einem
            // veralteten Stand operieren, der waehrend des Wartens auf den Lock in der DB
            // durch einen menschlichen Spieler geaendert wurde.
            tischRepository.findById(tischId).ifPresent(tisch -> {
                long versionVorher = tisch.partie() != null ? tisch.partie().version() : -1;
                TischEntity aktualisierterTisch = kiOrchestrierungService.automatisiereTisch(tisch);
                
                // Falls die KI gespielt hat (erkennbar an der inkrementierten Version),
                // synchronisieren wir die SpielRegistry mit dem neuen Stand.
                // Das tischRepository.save() passiert jetzt atomar in automatisiereTisch().
                if (aktualisierterTisch.partie() != null && aktualisierterTisch.partie().version() > versionVorher) {
                    synchronisiereRegistry(tischId, aktualisierterTisch);
                }
            });
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
