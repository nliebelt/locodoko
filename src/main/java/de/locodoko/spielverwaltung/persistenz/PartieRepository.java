package de.locodoko.spielverwaltung.persistenz;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface PartieRepository extends JpaRepository<PartieEntity, UUID> {
}
