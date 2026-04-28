package de.locodoko.tisch;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.Trigger;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Delayed;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit-Tests fuer {@link PartieCountdownService}.
 *
 * <p>Warum diese Tests wichtig sind:
 * <ul>
 *   <li>Stellt sicher, dass der erste COUNTDOWN_TICK sofort (synchron) gesendet wird —
 *       damit das Partie-Ende-Modal die initiale Sekundenzahl korrekt anzeigt.</li>
 *   <li>Verifiziert, dass der Scheduler nach dem letzten Tick (verbleibend == 0) den
 *       Auto-Start ausloest und sich selbst abbricht — verhindert endlos laufende Timer.</li>
 *   <li>Prueft, dass ein bestehender Countdown sicher abgebrochen wird wenn ein neuer
 *       startet — verhindert doppelte Auto-Starts am selben Tisch.</li>
 * </ul>
 */
class PartieCountdownServiceTest {

    private StubTaskScheduler taskScheduler;
    private SpionTischEchtzeitService tischEchtzeitService;
    private SpionTischVerwaltungsService tischVerwaltungsService;
    private PartieCountdownService service;

    @BeforeEach
    void setUp() {
        taskScheduler = new StubTaskScheduler();
        tischEchtzeitService = new SpionTischEchtzeitService();
        tischVerwaltungsService = new SpionTischVerwaltungsService();
        service = new PartieCountdownService(taskScheduler, tischEchtzeitService, tischVerwaltungsService, 3);
    }

    @Test
    void sendetInitialenTickSofortBeiCountdownStart() {
        UUID tischId = UUID.randomUUID();

        service.starteCountdown(tischId);

        assertEquals(1, tischEchtzeitService.gesendeteEreignisse.size());
        TischEreignisAntwort tick = tischEchtzeitService.gesendeteEreignisse.get(0);
        assertEquals(TischEreignisTyp.COUNTDOWN_TICK, tick.ereignisTyp());
        assertEquals(3, tick.verbleibendeSekunden());
        assertEquals(tischId, tick.tischId());
    }

    @Test
    void sendetFolgeticksUndStartetAutomatischNachAblauf() {
        UUID tischId = UUID.randomUUID();

        service.starteCountdown(tischId);
        tischEchtzeitService.gesendeteEreignisse.clear();

        // Simuliere 3 Scheduler-Ticks: verbleibend=2, 1, dann 0 -> Auto-Start
        taskScheduler.getAktion().run(); // verbleibend=2
        taskScheduler.getAktion().run(); // verbleibend=1
        taskScheduler.getAktion().run(); // verbleibend=0 -> Auto-Start

        assertEquals(2, tischEchtzeitService.gesendeteEreignisse.size());
        assertEquals(2, tischEchtzeitService.gesendeteEreignisse.get(0).verbleibendeSekunden());
        assertEquals(1, tischEchtzeitService.gesendeteEreignisse.get(1).verbleibendeSekunden());

        assertTrue(taskScheduler.getLetzteFuture().wurdeAbgebrochen());
        assertEquals(1, tischVerwaltungsService.autoStartAufrufe.size());
        assertEquals(tischId, tischVerwaltungsService.autoStartAufrufe.get(0).wert());
    }

    @Test
    void brichtBestehendenCountdownAbBevorNeuerStartet() {
        UUID tischId = UUID.randomUUID();

        service.starteCountdown(tischId);
        StubScheduledFuture erstesFuture = taskScheduler.getLetzteFuture();

        service.starteCountdown(tischId); // zweiter Start am selben Tisch

        assertTrue(erstesFuture.wurdeAbgebrochen());
    }

    @Test
    void brecheCountdownAbEntferntAktivenTimer() {
        UUID tischId = UUID.randomUUID();

        service.starteCountdown(tischId);
        service.brecheCountdownAb(tischId);

        assertTrue(taskScheduler.getLetzteFuture().wurdeAbgebrochen());

        // Zweimaliges Abbrechen ohne Fehler (kein aktiver Timer mehr)
        assertDoesNotThrow(() -> service.brecheCountdownAb(tischId));
    }

    // --- Stubs ---

    static class StubTaskScheduler implements TaskScheduler {
        private StubScheduledFuture letzteFuture;
        private Runnable aktion;

        @Override
        @SuppressWarnings("unchecked")
        public ScheduledFuture<?> scheduleAtFixedRate(Runnable task, Instant startTime, Duration period) {
            this.aktion = task;
            this.letzteFuture = new StubScheduledFuture();
            return letzteFuture;
        }

        public Runnable getAktion() { return aktion; }
        public StubScheduledFuture getLetzteFuture() { return letzteFuture; }

        @Override public ScheduledFuture<?> schedule(Runnable task, Instant startTime) { throw new UnsupportedOperationException(); }
        @Override public ScheduledFuture<?> scheduleAtFixedRate(Runnable task, Duration period) { throw new UnsupportedOperationException(); }
        @Override public ScheduledFuture<?> scheduleWithFixedDelay(Runnable task, Instant startTime, Duration delay) { throw new UnsupportedOperationException(); }
        @Override public ScheduledFuture<?> scheduleWithFixedDelay(Runnable task, Duration delay) { throw new UnsupportedOperationException(); }
        @Override public ScheduledFuture<?> schedule(Runnable task, org.springframework.scheduling.Trigger trigger) { throw new UnsupportedOperationException(); }
    }

    static class StubScheduledFuture implements ScheduledFuture<Void> {
        private boolean abgebrochen = false;

        public boolean wurdeAbgebrochen() { return abgebrochen; }

        @Override public boolean cancel(boolean mayInterruptIfRunning) { abgebrochen = true; return true; }
        @Override public boolean isCancelled() { return abgebrochen; }
        @Override public boolean isDone() { return abgebrochen; }
        @Override public Void get() { return null; }
        @Override public Void get(long timeout, TimeUnit unit) { return null; }
        @Override public long getDelay(TimeUnit unit) { return 0; }
        @Override public int compareTo(Delayed o) { return 0; }
    }

    static class SpionTischEchtzeitService extends TischEchtzeitService {
        final List<TischEreignisAntwort> gesendeteEreignisse = new ArrayList<>();

        SpionTischEchtzeitService() {
            super(null, null, List.of());
        }

        @Override
        public void planeTischEreignis(TischEreignisAntwort antwort) {
            gesendeteEreignisse.add(antwort);
        }
    }

    static class SpionTischVerwaltungsService extends TischVerwaltungsService {
        final List<TischId> autoStartAufrufe = new ArrayList<>();

        SpionTischVerwaltungsService() {
            super(null, null, null, null, null, null);
        }

        @Override
        public void starteNeuePartieAutomat(TischId tischId) {
            autoStartAufrufe.add(tischId);
        }
    }
}
