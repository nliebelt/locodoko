package de.locodoko.spieler;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * REST-Controller fuer Spieler-Profile ({@code /api/spieler/{id}/profil}).
 */
@Tag(name = "Profil", description = "Oeffentliches Spieler-Profil mit Statistiken und letzten Partien")
@RestController
@RequestMapping("/api/spieler")
public class SpielerProfilController {

    private final SpielerRepository spielerRepository;
    private final SpielerProfilService spielerProfilService;

    public SpielerProfilController(SpielerRepository spielerRepository,
                                    SpielerProfilService spielerProfilService) {
        this.spielerRepository = spielerRepository;
        this.spielerProfilService = spielerProfilService;
    }

    @Operation(summary = "Spieler-Profil abrufen", description = "Gibt das oeffentliche Profil eines Spielers mit Statistiken und letzten Partie-Ergebnissen zurueck.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Profil erfolgreich abgerufen"),
        @ApiResponse(responseCode = "404", description = "Spieler nicht gefunden")
    })
    @GetMapping("/{id}/profil")
    public ResponseEntity<SpielerProfilAntwort> ladeProfil(@PathVariable UUID id) {
        return spielerRepository.findById(id)
            .map(spieler -> {
                SpielerStatistik statistik = spielerProfilService.ladeStatistik(id);
                List<PartieErgebnisEintrag> partieErgebnisse = spielerProfilService.ladePartieErgebnisse(id);
                return ResponseEntity.ok(SpielerProfilAntwort.aus(spieler, statistik, partieErgebnisse));
            })
            .orElse(ResponseEntity.notFound().build());
    }

    @Operation(summary = "Spieler-Profil aktualisieren", description = "Aktualisiert Anzeigename und/oder Avatar-Farbe.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Profil erfolgreich aktualisiert"),
        @ApiResponse(responseCode = "404", description = "Spieler nicht gefunden")
    })
    @PutMapping("/{id}/profil")
    public ResponseEntity<SpielerProfilAntwort> aktualisiereProfil(
        @PathVariable UUID id,
        @RequestBody ProfilAktualisierungAnfrage anfrage
    ) {
        return spielerRepository.findById(id)
            .map(spieler -> {
                if (anfrage.anzeigeName() != null) {
                    spieler.setzeAnzeigeName(anfrage.anzeigeName());
                }
                if (anfrage.avatarFarbe() != null) {
                    spieler.setzeAvatarFarbe(anfrage.avatarFarbe());
                }
                spielerRepository.save(spieler);
                SpielerStatistik statistik = spielerProfilService.ladeStatistik(id);
                List<PartieErgebnisEintrag> partieErgebnisse = spielerProfilService.ladePartieErgebnisse(id);
                return ResponseEntity.ok(SpielerProfilAntwort.aus(spieler, statistik, partieErgebnisse));
            })
            .orElse(ResponseEntity.notFound().build());
    }

    record ProfilAktualisierungAnfrage(String anzeigeName, String avatarFarbe) {}
}
