package de.locodoko.tisch;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Verwaltet den automatischen Countdown nach Partie-Ende.
 *
 * <p>Nach Abschluss einer Partie sendet dieser Service jede Sekunde ein
 * {@link TischEreignisTyp#COUNTDOWN_TICK}-Ereignis an alle Spieler am Tisch.
 * Nach Ablauf des Countdowns startet er automatisch eine neue Partie.</p>
 *
 * <p>Konfigurierbar via {@code locodoko.countdown.dauer-sekunden} (Standard: 10).</p>
 */
@Service
public class PartieCountdownService {

    private static final Logger LOGGER = LoggerFactory.getLogger(PartieCountdownService.class);

    private final TaskScheduler taskScheduler;
    private final TischEchtzeitService tischEchtzeitService;
    private final TischVerwaltungsService tischVerwaltungsService;
    private final int countdownDauerSekunden;

    private final ConcurrentHashMap<UUID, ScheduledFuture<?>> aktiveCountdowns = new ConcurrentHashMap<>();

    public PartieCountdownService(
            TaskScheduler taskScheduler,
            TischEchtzeitService tischEchtzeitService,
            TischVerwaltungsService tischVerwaltungsService,
            @Value("${locodoko.countdown.dauer-sekunden:10}") int countdownDauerSekunden
    ) {
        this.taskScheduler = taskScheduler;
        this.tischEchtzeitService = tischEchtzeitService;
        this.tischVerwaltungsService = tischVerwaltungsService;
        this.countdownDauerSekunden = countdownDauerSekunden;
    }

    /**
     * Startet einen Countdown fuer den gegebenen Tisch.
     * Sendet sofort den ersten Tick (volle Dauer) und dann jede Sekunde einen weiteren.
     * Nach Ablauf wird automatisch eine neue Partie gestartet.
     *
     * @param tischId ID des Tisches, fuer den der Countdown laeuft
     */
    public void starteCountdown(UUID tischId) {
        brecheCountdownAb(tischId);

        AtomicInteger zaehler = new AtomicInteger(countdownDauerSekunden);

        // Ersten Tick sofort senden
        tischEchtzeitService.planeTischEreignis(TischEreignisAntwort.countdownTick(tischId, zaehler.get()));
        LOGGER.debug("Countdown gestartet [tischId={}, dauer={}s]", tischId, countdownDauerSekunden);

        ScheduledFuture<?> future = taskScheduler.scheduleAtFixedRate(
                () -> verarbeiteCountdownTick(tischId, zaehler),
                Instant.now().plus(Duration.ofSeconds(1)),
                Duration.ofSeconds(1)
        );
        aktiveCountdowns.put(tischId, future);
    }

    /**
     * Bricht einen laufenden Countdown ab (z.B. weil Tisch entfernt wurde).
     *
     * @param tischId ID des Tisches, dessen Countdown abgebrochen werden soll
     */
    public void brecheCountdownAb(UUID tischId) {
        ScheduledFuture<?> alter = aktiveCountdowns.remove(tischId);
        if (alter != null) {
            alter.cancel(false);
            LOGGER.debug("Countdown abgebrochen [tischId={}]", tischId);
        }
    }

    private void verarbeiteCountdownTick(UUID tischId, AtomicInteger zaehler) {
        int verbleibend = zaehler.decrementAndGet();
        if (verbleibend > 0) {
            tischEchtzeitService.planeTischEreignis(TischEreignisAntwort.countdownTick(tischId, verbleibend));
        } else {
            brecheCountdownAb(tischId);
            try {
                tischVerwaltungsService.starteNeuePartieAutomat(TischId.von(tischId));
                LOGGER.info("Neue Partie automatisch gestartet nach Countdown [tischId={}]", tischId);
            } catch (Exception e) {
                LOGGER.warn("Auto-Start nach Countdown fehlgeschlagen [tischId={}]: {}", tischId, e.getMessage());
            }
        }
    }
}
