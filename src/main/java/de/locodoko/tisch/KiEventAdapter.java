package de.locodoko.tisch;

import de.locodoko.partie.ereignisse.NaechsterSpielerErwartet;
import de.locodoko.partie.ereignisse.VorbehaltErwartet;
import jakarta.annotation.PreDestroy;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Reagiert auf Spielereignisse und loest KI-Zuege aus.
 *
 * <p>Lauscht auf {@link NaechsterSpielerErwartet} und {@link VorbehaltErwartet}.
 * Falls der naechste Spieler eine KI ist, fuehrt {@link KiOrchestrierungService#automatisiereTisch}
 * den Zug synchron im selben Transaktionskontext aus. Menschliche Spieler agieren
 * eigenstaendig ueber WebSocket und werden ignoriert.</p>
 *
 * <p>Zentralisiert die gesamte KI-Delay-Logik: der {@link #kiScheduler} und die Konstante
 * {@link #KI_KARTEN_VERZOEGERUNG_MS} liegen hier. {@link KiOrchestrierungService} ruft
 * {@link #planeVerzoegertenKiZug} auf, wenn ein zeitverzoegerter Folgezug gewuenscht ist.</p>
 */
@Component
class KiEventAdapter {

    // Mindestwartezeit zwischen zwei KI-Kartenzuegen in der Stichphase (ms)
    static final long KI_KARTEN_VERZOEGERUNG_MS = 800;

    // Einzel-Thread-Scheduler fuer zeitverzoegerte KI-Zuege (Daemon-Thread, lebt nur solange die JVM laeuft)
    private final ScheduledExecutorService kiScheduler = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "ki-timing");
        t.setDaemon(true);
        return t;
    });

    private final KiOrchestrierungService kiOrchestrierungService;
    private final TischRepository tischRepository;

    KiEventAdapter(KiOrchestrierungService kiOrchestrierungService, TischRepository tischRepository) {
        this.kiOrchestrierungService = kiOrchestrierungService;
        this.tischRepository = tischRepository;
    }

    @EventListener
    void beiNaechsterSpielerErwartet(NaechsterSpielerErwartet ereignis) {
        tischRepository.findById(TischId.von(ereignis.tischId()))
            .ifPresent(kiOrchestrierungService::automatisiereTisch);
    }

    @EventListener
    void beiVorbehaltErwartet(VorbehaltErwartet ereignis) {
        tischRepository.findById(TischId.von(ereignis.tischId()))
            .ifPresent(kiOrchestrierungService::automatisiereTisch);
    }

    /**
     * Plant einen zeitverzoegerten KI-Zug fuer den angegebenen Tisch.
     *
     * <p>Wird von {@link KiOrchestrierungService} aufgerufen, wenn nach einem KI-Kartenzug
     * in der Stichphase ein naechster KI-Zug mit Verzoegerung folgen soll, damit jede
     * KI-Karte einzeln im Frontend animiert erscheint.</p>
     */
    void planeVerzoegertenKiZug(TischId tischId) {
        kiScheduler.schedule(
            () -> kiOrchestrierungService.verzoegerteKiAktionAusfuehren(tischId),
            KI_KARTEN_VERZOEGERUNG_MS,
            TimeUnit.MILLISECONDS
        );
    }

    @PreDestroy
    void beende() {
        kiScheduler.shutdownNow();
    }
}
