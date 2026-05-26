package de.locodoko.tisch.persistenz;

import de.locodoko.partie.SpielergebnisArchiv;

import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.CrudRepository;

import java.util.List;
import java.util.UUID;

/**
 * Repository fuer {@link SpielergebnisArchiv}.
 *
 * <p>SpielergebnisArchiv ist ein Kind von Partie, hat aber eine eigene {@code @Id}
 * und kann separat gelesen werden. Schreiboperationen laufen ueber
 * {@link PartieRepository} (Cascade-Save).</p>
 */
public interface SpielergebnisArchivRepository extends CrudRepository<SpielergebnisArchiv, UUID> {

    /** Liefert alle Spielergebnis-Archive einer Partie, sortiert nach Spielnummer. */
    @Query("SELECT * FROM spielergebnis_archiv WHERE partie_id = :partieId ORDER BY spiel_nummer ASC")
    List<SpielergebnisArchiv> findByPartieIdOrderBySpielNummer(UUID partieId);

    /** Liefert alle Spielergebnis-Archive einer Partie (ungeordnet). */
    @Query("SELECT * FROM spielergebnis_archiv WHERE partie_id = :partieId")
    List<SpielergebnisArchiv> findByPartieId(UUID partieId);
}
