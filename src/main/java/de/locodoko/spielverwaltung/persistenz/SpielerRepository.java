package de.locodoko.spielverwaltung.persistenz;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SpielerRepository extends JpaRepository<SpielerEntity, UUID> {

    Optional<SpielerEntity> findBySessionId(String sessionId);

    List<SpielerEntity> findAllByKiTrueOrderByErstelltAmAsc();
}
