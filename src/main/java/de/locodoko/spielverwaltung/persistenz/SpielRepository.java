package de.locodoko.spielverwaltung.persistenz;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface SpielRepository extends JpaRepository<SpielEntity, UUID> {

    List<SpielEntity> findAllByPartie_IdOrderBySpielNummerAsc(UUID partieId);
}
