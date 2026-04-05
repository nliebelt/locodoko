package de.locodoko.lobby;

import de.locodoko.session.SpielerEntity;
import de.locodoko.session.SpielerSessionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
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

/**
 * REST-Controller fuer die Lobby-Tischverwaltung ({@code /api/tische}).
 *
 * <p>Stellt Endpunkte zum Auflisten, Erstellen, Beitreten, Verlassen und Starten von Tischen
 * sowie zum Lesen und Aktualisieren der Tischkonfiguration bereit. Alle schreibenden Aktionen
 * validieren die HTTP-Session des Spielers ueber {@link SpielerSessionService}.</p>
 */
@Tag(name = "Tische", description = "Lobby: Tische erstellen, beitreten, verlassen und starten")
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

    @Operation(summary = "Alle offenen Tische abrufen", description = "Gibt eine Liste aller Tische zurueck, denen noch Spieler beitreten koennen.")
    @ApiResponse(responseCode = "200", description = "Liste der offenen Tische")
    @GetMapping
    public List<TischListenEintragAntwort> listeTische() {
        LOGGER.info("Offene Tischliste abgefragt");
        return tischService.listeOffeneTische();
    }

    @Operation(summary = "Neuen Tisch erstellen", description = "Erstellt einen neuen Tisch mit dem angegebenen Namen und der Konfiguration. Der anfragende Spieler wird automatisch Ersteller und Teilnehmer.")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Tisch erfolgreich erstellt"),
        @ApiResponse(responseCode = "400", description = "Ungueltige Anfrage (fehlender Name, ungueltiger Parameter)"),
        @ApiResponse(responseCode = "401", description = "Keine gueltige Spieler-Session")
    })
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

    @Operation(summary = "Einzelnen Tisch abrufen", description = "Gibt den Tisch mit der angegebenen ID zurueck.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Tisch gefunden"),
        @ApiResponse(responseCode = "404", description = "Tisch nicht gefunden")
    })
    @GetMapping("/{id}")
    public TischAntwort ladeTisch(@Parameter(description = "Tisch-ID") @PathVariable UUID id) {
        LOGGER.info("Tisch {} abgefragt", id);
        return tischService.ladeTisch(id);
    }

    @Operation(summary = "Tisch beitreten", description = "Fuegt den anfragenden Spieler einem bestehenden Tisch hinzu.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Erfolgreich beigetreten"),
        @ApiResponse(responseCode = "401", description = "Keine gueltige Spieler-Session"),
        @ApiResponse(responseCode = "404", description = "Tisch nicht gefunden"),
        @ApiResponse(responseCode = "409", description = "Tisch voll oder Partie bereits gestartet")
    })
    @PostMapping("/{id}/beitreten")
    public TischAntwort betreteTisch(@Parameter(description = "Tisch-ID") @PathVariable UUID id, HttpServletRequest request) {
        SpielerEntity spieler = ladeAktivenSpieler(request);
        LOGGER.info("Spieler {} tritt Tisch {} bei", spieler.id(), id);
        return tischService.betreteTisch(id, spieler);
    }

    @Operation(summary = "Tisch verlassen", description = "Entfernt den anfragenden Spieler vom Tisch. Laeuft eine Partie, wird sie abgebrochen.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Tisch erfolgreich verlassen"),
        @ApiResponse(responseCode = "401", description = "Keine gueltige Spieler-Session"),
        @ApiResponse(responseCode = "404", description = "Tisch nicht gefunden")
    })
    @PostMapping("/{id}/verlassen")
    public BestaetigungAntwort verlasseTisch(@Parameter(description = "Tisch-ID") @PathVariable UUID id, HttpServletRequest request) {
        SpielerEntity spieler = ladeAktivenSpieler(request);
        LOGGER.info("Spieler {} verlaesst Tisch {}", spieler.id(), id);
        return tischService.verlasseTisch(id, spieler);
    }

    @Operation(summary = "Spiel starten", description = "Startet das Spiel am Tisch. Fehlende Spieler werden durch KI-Spieler aufgefuellt. Nur der Tischersteller kann starten.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Spiel erfolgreich gestartet"),
        @ApiResponse(responseCode = "401", description = "Keine gueltige Spieler-Session oder kein Tischersteller"),
        @ApiResponse(responseCode = "404", description = "Tisch nicht gefunden"),
        @ApiResponse(responseCode = "409", description = "Spiel laeuft bereits")
    })
    @PostMapping("/{id}/starten")
    public BestaetigungAntwort starteTisch(@Parameter(description = "Tisch-ID") @PathVariable UUID id, HttpServletRequest request) {
        SpielerEntity spieler = ladeAktivenSpieler(request);
        LOGGER.info("Spieler {} startet Tisch {}", spieler.id(), id);
        TischAntwort antwort = tischService.starteTisch(id, spieler);
        return new BestaetigungAntwort("Tisch " + antwort.id() + " wurde gestartet.");
    }

    @Operation(summary = "Neue Partie starten", description = "Startet eine neue Partie an einem Tisch, dessen letzte Partie beendet ist. Idempotent — kann mehrfach aufgerufen werden.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Neue Partie gestartet"),
        @ApiResponse(responseCode = "401", description = "Keine gueltige Spieler-Session"),
        @ApiResponse(responseCode = "404", description = "Tisch nicht gefunden"),
        @ApiResponse(responseCode = "409", description = "Partie noch nicht beendet")
    })
    @PostMapping("/{id}/neue-partie")
    public BestaetigungAntwort starteNeuePartie(@Parameter(description = "Tisch-ID") @PathVariable UUID id, HttpServletRequest request) {
        SpielerEntity spieler = ladeAktivenSpieler(request);
        LOGGER.info("Spieler {} startet neue Partie an Tisch {}", spieler.id(), id);
        return tischService.starteNeuePartie(id, spieler);
    }

    @Operation(summary = "Tischkonfiguration abrufen", description = "Gibt alle Spielregeln des Tisches zurueck (Trumpfreihenfolge, Sonderpunkte, Timeouts etc.).")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Konfiguration erfolgreich abgerufen"),
        @ApiResponse(responseCode = "404", description = "Tisch nicht gefunden")
    })
    @GetMapping("/{id}/konfiguration")
    public TischKonfigurationDto gibKonfiguration(@Parameter(description = "Tisch-ID") @PathVariable UUID id) {
        LOGGER.info("Konfiguration fuer Tisch {} abgefragt", id);
        return tischService.ladeKonfiguration(id);
    }

    @Operation(summary = "Tischkonfiguration aktualisieren", description = "Aendert die Spielregeln des Tisches. Nur moeglich, solange noch keine Partie laeuft. Nur der Tischersteller kann die Konfiguration aendern.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Konfiguration erfolgreich aktualisiert"),
        @ApiResponse(responseCode = "400", description = "Ungueltige Konfiguration"),
        @ApiResponse(responseCode = "401", description = "Keine gueltige Spieler-Session oder kein Tischersteller"),
        @ApiResponse(responseCode = "404", description = "Tisch nicht gefunden"),
        @ApiResponse(responseCode = "409", description = "Partie laeuft bereits, Konfiguration nicht mehr aenderbar")
    })
    @PutMapping("/{id}/konfiguration")
    public TischKonfigurationDto aktualisiereKonfiguration(
        @Parameter(description = "Tisch-ID") @PathVariable UUID id,
        @Valid @RequestBody TischKonfigurationDto konfiguration,
        HttpServletRequest request
    ) {
        SpielerEntity spieler = ladeAktivenSpieler(request);
        LOGGER.info("Spieler {} aktualisiert die Konfiguration von Tisch {}", spieler.id(), id);
        return tischService.aktualisiereKonfiguration(id, spieler, konfiguration);
    }

    private SpielerEntity ladeAktivenSpieler(HttpServletRequest request) {
        return spielerSessionService.ladeAktivenSpieler(request);
    }
}
