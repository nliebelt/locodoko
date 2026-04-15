package de.locodoko.tisch.persistenz;

import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.CrudRepository;

import java.util.List;
import java.util.UUID;

/**
 * Repository fuer StichEntity.
 * StichEntity ist ein Kind von SpielEntity, kann aber separat gelesen werden.
 */
public interface StichRepository extends CrudRepository<StichEntity, UUID> {

    /** Liefert alle Stiche eines Spiels, sortiert nach Stichnummer. */
    @Query("SELECT * FROM stich WHERE spiel_id = :spielId ORDER BY stich_nummer ASC")
    List<StichEntity> findAllBySpiel_IdOrderByStichNummerAsc(UUID spielId);

    /** Zaehlt alle Stiche. */
    long count();
}
