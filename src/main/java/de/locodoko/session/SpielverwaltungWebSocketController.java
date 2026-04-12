package de.locodoko.session;

import de.locodoko.session.SpielerEntity;
import de.locodoko.session.SpielerSessionService;
import de.locodoko.session.SpielerSessionUngueltigException;
import de.locodoko.session.SpielverwaltungKonfliktException;
import de.locodoko.session.SpielverwaltungNichtGefundenException;
import de.locodoko.lobby.PartieStandAntwort;
import de.locodoko.lobby.SpielAktionsService;
import de.locodoko.lobby.TischAntwort;
import de.locodoko.lobby.TischVerwaltungsService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageExceptionHandler;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.annotation.SendToUser;
import org.springframework.stereotype.Controller;

import de.locodoko.lobby.TischId;
import de.locodoko.partie.PartieId;

import java.security.Principal;
import java.util.UUID;

/**
 * WebSocket-Controller fuer alle Spielaktionen (STOMP-Nachrichtenhandler).
 *
 * <p>Empfaengt Spielaktionen von Clients ({@code /app/tisch/{id}/karte},
 * {@code /vorbehalt}, {@code /ansage}, {@code /armut-antwort}, {@code /snapshot},
 * {@code /debug-snapshot}) und delegiert an {@link de.locodoko.lobby.TischVerwaltungsService}
 * und {@link de.locodoko.lobby.SpielAktionsService}.
 * Nach jeder Aktion werden automatische Broadcasts und ggf. benutzerbezogene Antworten
 * ueber {@link de.locodoko.session.TischEchtzeitService} versandt. Fehler werden als
 * {@link SpielverwaltungWebSocketFehlerAntwort} an den Verursacher zurueckgesendet.</p>
 */
@Controller
public class SpielverwaltungWebSocketController {

    private static final Logger LOGGER = LoggerFactory.getLogger(SpielverwaltungWebSocketController.class);

    private final TischVerwaltungsService tischVerwaltungsService;
    private final SpielAktionsService spielAktionsService;
    private final SpielerSessionService spielerSessionService;
    private final TischEchtzeitService tischEchtzeitService;

    public SpielverwaltungWebSocketController(
        TischVerwaltungsService tischVerwaltungsService,
        SpielAktionsService spielAktionsService,
        SpielerSessionService spielerSessionService,
        TischEchtzeitService tischEchtzeitService
    ) {
        this.tischVerwaltungsService = tischVerwaltungsService;
        this.spielAktionsService = spielAktionsService;
        this.spielerSessionService = spielerSessionService;
        this.tischEchtzeitService = tischEchtzeitService;
    }

    @MessageMapping("/tische/snapshot")
    public void sendeTischlisteSnapshot(Principal principal) {
        SpielerEntity spieler = ladeAktivenSpieler(principal);
        LOGGER.info("Spieler {} fordert Tischlisten-Snapshot per WebSocket an", spieler.id());
        tischEchtzeitService.sendeAnBenutzer(
            principal.getName(),
            "/queue/tische",
            TischlisteEreignisAntwort.snapshot(tischVerwaltungsService.listeOffeneTische())
        );
    }

    @MessageMapping("/tisch/{tischId}/snapshot")
    public void sendeTischSnapshot(@DestinationVariable UUID tischId, Principal principal) {
        SpielerEntity spieler = ladeAktivenSpieler(principal);
        TischAntwort tisch = tischVerwaltungsService.ladeTisch(TischId.von(tischId));
        PartieStandAntwort partieStand = tisch.partieId() == null ? null : spielAktionsService.ladePartieStand(PartieId.von(tisch.partieId()), spieler);
        LOGGER.info("Spieler {} fordert Tisch-Snapshot {} per WebSocket an", spieler.id(), tischId);
        tischEchtzeitService.sendeAnBenutzer(
            principal.getName(),
            "/queue/tisch/" + tischId,
            TischEreignisAntwort.snapshot(tisch, partieStand)
        );
    }

    @MessageMapping("/partie/{partieId}/snapshot")
    public void sendePartieSnapshot(@DestinationVariable UUID partieId, Principal principal) {
        SpielerEntity spieler = ladeAktivenSpieler(principal);
        LOGGER.info("Spieler {} fordert Partie-Snapshot {} per WebSocket an", spieler.id(), partieId);
        tischEchtzeitService.sendeAnBenutzer(
            principal.getName(),
            "/queue/partie/" + partieId,
            PartieEreignisAntwort.snapshot(spielAktionsService.ladePartieStand(PartieId.von(partieId), spieler))
        );
    }

