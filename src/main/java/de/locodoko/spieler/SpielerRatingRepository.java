package de.locodoko.spieler;

import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.CrudRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Repository fuer das globale TrueSkill-Rating (eine Zeile pro Spieler). */
public interface SpielerRatingRepository extends CrudRepository<SpielerRating, UUID> {

    @Query("SELECT * FROM spieler_rating WHERE spieler_id = :spielerId")
    Optional<SpielerRating> findBySpielerId(UUID spielerId);

    @Query("SELECT * FROM spieler_rating WHERE anzahl_spiele > 0 ORDER BY (rating_mu - 3 * rating_sigma) DESC LIMIT 50")
    List<SpielerRating> findTopGeordertNachRating();
}
