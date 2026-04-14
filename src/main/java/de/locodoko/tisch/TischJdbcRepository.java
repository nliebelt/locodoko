package de.locodoko.tisch;

import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.CrudRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Interne Spring Data JDBC Repository-Schnittstelle fuer TischEntity.
 * Wird nur von TischRepositoryImpl verwendet.
 * Oeffentliche Operationen gehen ueber TischRepository.
 */
interface TischJdbcRepository extends CrudRepository<TischEntity, UUID> {

    /**
     * Liefert alle Tische mit dem angegebenen Status-String, sortiert nach Erstellungszeitpunkt.
     * Der Status wird als String uebergeben, da @Column("status") einen String speichert.
     */
    @Query("SELECT * FROM tisch WHERE status = :status ORDER BY erstellt_am ASC")
    List<TischEntity> findAllByStatusOrderByErstelltAmAsc(String status);

    /**
     * Sucht den Tisch, an dem der Spieler mit der gegebenen ID sitzt.
     */
    @Query("SELECT t.* FROM tisch t INNER JOIN tisch_spieler ts ON t.id = ts.tisch_id WHERE ts.spieler_id = :spielerId")
    Optional<TischEntity> findBySpielerId(UUID spielerId);

    /**
     * Prueft, ob ein Spieler mit der gegebenen Session-ID an einem Tisch sitzt.
     */
    @Query("SELECT COUNT(*) > 0 FROM tisch t " +
        "INNER JOIN tisch_spieler ts ON t.id = ts.tisch_id " +
        "INNER JOIN spieler s ON ts.spieler_id = s.id " +
        "WHERE s.session_id = :sessionId")
    boolean existsBySpielersessionId(String sessionId);

    /**
     * Sucht den Tisch, der eine bestimmte Partie referenziert.
     */
    @Query("SELECT * FROM tisch WHERE partie_id = :partieId")
    Optional<TischEntity> findByPartieId(UUID partieId);

    /**
     * Sucht einen Tisch anhand seines Einladungscodes.
     */
    @Query("SELECT * FROM tisch WHERE einladungs_code = :einladungsCode")
    Optional<TischEntity> findByEinladungsCode(String einladungsCode);
}
