package de.locodoko.spielverwaltung.persistenz;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface StichRepository extends JpaRepository<StichEntity, UUID> {

    List<StichEntity> findAllBySpiel_IdOrderByStichNummerAsc(UUID spielId);
}
