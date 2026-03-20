package de.locodoko.spielverwaltung.session;

import de.locodoko.spielverwaltung.persistenz.SpielerEntity;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/spieler/session")
public class SpielerSessionController {

    public static final String AKTUELLER_SPIELER_ATTRIBUT = "aktuellerSpieler";

    private final SpielerSessionService spielerSessionService;

    public SpielerSessionController(SpielerSessionService spielerSessionService) {
        this.spielerSessionService = spielerSessionService;
    }

    @PostMapping
    public ResponseEntity<SpielerSessionAntwort> registriereSpieler(
        @Valid @RequestBody SpielerNameAnfrage anfrage,
        HttpServletRequest request
    ) {
        SpielerRegistrierung registrierung = spielerSessionService.registriereSpieler(request, anfrage.name());
        HttpStatus status = registrierung.neuAngelegt() ? HttpStatus.CREATED : HttpStatus.OK;
        return ResponseEntity.status(status).body(SpielerSessionAntwort.aus(registrierung.spieler()));
    }

    @GetMapping
    public SpielerSessionAntwort gibAktuellenSpieler(HttpServletRequest request) {
        return SpielerSessionAntwort.aus(aktuellerSpieler(request));
    }

    @PutMapping
    public SpielerSessionAntwort aendereNamen(
        @Valid @RequestBody SpielerNameAnfrage anfrage,
        HttpServletRequest request
    ) {
        HttpSession session = request.getSession(false);
        SpielerEntity spieler = spielerSessionService.aendereNamen(session.getId(), anfrage.name());
        request.setAttribute(AKTUELLER_SPIELER_ATTRIBUT, spieler);
        return SpielerSessionAntwort.aus(spieler);
    }

    private SpielerEntity aktuellerSpieler(HttpServletRequest request) {
        return (SpielerEntity) request.getAttribute(AKTUELLER_SPIELER_ATTRIBUT);
    }
}