    @MessageMapping("/partie/{partieId}/debug-snapshot")
    public void sendePartieDebugSnapshot(@DestinationVariable UUID partieId, Principal principal) {
        SpielerEntity spieler = ladeAktivenSpieler(principal);
        LOGGER.info("Spieler {} fordert Debug-Partie-Snapshot {} per WebSocket an", spieler.id(), partieId);
        tischEchtzeitService.sendeAnBenutzer(
            principal.getName(),
            "/queue/partie/" + partieId,
            PartieEreignisAntwort.snapshot(spielAktionsService.ladePartieStand(PartieId.von(partieId), spieler, true))
        );
    }

    @MessageMapping("/tisch/{tischId}/vorbehalt")
    public void meldeVorbehalt(@DestinationVariable UUID tischId, VorbehaltAnfrage anfrage, Principal principal) {
        SpielerEntity spieler = ladeAktivenSpieler(principal);
        LOGGER.info("Spieler {} meldet Vorbehalt {} per WebSocket an Tisch {}", spieler.id(), anfrage.vorbehalt(), tischId);
        spielAktionsService.meldeVorbehalt(TischId.von(tischId), spieler, anfrage.vorbehalt());
    }

    @MessageMapping("/tisch/{tischId}/armut-antwort")
    public void verarbeiteArmutAntwort(@DestinationVariable UUID tischId, ArmutAntwortAnfrage anfrage, Principal principal) {
        SpielerEntity spieler = ladeAktivenSpieler(principal);
        LOGGER.info("Spieler {} beantwortet Armut per WebSocket an Tisch {}", spieler.id(), tischId);
        spielAktionsService.verarbeiteArmutAntwort(TischId.von(tischId), spieler, anfrage.kartenIds(), anfrage.angenommen());
    }

    @MessageMapping("/tisch/{tischId}/karte")
    public void spieleKarte(@DestinationVariable UUID tischId, KarteSpielenAnfrage anfrage, Principal principal) {
        SpielerEntity spieler = ladeAktivenSpieler(principal);
        LOGGER.info("Spieler {} spielt Karte {} per WebSocket an Tisch {}", spieler.id(), anfrage.karteId(), tischId);
        spielAktionsService.spieleKarte(TischId.von(tischId), spieler, anfrage.karteId());
    }

    @MessageMapping("/tisch/{tischId}/ansage")
    public void sageAn(@DestinationVariable UUID tischId, AnsageAnfrage anfrage, Principal principal) {
        SpielerEntity spieler = ladeAktivenSpieler(principal);
        LOGGER.info("Spieler {} taetigt Ansage {} per WebSocket an Tisch {}", spieler.id(), anfrage.ansage(), tischId);
        spielAktionsService.sageAn(TischId.von(tischId), spieler, anfrage.ansage());
    }

    @MessageExceptionHandler({
        SpielerSessionUngueltigException.class,
        SpielverwaltungNichtGefundenException.class,
        SpielverwaltungKonfliktException.class,
        IllegalArgumentException.class
    })
    @SendToUser(value = "/queue/fehler", broadcast = false)
    public SpielverwaltungWebSocketFehlerAntwort behandleFachlichenFehler(RuntimeException exception) {
        // Alle fachlichen Exceptions liefern fehlerCode() direkt; nur IllegalArgumentException faellt durch.
        if (exception instanceof SpielverwaltungNichtGefundenException nichtGefundenException) {
            return SpielverwaltungWebSocketFehlerAntwort.fachlicherFehler(
                nichtGefundenException.fehlerCode(),
                nichtGefundenException.getMessage()
            );
        }
        if (exception instanceof SpielverwaltungKonfliktException konfliktException) {
            return SpielverwaltungWebSocketFehlerAntwort.fachlicherFehler(
                konfliktException.fehlerCode(),
                konfliktException.getMessage()
            );
        }
        if (exception instanceof SpielerSessionUngueltigException sessionException) {
            return SpielverwaltungWebSocketFehlerAntwort.fachlicherFehler(
                sessionException.fehlerCode(),
                sessionException.getMessage()
            );
        }
        return SpielverwaltungWebSocketFehlerAntwort.fachlicherFehler("ANFRAGE_UNGUELTIG", exception.getMessage());
    }

    @MessageExceptionHandler(Exception.class)
    @SendToUser(value = "/queue/fehler", broadcast = false)
    public SpielverwaltungWebSocketFehlerAntwort behandleServerfehler(Exception exception) {
        LOGGER.error("Unerwarteter WebSocket-Fehler", exception);
        return SpielverwaltungWebSocketFehlerAntwort.fachlicherFehler(
            "SERVERFEHLER",
            "Es ist ein unerwarteter Serverfehler aufgetreten."
        );
    }

    private SpielerEntity ladeAktivenSpieler(Principal principal) {
        if (principal == null || principal.getName() == null || principal.getName().isBlank()) {
            throw new SpielerSessionUngueltigException("Es ist keine aktive Spieler-Session vorhanden.");
        }
        return spielerSessionService.ladeAktivenSpieler(principal.getName());
    }
}
