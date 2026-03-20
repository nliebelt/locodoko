package de.locodoko.spielverwaltung.persistenz;

import de.locodoko.spiel.karten.SpielerPosition;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface HandRepository extends JpaRepository<HandEntity, UUID> {

    Optional<HandEntity> findBySpiel_IdAndSpielerPosition(UUID spielId, SpielerPosition spielerPosition);
}
