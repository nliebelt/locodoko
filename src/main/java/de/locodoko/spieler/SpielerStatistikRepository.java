package de.locodoko.spieler;

import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.CrudRepository;

import java.util.Optional;
import java.util.UUID;

/** Repository fuer SpielerStatistik (1:1 mit Spieler). */
public interface SpielerStatistikRepository extends CrudRepository<SpielerStatistik, UUID> {

    @Query("SELECT * FROM spieler_statistik WHERE spieler_id = :spielerId")
    Optional<SpielerStatistik> findBySpielerId(UUID spielerId);
}
