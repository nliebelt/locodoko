package de.locodoko.tisch;

import de.locodoko.spieler.SpielerEntity;
import de.locodoko.spieler.SpielerRepository;
import de.locodoko.spieler.SpielerSessionService;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * ABAC-Component fuer Tisch-bezogene Autorisierung.
 * Wird in {@code @PreAuthorize}-Ausdruecken verwendet:
 * {@code @PreAuthorize("@tischSicherheit.istGastgeber(#tischId, authentication)")}
 *
 * <p>Prueft Beziehungen direkt am Tisch-Aggregat — keine eigenen ACL-Tabellen noetig.</p>
 */
@Component("tischSicherheit")
public class TischSicherheit {

    private final TischRepository tischRepository;

    public TischSicherheit(TischRepository tischRepository) {
        this.tischRepository = tischRepository;
    }

    /** Prueft ob der authentifizierte Spieler Gastgeber (Ersteller) des Tisches ist. */
    public boolean istGastgeber(UUID tischId, Authentication authentication) {
        UUID spielerId = extrahiereSpielerId(authentication);
        if (spielerId == null) {
            return false;
        }
        return tischRepository.findById(TischId.von(tischId))
            .map(tisch -> spielerId.equals(tisch.erstelltVonSpielerId()))
            .orElse(false);
    }

    /** Prueft ob der authentifizierte Spieler Mitglied (Teilnehmer) des Tisches ist. */
    public boolean hatZugang(UUID tischId, Authentication authentication) {
        UUID spielerId = extrahiereSpielerId(authentication);
        if (spielerId == null) {
            return false;
        }
        return tischRepository.findById(TischId.von(tischId))
            .map(tisch -> tisch.spieler().stream()
                .anyMatch(s -> spielerId.equals(s.id())))
            .orElse(false);
    }

    private UUID extrahiereSpielerId(Authentication authentication) {
        if (authentication == null || authentication.getPrincipal() == null) {
            return null;
        }
        Object principal = authentication.getPrincipal();
        if (principal instanceof de.locodoko.spieler.LocodokoBenutzerdienst.SpielerUserDetails details) {
            return details.spielerId();
        }
        return null;
    }
}
