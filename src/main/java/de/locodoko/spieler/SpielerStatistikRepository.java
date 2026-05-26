package de.locodoko.spieler;

import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.CrudRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Repository fuer SpielerStatistik (eine Zeile pro Spieler und Regelvariante). */
public interface SpielerStatistikRepository extends CrudRepository<SpielerStatistik, UUID> {

    @Query("SELECT * FROM spieler_statistik WHERE spieler_id = :spielerId")
    List<SpielerStatistik> findBySpielerId(UUID spielerId);

    @Query("SELECT * FROM spieler_statistik WHERE spieler_id = :spielerId AND regelvariante = :regelvariante")
    Optional<SpielerStatistik> findBySpielerIdAndRegelvariante(UUID spielerId, String regelvariante);
}
