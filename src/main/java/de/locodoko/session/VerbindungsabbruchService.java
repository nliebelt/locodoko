package de.locodoko.session;

import de.locodoko.session.SpielerRepository;
import de.locodoko.lobby.TischEntity;
import de.locodoko.lobby.TischRepository;
import de.locodoko.lobby.TischStatus;
import de.locodoko.lobby.KiOrchestrierungService;
import de.locodoko.lobby.PartieStandAntwort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Verwaltet Verbindungsabbrüche und Reconnects menschlicher Spieler während eines laufenden Spiels.
 *
 * <p>Ablauf bei Verbindungsverlust:
 * <ol>
 *   <li>Spieler wird als getrennt markiert (in-memory), alle Tisch-Spieler werden informiert.</li>
 *   <li>Reconnect-Timeout läuft ({@code locodoko.verbindung.reconnect-timeout-sekunden}, Standard: 120 s).</li>
 *   <li>Reconnect innerhalb des Timeouts: Spieler kehrt direkt ins Spiel zurück.</li>
 *   <li>Timeout abgelaufen: KI übernimmt die Steuerung für das laufende Spiel.
 *       Der Spieler kann ab dem nächsten Spiel wieder selbst spielen.</li>
 * </ol>
 */
@Service
public class VerbindungsabbruchService {

    private static final Logger LOGGER = LoggerFactory.getLogger(VerbindungsabbruchService.class);

    /** HTTP-Session-ID → Disconnect-Informationen für getrennte, noch nicht KI-übernommene Spieler. */
    private final ConcurrentHashMap<String, DisconnectInfo> getrennteSessionen = new ConcurrentHashMap<>();

    private final TischRepository tischRepository;
    private final SpielerRepository spielerRepository;
    private final TischEchtzeitService tischEchtzeitService;
    private final KiOrchestrierungService kiOrchestrierungService;

    /** Konfigurierbare Wartezeit bis zur KI-Übernahme in Sekunden. */
    private final int reconnectTimeoutSekunden;

    /** Tracking-Eintrag für einen getrennten Spieler. */
    private record DisconnectInfo(UUID spielerId, String spielerName, Instant disconnectZeit) {}

    public VerbindungsabbruchService(
            TischRepository tischRepository,
            SpielerRepository spielerRepository,
            TischEchtzeitService tischEchtzeitService,
            KiOrchestrierungService kiOrchestrierungService,
            @Value("${locodoko.verbindung.reconnect-timeout-sekunden:120}") int reconnectTimeoutSekunden
    ) {
        this.tischRepository = tischRepository;
        this.spielerRepository = spielerRepository;
        this.tischEchtzeitService = tischEchtzeitService;
        this.kiOrchestrierungService = kiOrchestrierungService;
        this.reconnectTimeoutSekunden = reconnectTimeoutSekunden;
    }

    /**
     * Verarbeitet einen WebSocket-Verbindungsabbruch.
     * Merkt den Spieler als getrennt und sendet ein GETRENNT-Ereignis an den Tisch.
     *
     * @param httpSessionId HTTP-Session-ID des Spielers
     * @param spielerId     Datenbankidentität des Spielers
     * @param spielerName   Anzeigename für die Benachrichtigung
     */
    @Transactional(readOnly = true)
    public void verarbeiteDisconnect(String httpSessionId, UUID spielerId, String spielerName) {
        if (httpSessionId == null || spielerId == null) {
            return;
        }
        // putIfAbsent verhindert, dass mehrere WebSocket-Sessions für denselben Spieler
        // den Disconnect-Zeitpunkt überschreiben
        getrennteSessionen.putIfAbsent(httpSessionId, new DisconnectInfo(spielerId, spielerName, Instant.now()));
        LOGGER.info("Spieler '{}' hat die Verbindung verloren. Reconnect-Timeout: {}s", spielerName, reconnectTimeoutSekunden);

        tischRepository.findBySpieler_Id(spielerId).ifPresent(tisch -> {
            if (tisch.status() == TischStatus.IM_SPIEL) {
                tischEchtzeitService.planeTischVerbindungsStatus(
                        tisch.id(),
                        VerbindungStatusEreignisAntwort.getrennt(spielerName, reconnectTimeoutSekunden)
                );
            }
        });
    }

    /**
     * Verarbeitet einen Reconnect (neuer WebSocket-Handshake mit bekannter HTTP-Session).
     * Entfernt den Spieler aus der Disconnect-Liste und sendet ein VERBUNDEN-Ereignis.
     * Der aktuelle Spielzustand wird dem Spieler direkt zugestellt.
     *
     * @param httpSessionId HTTP-Session-ID des Spielers
     * @param spielerId     Datenbankidentität des Spielers
     * @param spielerName   Anzeigename für die Benachrichtigung
     */
    @Transactional
    public void verarbeiteReconnect(String httpSessionId, UUID spielerId, String spielerName) {
        DisconnectInfo info = getrennteSessionen.remove(httpSessionId);
        if (info == null) {
            // Erstverbindung — kein Reconnect-Szenario
            return;
        }
        LOGGER.info("Spieler '{}' hat sich erfolgreich reconnected.", spielerName);

        tischRepository.findBySpieler_Id(spielerId).ifPresent(tisch -> {
            // Alle Tisch-Spieler über den Reconnect informieren
            tischEchtzeitService.planeTischVerbindungsStatus(
                    tisch.id(),
                    VerbindungStatusEreignisAntwort.verbunden(spielerName)
            );

            // Aktuellen Spielzustand direkt an den reconnectenden Spieler senden
            if (tisch.status() == TischStatus.IM_SPIEL && tisch.partie() != null) {
                PartieStandAntwort stand = PartieStandAntwort.aus(tisch.partie(), spielerId);
                tischEchtzeitService.planeAnBenutzer(
                        httpSessionId,
                        "/queue/partie/" + tisch.partie().id(),
                        PartieEreignisAntwort.snapshot(stand)
                );
            }
        });
    }

