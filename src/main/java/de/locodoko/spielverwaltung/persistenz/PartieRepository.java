package de.locodoko.spielverwaltung.persistenz;

import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.CrudRepository;

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

    /** Zaehlt alle Partien. */
    long count();
}
