package de.locodoko.tisch.persistenz;

import de.locodoko.partie.SpielerPosition;

import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.CrudRepository;

import java.util.Optional;
import java.util.UUID;

/**
 * Repository fuer HandEntity.
 * HandEntity ist ein Kind von SpielEntity, kann aber separat gelesen werden.
 */
public interface HandRepository extends CrudRepository<HandEntity, UUID> {

    /** Sucht die Hand eines Spielers in einem bestimmten Spiel. */
    @Query("SELECT * FROM hand WHERE spiel_id = :spielId AND spieler_position = :#{#spielerPosition.name()}")
    Optional<HandEntity> findBySpiel_IdAndSpielerPosition(UUID spielId, SpielerPosition spielerPosition);
}
