package de.locodoko.partie;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Validator;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jdbc.repository.config.EnableJdbcRepositories;
import org.springframework.data.relational.core.mapping.event.BeforeConvertCallback;

import java.util.Set;

/**
 * JDBC-Konfiguration fuer Spring Data JDBC.
 * Aktiviert JDBC-Repositories im Persistenz-Package.
 * Registriert Bean-Validierung vor dem Speichern via BeforeConvertCallback,
 * damit @Min, @NotBlank und @Valid-Annotationen auf Entities und eingebetteten
 * Objekten dieselbe Schutzwirkung haben wie frueheres JPA-Hibernate-Validator.
 */
@Configuration
@EnableJdbcRepositories(basePackages = {"de.locodoko.partie", "de.locodoko.tisch", "de.locodoko.spieler"})
public class JdbcKonfiguration {

    /**
     * Validiert jede AbstraktePersistenzEntity vor dem Speichern per Bean Validation (JSR-303).
     * Kaskadiert via @Valid in eingebettete Objekte (z.B. TischkonfigurationEmbeddable).
     * Wirft ConstraintViolationException bei Regelverletzungen — identisches Verhalten zu JPA.
     */
    @Bean
    BeforeConvertCallback<AbstraktePersistenzEntity> validierungsCallback(Validator validator) {
        return entity -> {
            Set<ConstraintViolation<AbstraktePersistenzEntity>> verletzungen = validator.validate(entity);
            if (!verletzungen.isEmpty()) {
                throw new ConstraintViolationException(verletzungen);
            }
            return entity;
        };
    }
}
