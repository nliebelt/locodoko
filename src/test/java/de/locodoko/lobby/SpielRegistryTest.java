package de.locodoko.lobby;

import de.locodoko.karten.Kartendeck;
import de.locodoko.karten.SpielerPosition;
import de.locodoko.karten.Spielregeln;
import de.locodoko.partie.Spiel;
import de.locodoko.session.SpielerId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SpielRegistryTest {

    private SpielRegistry registry;
    private TischId tischId;
    private Spiel spiel;

    @BeforeEach
    void setUp() {
        registry = new SpielRegistry(leeresTischRepository());
        registry.initialisiere();
        tischId = TischId.neu();
        spiel = erzeugeTestSpiel();
    }

    /** Stub: kein Tisch IM_SPIEL -- Registry startet leer. */
    private static TischRepository leeresTischRepository() {
        return new TischRepository() {
            @Override
            public List<TischEntity> findAllByStatusOrderByErstelltAmAsc(TischStatus status) {
                return List.of();
            }
            @Override public TischEntity save(TischEntity t) { return t; }
            @Override public TischEntity saveAndFlush(TischEntity t) { return t; }
            @Override public void delete(TischEntity t) { }
            @Override public void deleteById(TischId id) { }
            @Override public void flush() { }
            @Override public Optional<TischEntity> findById(TischId id) { return Optional.empty(); }
            @Override public Optional<TischEntity> findByIdWithLock(TischId id) { return Optional.empty(); }
            @Override public Optional<TischEntity> findBySpieler_Id(SpielerId id) { return Optional.empty(); }
            @Override public Optional<TischEntity> findByPartieId(de.locodoko.partie.PartieId id) { return Optional.empty(); }
            @Override public boolean existsBySpieler_SessionId(String sessionId) { return false; }
            @Override public long count() { return 0; }
            @Override public boolean existsById(TischId id) { return false; }
        };
    }

    @Test
    void registrieren_und_finden() {
        // Warum: Grundlegende Registry-Funktion -- Spiel muss nach Registrierung auffindbar sein.
        registry.registriere(tischId, spiel);
        assertThat(registry.finde(tischId)).contains(spiel);
    }

    @Test
    void entfernen_loescht_spiel() {
        // Warum: Registry darf kein Spiel halten nach Tischende -- sonst Memory-Leak.
        registry.registriere(tischId, spiel);
        registry.entferne(tischId);
        assertThat(registry.finde(tischId)).isEmpty();
    }

    @Test
    void mitSpielGesperrt_wirft_wenn_kein_spiel() {
        // Warum: Fehlender Cache-Eintrag ist ein Programmierfehler -- soll frueher als NPE auffallen.
        assertThatThrownBy(() -> registry.mitSpielGesperrt(tischId, s -> new SpielUndErgebnis<>(s, s)))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining(tischId.toString());
    }

    @Test
    void mitSpielGesperrt_aktualisiert_cache_und_gibt_wert_zurueck() {
        // Warum: mitSpielGesperrt muss sowohl den Cache als auch den Rueckgabewert korrekt setzen.
        registry.registriere(tischId, spiel);
        String ergebnis = registry.mitSpielGesperrt(tischId, s -> new SpielUndErgebnis<>(s, "OK"));
        assertThat(ergebnis).isEqualTo("OK");
    }

    @Test
    void mitSpielGesperrt_serialisiert_konkurrierende_zugriffe_auf_denselben_tisch()
            throws InterruptedException {
        // Warum: Race Condition bei simultanen Karten-Plays auf demselben Tisch darf nie
        // vorkommen -- zwei gleichzeitige Schreiboperationen muessten sonst verloren gehen.
        registry.registriere(tischId, spiel);

        int threadAnzahl = 10;
        CountDownLatch bereit = new CountDownLatch(threadAnzahl);
        CountDownLatch start = new CountDownLatch(1);
        AtomicInteger zaehler = new AtomicInteger(0);
        List<Integer> reihenfolge = new ArrayList<>();

        ExecutorService pool = Executors.newFixedThreadPool(threadAnzahl);
        for (int i = 0; i < threadAnzahl; i++) {
            pool.submit(() -> {
                bereit.countDown();
                try {
                    start.await();
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    return;
                }
                registry.mitSpielGesperrt(tischId, s -> {
                    // Innerhalb des Locks: Zaehler inkrementieren und Reihenfolge aufzeichnen.
                    // Ohne Lock wuerde zaehler.get() + 1 zu Race Conditions fuehren.
                    int wert = zaehler.incrementAndGet();
                    synchronized (reihenfolge) {
                        reihenfolge.add(wert);
                    }
                    return new SpielUndErgebnis<>(s, wert);
                });
            });
        }

        bereit.await();
        start.countDown();
        pool.shutdown();
        assertThat(pool.awaitTermination(10, TimeUnit.SECONDS)).isTrue();

        // Alle 10 Threads haben genau einmal zugegriffen -- keine verlorenen Updates.
        assertThat(zaehler.get()).isEqualTo(threadAnzahl);
        assertThat(reihenfolge).hasSize(threadAnzahl);
        // Werte 1..10 sind alle vorhanden (keine Duplikate durch Race Condition).
        for (int i = 1; i <= threadAnzahl; i++) {
            assertThat(reihenfolge).contains(i);
        }
    }

    @Test
    void verschiedene_tische_blockieren_sich_nicht_gegenseitig() throws InterruptedException {
        // Warum: Locks sind TischId-spezifisch -- parallele Aktionen auf verschiedenen Tischen
        // duerfen sich nicht gegenseitig blockieren (Performance-Anforderung).
        TischId tischA = TischId.neu();
        TischId tischB = TischId.neu();
        registry.registriere(tischA, spiel);
        registry.registriere(tischB, spiel);

        AtomicInteger zaehlerA = new AtomicInteger(0);
        AtomicInteger zaehlerB = new AtomicInteger(0);
        CountDownLatch fertig = new CountDownLatch(2);

        new Thread(() -> {
            for (int i = 0; i < 50; i++) {
                registry.mitSpielGesperrt(tischA, s -> {
                    zaehlerA.incrementAndGet();
                    return new SpielUndErgebnis<>(s, null);
                });
            }
            fertig.countDown();
        }).start();

        new Thread(() -> {
            for (int i = 0; i < 50; i++) {
                registry.mitSpielGesperrt(tischB, s -> {
                    zaehlerB.incrementAndGet();
                    return new SpielUndErgebnis<>(s, null);
                });
            }
            fertig.countDown();
        }).start();

        assertThat(fertig.await(10, TimeUnit.SECONDS)).isTrue();
        assertThat(zaehlerA.get()).isEqualTo(50);
        assertThat(zaehlerB.get()).isEqualTo(50);
    }

    private static Spiel erzeugeTestSpiel() {
        Spielregeln regeln = Spielregeln.locoBlatRegeln();
        return Spiel.neu(SpielerPosition.SUED, regeln, Kartendeck.neu(regeln)).teileKartenAus();
    }
}
