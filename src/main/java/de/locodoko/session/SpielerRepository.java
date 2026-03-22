package de.locodoko.session;

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

    /** Sucht einen Spieler anhand seiner HTTP-Session-ID. */
    @Query("SELECT * FROM spieler WHERE session_id = :sessionId")
    Optional<SpielerEntity> findBySessionId(String sessionId);

    /** Liefert alle KI-Spieler sortiert nach Erstellungszeitpunkt. */
    @Query("SELECT * FROM spieler WHERE ki = true ORDER BY erstellt_am ASC")
    List<SpielerEntity> findAllByKiTrueOrderByErstelltAmAsc();
}
