package de.locodoko.tisch;

import de.locodoko.karten.Kartendeck;
import de.locodoko.karten.Spielregeln;
import de.locodoko.ki.KiSchwierigkeit;
import de.locodoko.ki.orchestrierung.KiAktionErgebnis;
import de.locodoko.ki.orchestrierung.KiOrchestrierungService;
import de.locodoko.partie.Partie;
import de.locodoko.partie.PartieId;
import de.locodoko.partie.PartieStatus;
import de.locodoko.partie.Spiel;
import de.locodoko.partie.SpielerPosition;
import de.locodoko.spieler.SpielerEntity;
import de.locodoko.spieler.SpielerId;
import de.locodoko.tisch.persistenz.PartieRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.OptimisticLockingFailureException;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Pure-JUnit-Test fuer KiTischOrchestrator.
 * Deckt Fehlerfaelle (Exception, Optimistic Locking) und Sicherheitslimits ab.
 */
class KiTischOrchestratorTest {
    
    private KiTischOrchestrator orchestrator;
    private FakePartieRepository partieRepository;
    private FakeKiOrchestrierungService kiOrchestrierungService;

    @BeforeEach
    void setUp() {
        kiOrchestrierungService = new FakeKiOrchestrierungService();
        partieRepository = new FakePartieRepository();
        
        FakeTischRepository tischRepository = new FakeTischRepository();
        TischEchtzeitService tischEchtzeitService = new TischEchtzeitService(null, null, List.of());
        PartieLifecycleService partieLifecycleService = new PartieLifecycleService(null, null, null, null);
        ApplicationEventPublisher eventPublisher = event -> {};
        
        orchestrator = new KiTischOrchestrator(
                kiOrchestrierungService,
                tischRepository,
                partieRepository,
                tischEchtzeitService,
                partieLifecycleService,
                eventPublisher
        );
    }

    @Test
    void automatisiereTisch_faengtOptimisticLockingException_undBrichtAb() {
        TischEntity tisch = erstelleKiTisch();
        partieRepository.throwOptimisticLockingException = true;
        
        // Muss ohne Exception durchlaufen, da die Exception intern gefangen wird
        assertDoesNotThrow(() -> orchestrator.automatisiereTisch(tisch));
        
        // Es wurde versucht zu speichern, dann abgebrochen (keine Endlosschleife)
        assertEquals(1, partieRepository.saveAndFlushCalls.get());
    }

    @Test
    void automatisiereTisch_faengtAllgemeineException_undBrichtAb() {
        TischEntity tisch = erstelleKiTisch();
        kiOrchestrierungService.throwGeneralException = true;
        
        assertDoesNotThrow(() -> orchestrator.automatisiereTisch(tisch));
        
        // Fehler in der KI fuehrt sofort zum Abbruch, kein saveAndFlush() erreicht
        assertEquals(0, partieRepository.saveAndFlushCalls.get());
    }

    @Test
    void automatisiereTisch_beendetSichNachSicherheitslimit() {
        TischEntity tisch = erstelleKiTisch();
        // Kein Fehler, aber Endlosschleife in der KI (gibt immer einen gueltigen naechsten Zug aus)
        kiOrchestrierungService.immerEndlosschleife = true;

        assertDoesNotThrow(() -> orchestrator.automatisiereTisch(tisch));
        
        // Nach MAXIMALE_KI_AKTIONEN (500) sollte die Schleife abbrechen
        assertEquals(500, partieRepository.saveAndFlushCalls.get());
    }
    
    private TischEntity erstelleKiTisch() {
        Spielregeln regeln = Spielregeln.standardRegeln();
        SpielerEntity ki1 = SpielerEntity.ki("KI 1");
        TischEntity tisch = TischEntity.neu("TestTisch", ki1, TischkonfigurationEmbeddable.ausSpielregeln(regeln, 1));
        tisch.fuegeSpielerHinzu(SpielerEntity.ki("KI 2"));
        tisch.fuegeSpielerHinzu(SpielerEntity.ki("KI 3"));
        tisch.fuegeSpielerHinzu(SpielerEntity.ki("KI 4"));
        
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, regeln, Kartendeck.neu(regeln).gemischt());
        spiel.teileKartenAus();
        
