package de.locodoko.tisch.persistenz;

import de.locodoko.partie.PartieId;

import org.springframework.data.repository.CrudRepository;

import java.util.Optional;
import java.util.UUID;

/**
 * Repository fuer PartieEntity.
 * Standalone Aggregate Root — PartieEntity besitzt SpielEntity-Kinder via @MappedCollection.
 */
public interface PartieRepository extends CrudRepository<PartieEntity, UUID> {

    /** Speichert die Partie und gibt die gespeicherte Instanz zurueck. Alias fuer save(). */
    default PartieEntity saveAndFlush(PartieEntity partie) {
        return save(partie);
    }

    /** Sucht eine Partie anhand der typisierten ID. */
    default Optional<PartieEntity> findById(PartieId id) {
        return findById(id.wert());
    }

    /** Loescht eine Partie anhand der typisierten ID. */
    default void deleteById(PartieId id) {
        deleteById(id.wert());
    }

    /** Prueft ob eine Partie mit der typisierten ID existiert. */
    default boolean existsById(PartieId id) {
        return existsById(id.wert());
    }

    /** Zaehlt alle Partien. */
    long count();
}
