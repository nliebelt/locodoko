package de.locodoko.tisch;

import de.locodoko.spieler.LocodokoBenutzerdienst;
import de.locodoko.spieler.SpielerRepository;
import jakarta.servlet.http.HttpSession;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.UUID;

/**
 * ABAC-Component fuer Tisch-bezogene Autorisierung.
 * Wird in {@code @PreAuthorize}-Ausdruecken verwendet:
 * {@code @PreAuthorize("@tischSicherheit.istGastgeber(#tischId, authentication)")}
 *
 * <p>Unterstuetzt drei Authentifizierungs-Wege:
 * <ol>
 *   <li>Spring Security Principal ({@link LocodokoBenutzerdienst.SpielerUserDetails}) — Passwort-Login</li>
 *   <li>OAuth2-Principal ({@link OAuth2User}) — Google-Login</li>
 *   <li>Session-Fallback — Gast-Spieler ohne Spring-Security-Kontext</li>
 * </ol>
 * Prueft Beziehungen direkt am Tisch-Aggregat — keine eigenen ACL-Tabellen noetig.</p>
 */
@Component("tischSicherheit")
public class TischSicherheit {

    private final TischRepository tischRepository;
    private final SpielerRepository spielerRepository;

    public TischSicherheit(TischRepository tischRepository, SpielerRepository spielerRepository) {
        this.tischRepository = tischRepository;
        this.spielerRepository = spielerRepository;
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

    /**
     * Extrahiert die Spieler-ID aus dem aktuellen Sicherheitskontext.
     * Prueft zuerst Spring-Security-Principal, dann OAuth2, dann Session-Fallback.
     */
    private UUID extrahiereSpielerId(Authentication authentication) {
        // 1. Passwort-Login: Spring Security Principal
        if (authentication != null && !(authentication instanceof AnonymousAuthenticationToken)
            && authentication.getPrincipal() instanceof LocodokoBenutzerdienst.SpielerUserDetails details) {
            return details.spielerId();
        }

        // 2. OAuth2-Login: Sub-Attribut aus dem OAuth2-Principal
        if (authentication != null && !(authentication instanceof AnonymousAuthenticationToken)
            && authentication.getPrincipal() instanceof OAuth2User oauth2User) {
            String sub = oauth2User.getAttribute("sub");
            if (sub != null) {
                return spielerRepository.findByExternalId(sub)
                    .map(spieler -> spieler.id())
                    .orElse(null);
            }
        }

        // 3. Session-Fallback: Gast-Spieler mit HTTP-Session (kein Spring-Security-Kontext)
        ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attrs != null) {
            HttpSession session = attrs.getRequest().getSession(false);
            if (session != null) {
                return spielerRepository.findBySessionId(session.getId())
                    .filter(spieler -> !spieler.istKi())
                    .map(spieler -> spieler.id())
                    .orElse(null);
            }
        }

        return null;
    }
}
