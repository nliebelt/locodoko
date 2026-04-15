package de.locodoko.tisch.persistenz;

import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.CrudRepository;

import java.util.List;
import java.util.UUID;

/**
 * Repository fuer GespielteKarteEntity.
 * GespielteKarteEntity ist ein Kind von StichEntity, kann aber separat gelesen werden.
 */
public interface GespielteKarteRepository extends CrudRepository<GespielteKarteEntity, UUID> {

    /** Liefert alle gespielten Karten eines Stichs, sortiert nach Reihenfolge. */
    @Query("SELECT * FROM gespielte_karte WHERE stich_id = :stichId ORDER BY reihenfolge ASC")
    List<GespielteKarteEntity> findAllByStich_IdOrderByReihenfolgeAsc(UUID stichId);
}
