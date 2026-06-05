package de.locodoko.spieler;

import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.CrudRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repository fuer SpielerEntity.
 * Standalone Aggregate Root — Spieler werden unabhaengig gespeichert.
 */
public interface SpielerRepository extends CrudRepository<SpielerEntity, UUID> {

    /** Speichert den Spieler und gibt die gespeicherte Instanz zurueck (Alias fuer save). */
    default SpielerEntity saveAndFlush(SpielerEntity spieler) {
        return save(spieler);
    }

    /** Sucht einen Spieler anhand der typisierten ID. */
    default Optional<SpielerEntity> findById(SpielerId id) {
        return findById(id.wert());
    }

    /** Prueft ob ein Spieler mit der typisierten ID existiert. */
    default boolean existsById(SpielerId id) {
        return existsById(id.wert());
    }

    /** Sucht einen Spieler anhand seiner HTTP-Session-ID. */
    @Query("SELECT * FROM spieler WHERE session_id = :sessionId")
    Optional<SpielerEntity> findBySessionId(String sessionId);

    /** Sucht einen Spieler anhand seines Benutzernamens (fuer Passwort-Auth). */
    @Query("SELECT * FROM spieler WHERE benutzername = :benutzername")
    Optional<SpielerEntity> findByBenutzername(String benutzername);

    /** Sucht einen Spieler anhand seiner OAuth2-External-ID (z.B. Google-Sub). */
    @Query("SELECT * FROM spieler WHERE external_id = :externalId")
    Optional<SpielerEntity> findByExternalId(String externalId);

    /** Sucht einen Spieler anhand seiner Email-Adresse (fuer Passwort-Reset). */
    @Query("SELECT * FROM spieler WHERE email = :email")
    Optional<SpielerEntity> findByEmail(String email);

    /** Sucht einen Spieler anhand seines Email-Verifizierungstokens. */
    @Query("SELECT * FROM spieler WHERE email_verification_token = :token")
    Optional<SpielerEntity> findByEmailVerificationToken(String token);

    /** Sucht einen Spieler anhand seines Passwort-Reset-Tokens. */
    @Query("SELECT * FROM spieler WHERE password_reset_token = :token")
    Optional<SpielerEntity> findByPasswordResetToken(String token);

    /** Liefert alle KI-Spieler sortiert nach Erstellungszeitpunkt. */
    @Query("SELECT * FROM spieler WHERE ki = true ORDER BY erstellt_am ASC")
    List<SpielerEntity> findAllByKiTrueOrderByErstelltAmAsc();
}
