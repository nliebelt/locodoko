package de.locodoko.spieler;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST-Controller fuer Authentifizierung ({@code /api/auth}).
 * Stellt Registrierung und Login mit Benutzername/Passwort bereit.
 * OAuth2-Login laeuft ueber Spring Security direkt (/login/oauth2/code/google).
 */
@Tag(name = "Authentifizierung", description = "Registrierung und Login")
@RestController
@RequestMapping("/api/auth")
public class AuthentifizierungsController {

    private static final Logger LOGGER = LoggerFactory.getLogger(AuthentifizierungsController.class);

    private final SpielerRepository spielerRepository;
    private final PasswordEncoder passwordEncoder;
    private final SpielerSessionEigenschaften eigenschaften;

    @Value("${spring.security.oauth2.client.registration.google.client-id:disabled}")
    private String googleClientId;

    public AuthentifizierungsController(SpielerRepository spielerRepository,
                                        PasswordEncoder passwordEncoder,
                                        SpielerSessionEigenschaften eigenschaften) {
        this.spielerRepository = spielerRepository;
        this.passwordEncoder = passwordEncoder;
        this.eigenschaften = eigenschaften;
    }

    @Operation(summary = "Auth-Konfiguration abfragen", description = "Liefert, welche Login-Methoden aktiviert sind.")
    @ApiResponse(responseCode = "200", description = "Konfiguration")
    @GetMapping("/konfiguration")
    public ResponseEntity<AuthKonfigurationAntwort> gibKonfiguration() {
        boolean googleAktiv = googleClientId != null
            && !googleClientId.isBlank()
            && !googleClientId.equals("disabled");
        return ResponseEntity.ok(new AuthKonfigurationAntwort(googleAktiv));
    }

    public record AuthKonfigurationAntwort(boolean googleOAuth2Aktiv) {}

    @Operation(summary = "Neuen Spieler registrieren", description = "Erstellt einen neuen Spieler mit Benutzername und Passwort. Loggt den Spieler automatisch ein.")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Registrierung erfolgreich"),
        @ApiResponse(responseCode = "400", description = "Ungueltige Eingabe"),
        @ApiResponse(responseCode = "409", description = "Benutzername bereits vergeben")
    })
    @PostMapping("/register")
    public ResponseEntity<AuthentifizierungsAntwort> registrieren(
        @Valid @RequestBody RegistrierungsAnfrage anfrage,
        HttpServletRequest request
    ) {
        if (spielerRepository.findByBenutzername(anfrage.benutzername()).isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT).build();
        }

        String passwortHash = passwordEncoder.encode(anfrage.passwort());
        SpielerEntity spieler = SpielerEntity.mitPasswort(anfrage.benutzername(), passwortHash, anfrage.email());

        HttpSession session = request.getSession(true);
        spieler.setzeSessionId(session.getId());
        session.setMaxInactiveInterval((int) eigenschaften.getTimeout().toSeconds());

        spieler = spielerRepository.saveAndFlush(spieler);
        LOGGER.info("Neuer Spieler registriert: {} (benutzername={})", spieler.id(), anfrage.benutzername());

        return ResponseEntity.status(HttpStatus.CREATED).body(AuthentifizierungsAntwort.aus(spieler));
    }

    @Operation(summary = "Spieler einloggen", description = "Authentifiziert einen Spieler mit Benutzername und Passwort.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Login erfolgreich"),
        @ApiResponse(responseCode = "401", description = "Ungueltige Anmeldedaten"),
        @ApiResponse(responseCode = "429", description = "Zu viele Login-Versuche")
    })
    @PostMapping("/login")
    public ResponseEntity<AuthentifizierungsAntwort> einloggen(
        @Valid @RequestBody LoginAnfrage anfrage,
        HttpServletRequest request
    ) {
        SpielerEntity spieler = spielerRepository.findByBenutzername(anfrage.benutzername()).orElse(null);
        if (spieler == null || !passwordEncoder.matches(anfrage.passwort(), spieler.passwortHash())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        HttpSession session = request.getSession(true);
        spieler.setzeSessionId(session.getId());
        session.setMaxInactiveInterval((int) eigenschaften.getTimeout().toSeconds());
        spielerRepository.saveAndFlush(spieler);

        LOGGER.info("Spieler eingeloggt: {} (benutzername={})", spieler.id(), anfrage.benutzername());
        return ResponseEntity.ok(AuthentifizierungsAntwort.aus(spieler));
    }

    @Operation(summary = "Spieler ausloggen", description = "Invalidiert die aktuelle Session.")
    @ApiResponse(responseCode = "200", description = "Logout erfolgreich")
    @PostMapping("/logout")
    public ResponseEntity<Void> ausloggen(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        return ResponseEntity.ok().build();
    }
}
