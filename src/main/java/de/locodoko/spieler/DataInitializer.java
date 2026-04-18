package de.locodoko.spieler;

import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Initialisiert einen Testbenutzer für die Entwicklungsumgebung.
 */
@Component
@Profile("dev")
public class DataInitializer implements CommandLineRunner {

    private final SpielerRepository spielerRepository;
    private final PasswordEncoder passwordEncoder;

    public DataInitializer(SpielerRepository spielerRepository, PasswordEncoder passwordEncoder) {
        this.spielerRepository = spielerRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        if (spielerRepository.findByBenutzername("Nils").isEmpty()) {
            SpielerEntity testSpieler = SpielerEntity.mitPasswort(
                "Nils", 
                passwordEncoder.encode("Test1234#"),
                ""
            );
            spielerRepository.save(testSpieler);
        }
    }
}
