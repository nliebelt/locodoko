package de.locodoko.lobby;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repository fuer TischEntity.
 * Standalone Aggregate Root.
 * Benoetigt eine benutzerdefinierte Implementierung, um transiente Felder
 * (Spielerliste, Partie, erstelltVon) nach dem Laden zu befuellen.
 */
public interface TischRepository {

    /** Speichert den Tisch und gibt die gespeicherte Instanz zurueck. */
    TischEntity save(TischEntity tisch);

    /** Speichert den Tisch und gibt die gespeicherte Instanz zurueck (JDBC flush sofort). */
    TischEntity saveAndFlush(TischEntity tisch);

    /** Loescht den Tisch und alle zugehoerigen Daten (Kaskade via FK). */
    void delete(TischEntity tisch);

    /** Loescht den Tisch anhand seiner ID. */
    void deleteById(UUID id);

    /** Speichert alle Aenderungen sofort in die DB. */
    void flush();

    /** Sucht einen Tisch anhand seiner ID (mit befuellten transienten Feldern). */
    Optional<TischEntity> findById(UUID id);

    /** Sucht einen Tisch anhand seiner ID mit Datenbanksperre (PESSIMISTIC_WRITE). */
    Optional<TischEntity> findByIdWithLock(UUID id);

    /** Liefert alle Tische mit dem angegebenen Status, sortiert nach Erstellungszeitpunkt. */
    List<TischEntity> findAllByStatusOrderByErstelltAmAsc(TischStatus status);

    /** Sucht den Tisch, an dem der Spieler mit der gegebenen ID sitzt. */
    Optional<TischEntity> findBySpieler_Id(UUID spielerId);

    /** Sucht den Tisch, der eine bestimmte Partie referenziert. */
    Optional<TischEntity> findByPartieId(UUID partieId);

    /** Prueft, ob ein Spieler mit der gegebenen Session-ID an einem Tisch sitzt. */
    boolean existsBySpieler_SessionId(String sessionId);

    /** Zaehlt alle Tische. */
    long count();

    /** Prueft ob ein Tisch mit der gegebenen ID existiert. */
    boolean existsById(UUID id);
}
