package de.locodoko.spieler;

import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.CrudRepository;

import java.util.List;
import java.util.UUID;

/** Repository fuer {@code partie_ergebnis_view} — ausschliesslich lesend. */
public interface PartieErgebnisRepository extends CrudRepository<PartieErgebnisEintrag, UUID> {

    @Query("SELECT * FROM partie_ergebnis_view WHERE spieler_id = :spielerId ORDER BY datum DESC")
    List<PartieErgebnisEintrag> findBySpielerId(UUID spielerId);
}
