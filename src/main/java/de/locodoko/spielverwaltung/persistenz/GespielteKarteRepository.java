package de.locodoko.spielverwaltung.persistenz;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface GespielteKarteRepository extends JpaRepository<GespielteKarteEntity, UUID> {

    List<GespielteKarteEntity> findAllByStich_IdOrderByReihenfolgeAsc(UUID stichId);
}
