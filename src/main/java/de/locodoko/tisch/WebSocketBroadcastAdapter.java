package de.locodoko.tisch;

import de.locodoko.partie.ereignisse.PartieAktualisiert;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

/**
 * Sendet WebSocket-Broadcasts nach Aenderungen am Partiestand.
 *
 * <p>Lauscht auf {@link PartieAktualisiert} via {@code @ApplicationModuleListener}
 * (Outbox-Semantik: Events werden erst nach DB-Commit asynchron zugestellt) und sendet:
 * <ul>
 *   <li>Einen anonymen Broadcast an alle Tisch-Subscriber (ohne Handkarten).</li>
 *   <li>Einen benutzerbezogenen Snapshot mit eigener Hand an jeden menschlichen Spieler.</li>
 * </ul></p>
 */
@Component
class WebSocketBroadcastAdapter {

    private final TischRepository tischRepository;
    private final TischEchtzeitService tischEchtzeitService;

    WebSocketBroadcastAdapter(TischRepository tischRepository, TischEchtzeitService tischEchtzeitService) {
        this.tischRepository = tischRepository;
        this.tischEchtzeitService = tischEchtzeitService;
    }

    @ApplicationModuleListener
    public void beiPartieAktualisiert(PartieAktualisiert ereignis) {
        TischEntity tisch = tischRepository.findById(TischId.von(ereignis.tischId())).orElse(null);
        if (tisch == null || tisch.partie() == null) {
            return;
        }
        PartieStandAntwort broadcastStand = PartieStandAntwort.aus(tisch);
        tischEchtzeitService.sendePartieEreignis(
            PartieEreignisAntwort.aktualisiert(PartieEreignisTyp.PARTIE_AKTUALISIERT, broadcastStand));
        tisch.spieler().stream()
            .filter(spieler -> !spieler.istKi() && spieler.sessionId() != null)
            .forEach(spieler -> tischEchtzeitService.sendeAnBenutzer(
                spieler.sessionId(),
                "/queue/partie/" + tisch.partie().id(),
                PartieEreignisAntwort.snapshot(PartieStandAntwort.aus(tisch, spieler.id()))
            ));
    }
}
