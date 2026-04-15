package de.locodoko.spieler;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/** Stellt den BCrypt-PasswordEncoder bereit (Kostenfaktor 12, OWASP-konform). */
@Configuration
public class PasswortKonfiguration {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }
}
