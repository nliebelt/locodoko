package de.locodoko.spieler;

import org.springframework.data.jdbc.repository.query.Modifying;
import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.CrudRepository;

import java.util.List;
import java.util.UUID;

/** Repository fuer PartieErgebnisEintrag (max. 20 pro Spieler, nach Datum sortiert). */
public interface PartieErgebnisRepository extends CrudRepository<PartieErgebnisEintrag, UUID> {

    @Query("SELECT * FROM partie_ergebnis WHERE spieler_id = :spielerId ORDER BY datum DESC")
    List<PartieErgebnisEintrag> findBySpielerId(UUID spielerId);

    @Query("SELECT COUNT(*) FROM partie_ergebnis WHERE spieler_id = :spielerId")
    int zaehleProSpieler(UUID spielerId);

    /** Loescht den aeltesten Eintrag eines Spielers (nach Datum aufsteigend, LIMIT 1). */
    @Modifying
    @Query("DELETE FROM partie_ergebnis WHERE id = (SELECT id FROM partie_ergebnis WHERE spieler_id = :spielerId ORDER BY datum ASC LIMIT 1)")
    void loescheAeltestenEintrag(UUID spielerId);
}