    /**
     * Prüft regelmäßig auf abgelaufene Reconnect-Timeouts und übergibt die Steuerung an die KI.
     * Läuft alle 10 Sekunden (konfigurierbar über {@code locodoko.verbindung.pruefreconnect-ms}).
     *
     * <p>Wichtig: Dieser Task läuft transaktional, damit Datenbankänderungen (kiUebernommen-Flag)
     * und WebSocket-Broadcasts nach demselben Commit erfolgen.
     */
    @Scheduled(fixedDelayString = "${locodoko.verbindung.pruefreconnect-ms:10000}")
    @Transactional
    public void pruefeReconnectTimeouts() {
        Instant timeoutGrenze = Instant.now().minusSeconds(reconnectTimeoutSekunden);

        // Snapshot der aktuellen Einträge um ConcurrentModificationException zu vermeiden
        for (Map.Entry<String, DisconnectInfo> eintrag : new ArrayList<>(getrennteSessionen.entrySet())) {
            if (eintrag.getValue().disconnectZeit().isAfter(timeoutGrenze)) {
                continue; // Timeout noch nicht abgelaufen
            }

            String httpSessionId = eintrag.getKey();
            DisconnectInfo info = eintrag.getValue();
            getrennteSessionen.remove(httpSessionId);

            Optional<TischEntity> tischOpt = tischRepository.findBySpieler_Id(info.spielerId());
            if (tischOpt.isEmpty() || tischOpt.get().status() != TischStatus.IM_SPIEL) {
                LOGGER.debug("Kein aktiver Tisch für Spieler '{}' nach Timeout — keine KI-Übernahme nötig.", info.spielerName());
                continue; // Skip to the next disconnected session
            }

            TischEntity tisch = tischOpt.get();

            // Check if the table has only one human player remaining.
            long humanPlayerCount = tisch.spieler().stream()
                                       .filter(s -> !s.istKi())
                                       .count();

            if (humanPlayerCount == 1) {
                // If there's only one human player left, and it's the one whose timeout expired,
                // we should NOT take over with KI. The player might reconnect.
                LOGGER.debug("Only one human player remaining at table {}. Skipping KI takeover for {}.", tisch.id(), info.spielerName());
                continue; // Skip to the next disconnected session
            }

            LOGGER.info("Reconnect-Timeout für Spieler '{}' abgelaufen. KI übernimmt die Steuerung.", info.spielerName());

            // Spieler in der Datenbank als KI-übernommen markieren
            spielerRepository.findById(info.spielerId()).ifPresent(spieler -> {
                spieler.markiereAlsKiUebernommen();
                spielerRepository.save(spieler);
            });

            // KI-Übernahme an alle Tisch-Spieler melden
            tischEchtzeitService.planeTischVerbindungsStatus(
                    tisch.id(),
                    VerbindungStatusEreignisAntwort.kiUebernommen(info.spielerName())
            );

            // KI-Orchestrierung auslösen — spielt jetzt für den übernommenen Spieler
            kiOrchestrierungService.automatisiereTisch(tisch);
            tischRepository.saveAndFlush(tisch);

            // Aktualisierten Spielzustand an alle Spieler am Tisch senden
            if (tisch.partie() != null) {
                PartieStandAntwort broadcastStand = PartieStandAntwort.aus(tisch.partie());
                tischEchtzeitService.planePartieEreignis(
                        PartieEreignisAntwort.aktualisiert(PartieEreignisTyp.PARTIE_AKTUALISIERT, broadcastStand)
                );
                tisch.spieler().stream()
                        .filter(s -> !s.istKi() && !s.istKiUebernommen() && s.sessionId() != null)
                        .forEach(s -> tischEchtzeitService.planeAnBenutzer(
                                s.sessionId(),
                                "/queue/partie/" + tisch.partie().id(),
                                PartieEreignisAntwort.snapshot(PartieStandAntwort.aus(tisch.partie(), s.id()))
                        ));
            }
        }
    }

    /**
     * Gibt zurück, ob für eine HTTP-Session gerade ein Reconnect-Timer läuft
     * (d.h. der Spieler ist getrennt aber der Timeout ist noch nicht abgelaufen).
     */
    public boolean istGetrennt(String httpSessionId) {
        return getrennteSessionen.containsKey(httpSessionId);
    }

    /**
     * Entfernt eine Session aus dem Disconnect-Tracking.
     * Wird aufgerufen wenn die HTTP-Session vollständig abgelaufen ist — ein Reconnect ist dann
     * nicht mehr möglich und der Timer muss nicht weiter laufen.
     *
     * @param httpSessionId HTTP-Session-ID der abgelaufenen Session
     */
    public void entferneAusTracking(String httpSessionId) {
        getrennteSessionen.remove(httpSessionId);
    }

    /** Sichtbar für Tests: gibt die konfigurierte Reconnect-Timeout-Dauer in Sekunden zurück. */
    int reconnectTimeoutSekunden() {
        return reconnectTimeoutSekunden;
    }
}
