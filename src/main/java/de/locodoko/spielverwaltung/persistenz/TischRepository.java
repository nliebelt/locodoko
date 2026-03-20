package de.locodoko.spielverwaltung.persistenz;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TischRepository extends JpaRepository<TischEntity, UUID> {

    List<TischEntity> findAllByStatusOrderByErstelltAmAsc(TischStatus status);

    Optional<TischEntity> findBySpieler_Id(UUID spielerId);

    boolean existsBySpieler_SessionId(String sessionId);
}
