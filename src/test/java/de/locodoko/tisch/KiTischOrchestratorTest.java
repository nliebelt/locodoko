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
import de.locodoko.partie.SpielEreignis;
import de.locodoko.partie.SonderpunktEreignis;
import de.locodoko.partie.Sonderpunkt;
import de.locodoko.partie.ereignisse.VorbehaltErwartet;
import de.locodoko.partie.ereignisse.NaechsterSpielerErwartet;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.OptimisticLockingFailureException;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.ArrayList;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Pure-JUnit-Test fuer KiTischOrchestrator.
 * Deckt Fehlerfaelle (Exception, Optimistic Locking) und Sicherheitslimits ab.
 */
class KiTischOrchestratorTest {
    
    private KiTischOrchestrator orchestrator;
    private FakePartieRepository partieRepository;
    private FakeKiOrchestrierungService kiOrchestrierungService;
    private FakeTischRepository tischRepository;
    private FakePartieLifecycleService partieLifecycleService;
    private FakeEventPublisher eventPublisher;

    @BeforeEach
    void setUp() {
        kiOrchestrierungService = new FakeKiOrchestrierungService();
        partieRepository = new FakePartieRepository();
        tischRepository = new FakeTischRepository();
        partieLifecycleService = new FakePartieLifecycleService();
        eventPublisher = new FakeEventPublisher();
        
        TischEchtzeitService tischEchtzeitService = new TischEchtzeitService(null, null, List.of());
        
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
    void automatisiereTisch_beendetWennPartieNull() {
        TischEntity tisch = TischEntity.neu("TestTisch", SpielerEntity.ki("KI 1"), TischkonfigurationEmbeddable.ausSpielregeln(Spielregeln.standardRegeln(), 1));
        orchestrator.automatisiereTisch(tisch);
        assertEquals(0, partieRepository.saveAndFlushCalls.get());
    }

    @Test
    void automatisiereTisch_beendetWennPartieBeendet() {
        TischEntity tisch = erstelleKiTisch();
        tisch.partie().markiereAlsBeendet();
        orchestrator.automatisiereTisch(tisch);
        assertEquals(0, partieRepository.saveAndFlushCalls.get());
    }

    @Test
    void automatisiereTisch_beendetWennMenschAmZug() {
        TischEntity tisch = TischEntity.neu("TestTisch", SpielerEntity.menschlich("Mensch 1", "sess-1"), TischkonfigurationEmbeddable.ausSpielregeln(Spielregeln.standardRegeln(), 1));
        tisch.fuegeSpielerHinzu(SpielerEntity.menschlich("Mensch 2", "sess-2"));
        tisch.fuegeSpielerHinzu(SpielerEntity.menschlich("Mensch 3", "sess-3"));
        tisch.fuegeSpielerHinzu(SpielerEntity.menschlich("Mensch 4", "sess-4"));
        Spielregeln regeln = Spielregeln.standardRegeln();
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, regeln, Kartendeck.neu(regeln).gemischt());
        spiel.teileKartenAus();
        Partie partie = Partie.neuePersistenz(1, regeln, null);
        partie.fuegeSpielHinzu(spiel);
        partie.initialisiereDomainFelderNachLaden();
        tisch.setzePartie(partie);
        
        orchestrator.automatisiereTisch(tisch);
        assertEquals(0, partieRepository.saveAndFlushCalls.get());
    }

    @Test
    void automatisiereTisch_faengtOptimisticLockingException_undBrichtAb() {
        TischEntity tisch = erstelleKiTisch();
        partieRepository.throwOptimisticLockingException = true;
        
        assertDoesNotThrow(() -> orchestrator.automatisiereTisch(tisch));
        assertEquals(1, partieRepository.saveAndFlushCalls.get());
    }

    @Test
    void automatisiereTisch_faengtAllgemeineException_undBrichtAb() {
        TischEntity tisch = erstelleKiTisch();
        kiOrchestrierungService.throwGeneralException = true;
        
        assertDoesNotThrow(() -> orchestrator.automatisiereTisch(tisch));
        assertEquals(0, partieRepository.saveAndFlushCalls.get());
    }

    @Test
    void automatisiereTisch_beendetSichNachSicherheitslimit() {
        TischEntity tisch = erstelleKiTisch();
        kiOrchestrierungService.immerEndlosschleife = true;

        assertDoesNotThrow(() -> orchestrator.automatisiereTisch(tisch));
        assertEquals(500, partieRepository.saveAndFlushCalls.get());
    }

    @Test
    void beiNaechsterSpielerErwartet_ruftAutomatisiereTischAuf() {
        TischEntity tisch = erstelleKiTisch();
        tischRepository.tischToReturn = tisch;
        
        orchestrator.beiNaechsterSpielerErwartet(new NaechsterSpielerErwartet(tisch.id()));
        assertEquals(1, partieRepository.saveAndFlushCalls.get());
    }

    @Test
    void beiVorbehaltErwartet_ruftAutomatisiereTischAuf() {
        TischEntity tisch = erstelleKiTisch();
        tischRepository.tischToReturn = tisch;
        
        orchestrator.beiVorbehaltErwartet(new VorbehaltErwartet(tisch.id()));
        assertEquals(1, partieRepository.saveAndFlushCalls.get());
    }

    @Test
    void beiKiUebernahme_ruftAutomatisiereTischAuf() {
        TischEntity tisch = erstelleKiTisch();
        tischRepository.tischToReturn = tisch;
        
        orchestrator.beiKiUebernahme(new KiUebernahmeEreignis(TischId.von(tisch.id())));
        assertEquals(1, partieRepository.saveAndFlushCalls.get());
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
        int actionCount = 0;
        
        FakeKiOrchestrierungService() {
            super(null); 
        }
        
        @Override
        public KiAktionErgebnis fuehreAktionAus(Spiel laufendesSpiel, SpielerPosition spielerPosition, KiSchwierigkeit schwierigkeit) {
            if (throwGeneralException) {
                throw new RuntimeException("Simulierter Test-Fehler in der KI");
            }
            if (immerEndlosschleife) {
                return new KiAktionErgebnis(laufendesSpiel, null, List.of());
            }
            
            actionCount++;
            if (actionCount > 1) { // Throw after 1 successful action
                 throw new RuntimeException("Stop loop safely after 1 action");
            }
            return new KiAktionErgebnis(laufendesSpiel, null, List.of());
        }
    }

    private static class FakePartieLifecycleService extends PartieLifecycleService {
        FakePartieLifecycleService() {
            super(null, null, null, null);
        }
        @Override
        public void uebernehmeDomainPartieAbschluss(TischEntity tisch, Spiel abgeschlossenesSpiel, Partie neuePartie) {
            // no-op
        }
        @Override
        public void veroeffentlicheSpielGestartet(TischEntity tisch) {
            // no-op
        }
    }

    private static class FakeEventPublisher implements ApplicationEventPublisher {
        List<Object> events = new ArrayList<>();
        @Override
        public void publishEvent(Object event) {
            events.add(event);
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
        TischEntity tischToReturn;
        
        @Override public TischEntity save(TischEntity tisch) { return null; }
        @Override public TischEntity saveAndFlush(TischEntity tisch) { return null; }
        @Override public void delete(TischEntity tisch) {}
        @Override public void deleteById(TischId id) {}
        @Override public void flush() {}
        @Override public Optional<TischEntity> findById(TischId id) { return Optional.ofNullable(tischToReturn); }
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