        Partie partie = Partie.neuePersistenz(1, regeln, null);
        spiel.setzeSpielNummer(1);
        partie.fuegeSpielHinzu(spiel);
        partie.setzeSpielregeln(regeln);
        partie.initialisiereDomainFelderNachLaden();
        tisch.setzePartie(partie);
        return tisch;
    }

    // --- Fake Classes ---
    
    private static class FakeKiOrchestrierungService extends KiOrchestrierungService {
        boolean throwGeneralException = false;
        boolean immerEndlosschleife = false;
        
        FakeKiOrchestrierungService() {
            super(null); // factory wird im Fake ueberschrieben
        }
        
        @Override
        public KiAktionErgebnis fuehreAktionAus(Spiel laufendesSpiel, SpielerPosition spielerPosition, KiSchwierigkeit schwierigkeit) {
            if (throwGeneralException) {
                throw new RuntimeException("Simulierter Test-Fehler in der KI");
            }
            if (immerEndlosschleife) {
                // Keine Ereignisse, keine State-Aenderung, erzeugt eine Endlosschleife im Orchestrator
                return new KiAktionErgebnis(laufendesSpiel, null, List.of());
            }
            return new KiAktionErgebnis(laufendesSpiel, null, List.of());
        }
    }

    private static class FakePartieRepository implements PartieRepository {
        boolean throwOptimisticLockingException = false;
        AtomicInteger saveAndFlushCalls = new AtomicInteger(0);
        
        @Override
        public Partie saveAndFlush(Partie entity) {
            saveAndFlushCalls.incrementAndGet();
            if (throwOptimisticLockingException) {
                throw new OptimisticLockingFailureException("Simulierter optimistischer Sperrkonflikt");
            }
            return entity;
        }

        @Override
        public <S extends Partie> S save(S entity) {
            return (S) saveAndFlush(entity);
        }

        @Override public <S extends Partie> Iterable<S> saveAll(Iterable<S> entities) { return null; }
        @Override public Optional<Partie> findById(UUID uuid) { return Optional.empty(); }
        @Override public boolean existsById(UUID uuid) { return false; }
        @Override public Iterable<Partie> findAll() { return null; }
        @Override public Iterable<Partie> findAllById(Iterable<UUID> uuids) { return null; }
        @Override public long count() { return 0; }
        @Override public void deleteById(UUID uuid) {}
        @Override public void delete(Partie entity) {}
        @Override public void deleteAllById(Iterable<? extends UUID> uuids) {}
        @Override public void deleteAll(Iterable<? extends Partie> entities) {}
        @Override public void deleteAll() {}
    }

    private static class FakeTischRepository implements TischRepository {
        @Override public TischEntity save(TischEntity tisch) { return null; }
        @Override public TischEntity saveAndFlush(TischEntity tisch) { return null; }
        @Override public void delete(TischEntity tisch) {}
        @Override public void deleteById(TischId id) {}
        @Override public void flush() {}
        @Override public Optional<TischEntity> findById(TischId id) { return Optional.empty(); }
        @Override public Optional<TischEntity> findByIdWithLock(TischId id) { return Optional.empty(); }
        @Override public List<TischEntity> findAllByStatusOrderByErstelltAmAsc(TischStatus status) { return null; }
        @Override public Optional<TischEntity> findBySpieler_Id(SpielerId spielerId) { return Optional.empty(); }
        @Override public Optional<TischEntity> findByPartieId(PartieId partieId) { return Optional.empty(); }
        @Override public boolean existsBySpieler_SessionId(String sessionId) { return false; }
        @Override public long count() { return 0; }
        @Override public boolean existsById(TischId id) { return false; }
        @Override public Optional<TischEntity> findByEinladungsCode(String einladungsCode) { return Optional.empty(); }
    }
}
