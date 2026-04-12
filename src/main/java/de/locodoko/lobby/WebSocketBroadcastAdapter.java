package de.locodoko.lobby;

import de.locodoko.partie.ereignisse.PartieAktualisiert;
import de.locodoko.session.PartieEreignisAntwort;
import de.locodoko.session.PartieEreignisTyp;
import de.locodoko.session.TischEchtzeitService;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Sendet WebSocket-Broadcasts nach Aenderungen am Partiestand.
 *
 * <p>Lauscht auf {@link PartieAktualisiert} und sendet:
 * <ul>
 *   <li>Einen anonymen Broadcast an alle Tisch-Subscriber (ohne Handkarten).</li>
 *   <li>Einen benutzerbezogenen Snapshot mit eigener Hand an jeden menschlichen Spieler.</li>
 * </ul>
 * {@link TischEchtzeitService#planePartieEreignis} garantiert, dass Nachrichten
 * erst nach dem DB-Commit gesendet werden.</p>
 */
@Component
class WebSocketBroadcastAdapter {

    private final TischRepository tischRepository;
    private final TischEchtzeitService tischEchtzeitService;

    WebSocketBroadcastAdapter(TischRepository tischRepository, TischEchtzeitService tischEchtzeitService) {
        this.tischRepository = tischRepository;
        this.tischEchtzeitService = tischEchtzeitService;
    }

    @EventListener
    void beiPartieAktualisiert(PartieAktualisiert ereignis) {
        TischEntity tisch = tischRepository.findById(TischId.von(ereignis.tischId())).orElse(null);
        if (tisch == null || tisch.partie() == null) {
            return;
        }
        PartieStandAntwort broadcastStand = PartieStandAntwort.aus(tisch.partie());
        tischEchtzeitService.planePartieEreignis(
            PartieEreignisAntwort.aktualisiert(PartieEreignisTyp.PARTIE_AKTUALISIERT, broadcastStand));
        tisch.spieler().stream()
            .filter(spieler -> !spieler.istKi() && spieler.sessionId() != null)
            .forEach(spieler -> tischEchtzeitService.planeAnBenutzer(
                spieler.sessionId(),
                "/queue/partie/" + tisch.partie().id(),
                PartieEreignisAntwort.snapshot(PartieStandAntwort.aus(tisch.partie(), spieler.id()))
            ));
    }
}
