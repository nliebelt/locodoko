package de.locodoko.lobby;

import de.locodoko.session.SpielerEntity;
import de.locodoko.session.SpielerSessionService;
import de.locodoko.session.SpielerSessionUngueltigException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/tische")
public class TischController {

    private static final Logger LOGGER = LoggerFactory.getLogger(TischController.class);

    private final TischService tischService;
    private final SpielerSessionService spielerSessionService;

    public TischController(TischService tischService, SpielerSessionService spielerSessionService) {
        this.tischService = tischService;
        this.spielerSessionService = spielerSessionService;
    }

    @GetMapping
    public List<TischListenEintragAntwort> listeTische() {
        LOGGER.info("Offene Tischliste abgefragt");
        return tischService.listeOffeneTische();
    }

    @PostMapping
    public ResponseEntity<TischAntwort> erstelleTisch(
        @Valid @RequestBody TischErstellenAnfrage anfrage,
        HttpServletRequest request
    ) {
        SpielerEntity spieler = ladeAktivenSpieler(request);
        LOGGER.info("Spieler {} erstellt Tisch '{}'", spieler.id(), anfrage.name());
        TischAntwort antwort = tischService.erstelleTisch(spieler, anfrage);
        return ResponseEntity.status(HttpStatus.CREATED).body(antwort);
    }

    @PostMapping("/{id}/beitreten")
    public TischAntwort betreteTisch(@PathVariable UUID id, HttpServletRequest request) {
        SpielerEntity spieler = ladeAktivenSpieler(request);
        LOGGER.info("Spieler {} tritt Tisch {} bei", spieler.id(), id);
        return tischService.betreteTisch(id, spieler);
    }

    @PostMapping("/{id}/verlassen")
    public BestaetigungAntwort verlasseTisch(@PathVariable UUID id, HttpServletRequest request) {
        SpielerEntity spieler = ladeAktivenSpieler(request);
        LOGGER.info("Spieler {} verlaesst Tisch {}", spieler.id(), id);
        return tischService.verlasseTisch(id, spieler);
    }

    @PostMapping("/{id}/starten")
    public BestaetigungAntwort starteTisch(@PathVariable UUID id, HttpServletRequest request) {
        SpielerEntity spieler = ladeAktivenSpieler(request);
        LOGGER.info("Spieler {} startet Tisch {}", spieler.id(), id);
        TischAntwort antwort = tischService.starteTisch(id, spieler);
        return new BestaetigungAntwort("Tisch " + antwort.id() + " wurde gestartet.");
    }

    @GetMapping("/{id}/konfiguration")
    public TischKonfigurationDto gibKonfiguration(@PathVariable UUID id) {
        LOGGER.info("Konfiguration fuer Tisch {} abgefragt", id);
        return tischService.ladeKonfiguration(id);
    }

    @PutMapping("/{id}/konfiguration")
    public TischKonfigurationDto aktualisiereKonfiguration(
        @PathVariable UUID id,
        @Valid @RequestBody TischKonfigurationDto konfiguration,
        HttpServletRequest request
    ) {
        SpielerEntity spieler = ladeAktivenSpieler(request);
        LOGGER.info("Spieler {} aktualisiert die Konfiguration von Tisch {}", spieler.id(), id);
        return tischService.aktualisiereKonfiguration(id, spieler, konfiguration);
    }

    private SpielerEntity ladeAktivenSpieler(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session == null) {
            throw new SpielerSessionUngueltigException("Es ist keine aktive Spieler-Session vorhanden.");
        }
        spielerSessionService.uebernehmeTimeout(session);
        return spielerSessionService.ladeAktivenSpieler(session.getId());
    }
}
