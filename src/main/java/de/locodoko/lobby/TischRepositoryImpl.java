package de.locodoko.lobby;

import de.locodoko.partie.PartieId;
import de.locodoko.session.SpielerEntity;
import de.locodoko.session.SpielerId;
import de.locodoko.session.SpielerRepository;
import de.locodoko.partie.PartieEntity;
import de.locodoko.partie.PartieRepository;

import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Benutzerdefinierte Implementierung von TischRepository.
 * Kapselt die Lade- und Speicherlogik fuer TischEntity mit transienten Feldern.
 *
 * Speicherstrategie:
 * - TischEntity wird via TischJdbcRepository gespeichert (Aggregate Root)
 * - PartieEntity wird via PartieRepository gespeichert (eigenes Aggregat)
 * - Transiente Felder werden nach dem Laden befuellt
 */
@Repository
@Primary
@Transactional
class TischRepositoryImpl implements TischRepository {

    private final TischJdbcRepository tischJdbcRepository;
    private final SpielerRepository spielerRepository;
    private final PartieRepository partieRepository;
    private final JdbcTemplate jdbcTemplate;

    TischRepositoryImpl(
        TischJdbcRepository tischJdbcRepository,
        SpielerRepository spielerRepository,
        PartieRepository partieRepository,
        JdbcTemplate jdbcTemplate
    ) {
        this.tischJdbcRepository = tischJdbcRepository;
        this.spielerRepository = spielerRepository;
        this.partieRepository = partieRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public TischEntity save(TischEntity tisch) {
        // Spieler speichern (z.B. neu erzeugte KI-Spieler, analog zur frueheren JPA-Kaskade)
        if (tisch.erstelltVon() != null) {
            spielerRepository.save(tisch.erstelltVon());
        }
        tisch.spieler().forEach(spielerRepository::save);

        // Wenn eine Partie im Arbeitsspeicher gesetzt ist, zuerst Partie speichern
        PartieEntity partie = tisch.partie();
        if (partie != null) {
            partieRepository.save(partie);
        }
        TischEntity gespeichert = tischJdbcRepository.save(tisch);
        // Transiente Felder im gespeicherten Objekt direkt aus dem Quell-Objekt uebernehmen
        gespeichert.setzeSpielerListe(new ArrayList<>(tisch.spieler()));
        gespeichert.setzeErstelltVonTransient(tisch.erstelltVon());
        if (partie != null) {
            partie.setzeTisch(gespeichert);
            gespeichert.setzePartieTransient(partie);
        }
        return gespeichert;
    }

    @Override
    public TischEntity saveAndFlush(TischEntity tisch) {
        // Spring Data JDBC persistiert sofort — kein expliziter Flush-Mechanismus noetig
        return save(tisch);
    }

    @Override
    public void delete(TischEntity tisch) {
        // Partie zuerst loeschen wegen partie_id FK in tisch
        // Tisch loeschen (kaskadiert via FK: tisch_spieler)
        // Partie-Loeschung: partie.tisch_id ist kein CASCADE, daher erst tisch_id in partie nullen
        if (tisch.partieId() != null) {
            // Partie-Referenz in tisch zuerst auf null setzen
            jdbcTemplate.update("UPDATE tisch SET partie_id = NULL WHERE id = ?", tisch.id());
            // Dann Partie und ihre Kinder loeschen (Spiele, Stiche, etc. via CASCADE)
            partieRepository.deleteById(PartieId.von(tisch.partieId()));
        }
        tischJdbcRepository.deleteById(tisch.id());
    }

    @Override
    public void deleteById(TischId id) {
        findById(id).ifPresent(this::delete);
    }

    @Override
    public void flush() {
        // Spring Data JDBC hat keinen expliziten Flush-Mechanismus
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<TischEntity> findById(TischId id) {
        return tischJdbcRepository.findById(id.wert()).map(this::befuelleTransienteFelder);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<TischEntity> findByPartieId(PartieId partieId) {
        return tischJdbcRepository.findByPartieId(partieId.wert()).map(this::befuelleTransienteFelder);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<TischEntity> findByIdWithLock(TischId id) {
        // Pessimistisches Write-Lock via SELECT FOR UPDATE
        List<UUID> ids = jdbcTemplate.queryForList(
            "SELECT id FROM tisch WHERE id = ? FOR UPDATE",
            UUID.class,
            id.wert()
        );
        if (ids.isEmpty()) {
            return Optional.empty();
        }
        return findById(id);
    }

    @Override
    @Transactional(readOnly = true)
    public List<TischEntity> findAllByStatusOrderByErstelltAmAsc(TischStatus status) {
        return tischJdbcRepository.findAllByStatusOrderByErstelltAmAsc(status.name())
            .stream()
            .map(this::befuelleTransienteFelder)
            .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<TischEntity> findBySpieler_Id(SpielerId spielerId) {
        return tischJdbcRepository.findBySpielerId(spielerId.wert())
            .map(this::befuelleTransienteFelder);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean existsBySpieler_SessionId(String sessionId) {
        return tischJdbcRepository.existsBySpielersessionId(sessionId);
    }

    @Override
    @Transactional(readOnly = true)
    public long count() {
        return tischJdbcRepository.count();
    }

    @Override
    @Transactional(readOnly = true)
    public boolean existsById(TischId id) {
        return tischJdbcRepository.existsById(id.wert());
    }

    /**
     * Befuellt die transienten Felder eines aus der Datenbank geladenen TischEntity:
     * - spieler (aus tisch_spieler join table via spielerRelationen)
     * - erstelltVon (aus spieler-Tabelle)
     * - partie (aus partie-Tabelle)
     */
    private TischEntity befuelleTransienteFelder(TischEntity tisch) {
        // Spielerliste aus den Join-Tabellen-Eintraegen laden (Reihenfolge beibehalten)
        List<SpielerEntity> spielerListe = new ArrayList<>();
        for (TischSpielerRelation relation : tisch.spielerRelationen()) {
            spielerRepository.findById(SpielerId.von(relation.spielerId())).ifPresent(spielerListe::add);
        }
        tisch.setzeSpielerListe(spielerListe);

        // erstelltVon-Spieler laden
        if (tisch.erstelltVonSpielerId() != null) {
            spielerRepository.findById(SpielerId.von(tisch.erstelltVonSpielerId()))
                .ifPresent(tisch::setzeErstelltVonTransient);
        }

        // Partie laden
        if (tisch.partieId() != null) {
            partieRepository.findById(PartieId.von(tisch.partieId())).ifPresent(partie -> {
                // Transiente Tisch-Rueckreferenz in der Partie setzen
                partie.setzeTisch(tisch);
                // Spiel-Partie-Rueckreferenz setzen
                partie.spiele().forEach(spiel -> spiel.setzePartie(partie));
                tisch.setzePartieTransient(partie);
            });
        }

        return tisch;
    }
}
