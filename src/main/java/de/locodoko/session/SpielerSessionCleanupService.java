package de.locodoko.session;

import de.locodoko.session.SpielerEntity;
import de.locodoko.session.SpielerRepository;
import de.locodoko.lobby.TischEntity;
import de.locodoko.lobby.TischRepository;
import de.locodoko.lobby.TischStatus;
import de.locodoko.lobby.TischAntwort;
import de.locodoko.lobby.TischListenEintragAntwort;
import de.locodoko.session.TischEchtzeitService;
import de.locodoko.session.TischEreignisAntwort;
import de.locodoko.session.TischEreignisTyp;
import de.locodoko.session.TischlisteEreignisAntwort;
import de.locodoko.session.VerbindungsabbruchService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Bereinigt Spieler-Datenbankeinträge und Tischzugehörigkeiten nach dem Ablauf einer HTTP-Session.
 *
 * <p>Wenn eine HTTP-Session abläuft (Standard: 60 Minuten Inaktivität), löst der registrierte
 * {@link jakarta.servlet.http.HttpSessionListener} diese Bereinigung aus.
 *
 * <p>Verhalten nach Session-Ablauf:
 * <ul>
 *   <li>Wartender Tisch: Spieler wird aus dem Tisch entfernt; leere Tische werden gelöscht.</li>
 *   <li>Aktiver Tisch: Spieler bleibt am Tisch, KI spielt weiter (via kiUebernommen-Flag).
 *       Die Session-ID wird geleert, damit der Spieler sich mit neuer Session neu registrieren kann.</li>
 *   <li>Kein Tisch: Session-ID wird nur geleert.</li>
 * </ul>
 */
@Service
public class SpielerSessionCleanupService {

    private static final Logger LOGGER = LoggerFactory.getLogger(SpielerSessionCleanupService.class);

    private final TischRepository tischRepository;
    private final SpielerRepository spielerRepository;
    private final TischEchtzeitService tischEchtzeitService;
    private final VerbindungsabbruchService verbindungsabbruchService;

    public SpielerSessionCleanupService(
            TischRepository tischRepository,
            SpielerRepository spielerRepository,
            TischEchtzeitService tischEchtzeitService,
            VerbindungsabbruchService verbindungsabbruchService
    ) {
        this.tischRepository = tischRepository;
        this.spielerRepository = spielerRepository;
        this.tischEchtzeitService = tischEchtzeitService;
        this.verbindungsabbruchService = verbindungsabbruchService;
    }

    /**
     * Bereinigt den Spieler-Datensatz und die Tischzugehörigkeit nach Session-Ablauf.
     *
     * <p>Die Methode ist idempotent: mehrfaches Aufrufen mit derselben Session-ID schadet nicht.
     *
     * @param sessionId HTTP-Session-ID der abgelaufenen Session
     */
    @Transactional
    public void bereinige(String sessionId) {
        if (sessionId == null) {
            return;
        }

        Optional<SpielerEntity> spielerOpt = spielerRepository.findBySessionId(sessionId);
        if (spielerOpt.isEmpty()) {
            // Anonyme Session oder bereits bereinigt — kein Handlungsbedarf
            LOGGER.debug("Session {} abgelaufen — kein Spieler-Eintrag gefunden.", sessionId);
            return;
        }

        SpielerEntity spieler = spielerOpt.get();
        LOGGER.info("HTTP-Session für Spieler '{}' abgelaufen — Bereinigung gestartet.", spieler.name());

        // WebSocket-Disconnect-Tracking bereinigen: Reconnect ist mit abgelaufener Session unmöglich
        verbindungsabbruchService.entferneAusTracking(sessionId);

        Optional<TischEntity> tischOpt = tischRepository.findBySpieler_Id(SpielerId.von(spieler.id()));
        if (tischOpt.isEmpty()) {
            // Spieler sitzt an keinem Tisch — nur Session-ID leeren
            spieler.nullifiziereSessionId();
            spielerRepository.save(spieler);
            LOGGER.debug("Spieler '{}' bereinigt — war an keinem Tisch.", spieler.name());
            return;
        }

        TischEntity tisch = tischOpt.get();
        if (tisch.status() == TischStatus.WARTEND) {
            bereinigeSpielerVonWartendemTisch(spieler, tisch);
        } else {
            // Aktiver Tisch (IM_SPIEL): KI spielt bereits oder übernimmt via pruefeReconnectTimeouts.
            // Session-ID leeren, damit der Spieler sich mit neuer Session neu registrieren kann.
            spieler.nullifiziereSessionId();
            spielerRepository.save(spieler);
            LOGGER.info(
                    "Spieler '{}' Session abgelaufen — KI bleibt für aktiven Tisch {} zuständig.",
                    spieler.name(), tisch.id()
            );
        }
    }

    /**
     * Entfernt den Spieler von einem wartenden Tisch und löscht ggf. den leeren Tisch.
     * Sendet anschließend Echtzeit-Updates an alle Clients.
     */
    private void bereinigeSpielerVonWartendemTisch(SpielerEntity spieler, TischEntity tisch) {
        tisch.entferneSpieler(spieler);

        if (tisch.spieler().isEmpty()) {
            // Letzter Spieler verlässt den Tisch → Tisch löschen
            UUID geloeschterTischId = tisch.id();
            tischRepository.delete(tisch);
            tischRepository.flush();
            tischEchtzeitService.planeTischliste(TischlisteEreignisAntwort.aktualisiert(ladeTischliste()));
            tischEchtzeitService.planeTischEreignis(TischEreignisAntwort.tischEntfernt(geloeschterTischId));
            LOGGER.info(
                    "Leerer Tisch '{}' nach Session-Ablauf von Spieler '{}' gelöscht.",
                    geloeschterTischId, spieler.name()
            );
        } else {
            // Ersteller-Nachfolge wenn nötig
            if (tisch.erstelltVon().id().equals(spieler.id())) {
                tisch.setzeErstelltVon(tisch.spieler().getFirst());
            }
            tischRepository.saveAndFlush(tisch);
            tischEchtzeitService.planeTischliste(TischlisteEreignisAntwort.aktualisiert(ladeTischliste()));
            tischEchtzeitService.planeTischEreignis(
                    TischEreignisAntwort.aktualisiert(TischEreignisTyp.SPIELER_VERLASSEN, TischAntwort.aus(tisch))
            );
            LOGGER.info(
                    "Spieler '{}' nach Session-Ablauf von wartendem Tisch '{}' entfernt.",
                    spieler.name(), tisch.id()
            );
        }

        // Session-ID nach Tisch-Bereinigung leeren
        spieler.nullifiziereSessionId();
        spielerRepository.save(spieler);
    }

    /** Lädt die aktuelle Liste aller offenen wartenden Tische für Echtzeit-Broadcasts. */
    private List<TischListenEintragAntwort> ladeTischliste() {
        return tischRepository.findAllByStatusOrderByErstelltAmAsc(TischStatus.WARTEND)
                .stream()
                .map(TischListenEintragAntwort::aus)
                .toList();
    }
}
