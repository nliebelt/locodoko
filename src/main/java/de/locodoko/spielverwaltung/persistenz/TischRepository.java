package de.locodoko.spielverwaltung.persistenz;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TischRepository extends JpaRepository<TischEntity, UUID> {

    List<TischEntity> findAllByStatusOrderByErstelltAmAsc(TischStatus status);

    Optional<TischEntity> findBySpieler_Id(UUID spielerId);

    boolean existsBySpieler_SessionId(String sessionId);

    /**
     * Laedt einen Tisch mit exklusiver Datenbanksperre (PESSIMISTIC_WRITE).
     * Verhindert gleichzeitige Beitritts- und Startanfragen, die sonst die
     * Spieleranzahl-Pruefung (istVoll) und den Status-Check (WARTEND) umgehen koennten.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT t FROM TischEntity t WHERE t.id = :id")
    Optional<TischEntity> findByIdWithLock(@Param("id") UUID id);
}
