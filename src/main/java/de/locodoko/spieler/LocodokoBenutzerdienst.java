package de.locodoko.spieler;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * Spring Security UserDetailsService-Implementierung.
 * Laedt Spieler anhand ihres Benutzernamens fuer Passwort-Authentifizierung.
 */
@Service
public class LocodokoBenutzerdienst implements UserDetailsService {

    private final SpielerRepository spielerRepository;

    public LocodokoBenutzerdienst(SpielerRepository spielerRepository) {
        this.spielerRepository = spielerRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String benutzername) throws UsernameNotFoundException {
        SpielerEntity spieler = spielerRepository.findByBenutzername(benutzername)
            .orElseThrow(() -> new UsernameNotFoundException(
                "Spieler mit Benutzername '%s' nicht gefunden.".formatted(benutzername)));
        return new SpielerUserDetails(spieler);
    }

    /** UserDetails-Wrapper fuer SpielerEntity. Stellt Spring Security die noetigen Felder bereit. */
    public record SpielerUserDetails(SpielerEntity spieler) implements UserDetails {

        @Override
        public Collection<? extends GrantedAuthority> getAuthorities() {
            return List.of(new SimpleGrantedAuthority("ROLE_SPIELER"));
        }

        @Override
        public String getPassword() {
            return spieler.passwortHash();
        }

        @Override
        public String getUsername() {
            return spieler.benutzername();
        }

        public UUID spielerId() {
            return spieler.id();
        }
    }
}
