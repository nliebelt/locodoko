package de.locodoko.tisch.persistenz;

import de.locodoko.partie.PartieId;
import de.locodoko.partie.SpielId;

import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.CrudRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repository fuer SpielEntity.
 * SpielEntity ist ein Kind von PartieEntity, hat aber eine eigene @Id
 * und kann separat gelesen werden.
 * Schreiboperationen sollten ueber PartieRepository erfolgen.
 */
public interface SpielRepository extends CrudRepository<SpielEntity, UUID> {

    /** Liefert alle Spiele einer Partie, sortiert nach Spielnummer. */
    @Query("SELECT * FROM spiel WHERE partie_id = :partieId ORDER BY spiel_nummer ASC")
    List<SpielEntity> findAllByPartie_IdOrderBySpielNummerAsc(UUID partieId);

    /** Liefert alle Spiele einer Partie (typisierte ID), sortiert nach Spielnummer. */
    default List<SpielEntity> findAllByPartieId(PartieId partieId) {
        return findAllByPartie_IdOrderBySpielNummerAsc(partieId.wert());
    }

    /** Sucht ein Spiel anhand der typisierten ID. */
    default Optional<SpielEntity> findById(SpielId id) {
        return findById(id.wert());
    }

    /** Zaehlt alle Spiele. */
    long count();

}
