package de.locodoko.partie;

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

    /** Zaehlt alle Spiele. */
    long count();

    /** Flush-Alias (Spring Data JDBC persistiert sofort, kein expliziter Flush noetig). */
    default void flush() {
        // Spring Data JDBC hat kein Flush-Konzept — diese Methode ist ein Kompatibilitaets-Stub
    }
}
