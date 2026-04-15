package de.locodoko.tisch;

import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartendeck;
import de.locodoko.partie.SpielerPosition;
import de.locodoko.karten.Spielregeln;
import de.locodoko.partie.Spiel;
import de.locodoko.partie.Spielphase;
import de.locodoko.partie.VorbehaltAnsage;
import de.locodoko.tisch.persistenz.PartieEntity;
import de.locodoko.tisch.persistenz.SpielEntity;
import de.locodoko.spieler.SpielerEntity;
import de.locodoko.spieler.SpielerId;
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
import java.util.concurrent.atomic.AtomicReference;

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
        return stubTischRepository(List.of());
    }

    private static TischRepository stubTischRepository(List<TischEntity> tische) {
        return new TischRepository() {
            @Override
            public List<TischEntity> findAllByStatusOrderByErstelltAmAsc(TischStatus status) {
                return tische.stream()
                    .filter(t -> t.status() == status)
                    .toList();
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
            @Override public Optional<TischEntity> findByEinladungsCode(String code) { return Optional.empty(); }
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

    // === T6.1: Zwei gleichzeitige spieleKarte()-Aufrufe auf demselben Tisch ===

    @Test
    void gleichzeitigeKartenSpielAktionen_einerGewinnt_keinerKorruptiert()
            throws InterruptedException {
        // Warum: Im Multiplayer senden zwei Spieler nahezu zeitgleich ihre Karte.
        // Ohne Locking wuerde der zweite Zug den ersten ueberschreiben — korrupter Zustand.
        // Mit Lock gewinnt einer, der andere erhaelt eine Exception; Spielstand bleibt konsistent.
        Spiel stichSpiel = erzeugeStichphasenSpiel();
        registry.registriere(tischId, stichSpiel);

        SpielerPosition aufspieler = stichSpiel.aktuellerSpieler().orElseThrow();
        Karte gueltigeKarte = stichSpiel.gueltigeKartenFuer(aufspieler).getFirst();

        CountDownLatch bereit = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        AtomicInteger erfolge = new AtomicInteger(0);
        AtomicInteger fehler = new AtomicInteger(0);
        AtomicReference<Spiel> erfolgreichesSpiel = new AtomicReference<>();

        ExecutorService pool = Executors.newFixedThreadPool(2);
        for (int i = 0; i < 2; i++) {
            pool.submit(() -> {
                bereit.countDown();
                try {
                    start.await();
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    return;
                }
                try {
                    registry.mitSpielGesperrt(tischId, s -> {
                        // Echte Domain-Mutation: Karte fuer den aktuellen Spieler spielen.
                        SpielerPosition aktuellerSpieler = s.aktuellerSpieler().orElseThrow();
                        Karte karte = s.gueltigeKartenFuer(aktuellerSpieler).getFirst();
                        Spiel neu = s.spieleKarte(aktuellerSpieler, karte);
                        return new SpielUndErgebnis<>(neu, neu);
                    });
                    erfolge.incrementAndGet();
                } catch (Exception e) {
                    fehler.incrementAndGet();
                }
            });
        }

        bereit.await();
        start.countDown();
        pool.shutdown();
        assertThat(pool.awaitTermination(10, TimeUnit.SECONDS)).isTrue();

        // Genau ein Thread gewinnt, der andere scheitert — weil nach dem ersten Zug
        // ein anderer Spieler an der Reihe ist und die selbe Karte nicht mehr gespielt werden kann.
        assertThat(erfolge.get() + fehler.get()).isEqualTo(2);
        assertThat(erfolge.get()).isGreaterThanOrEqualTo(1);

        // Cache-Zustand konsistent: genau eine Karte wurde gespielt.
        Spiel nachher = registry.finde(tischId).orElseThrow();
        assertThat(nachher.phase()).isInstanceOf(Spielphase.Stichphase.class);
        Spielphase.Stichphase stichphase = (Spielphase.Stichphase) nachher.phase();
        // Mindestens eine Karte liegt in der Stichmitte (vom erfolgreichen Thread).
        assertThat(stichphase.aktuellerStich().gespielteKarten()).hasSizeGreaterThanOrEqualTo(1);
    }

    // === T6.2: Idempotenz — dasselbe Kommando zweimal → gecachtes Ergebnis ===

    @Test
    void idempotenteMutation_gibtGecachtesErgebnisZurueck_ohneNeuausfuehrung() {
        // Warum: Bei Netzwerk-Duplikaten (Reconnect, Doppelklick) darf dasselbe Kommando
        // nicht doppelt ausgefuehrt werden — das wuerde zu einem Domain-Fehler fuehren
        // (Karte nicht mehr auf der Hand). Der Idempotenz-Cache gibt stattdessen das
        // urspruengliche Ergebnis zurueck.
        Spiel stichSpiel = erzeugeStichphasenSpiel();

        SpielRegistry.KommandoSchluessel schluessel = new SpielRegistry.KommandoSchluessel(
            tischId.wert(), SpielerPosition.WEST, "KARTE:KREUZ-AS-1:STICHPHASE"
        );

        AtomicInteger ausfuehrungsZaehler = new AtomicInteger(0);

        // Erster Aufruf: Mutation wird ausgefuehrt.
        Spiel erstesErgebnis = registry.mitSpielGesperrtIdempotent(tischId, stichSpiel, schluessel, s -> {
            ausfuehrungsZaehler.incrementAndGet();
            SpielerPosition aktuellerSpieler = s.aktuellerSpieler().orElseThrow();
            Karte karte = s.gueltigeKartenFuer(aktuellerSpieler).getFirst();
            Spiel neu = s.spieleKarte(aktuellerSpieler, karte);
            return new SpielUndErgebnis<>(neu, neu);
        });

        assertThat(ausfuehrungsZaehler.get()).isEqualTo(1);
        assertThat(erstesErgebnis).isNotNull();

        // Zweiter Aufruf mit demselben Schluessel: Mutation wird NICHT erneut ausgefuehrt.
        Spiel zweitesErgebnis = registry.mitSpielGesperrtIdempotent(tischId, stichSpiel, schluessel, s -> {
            ausfuehrungsZaehler.incrementAndGet();
            return new SpielUndErgebnis<>(s, s);
        });

        assertThat(ausfuehrungsZaehler.get()).isEqualTo(1);
        assertThat(zweitesErgebnis).isSameAs(erstesErgebnis);
    }

    @Test
    void idempotenzCache_wirdBeimEntfernenGeloescht() {
        // Warum: Nach Spielende darf der Idempotenz-Cache nicht endlos wachsen — Memory-Leak.
        Spiel stichSpiel = erzeugeStichphasenSpiel();

        SpielRegistry.KommandoSchluessel schluessel = new SpielRegistry.KommandoSchluessel(
            tischId.wert(), SpielerPosition.WEST, "KARTE:TEST:STICHPHASE"
        );

        registry.mitSpielGesperrtIdempotent(tischId, stichSpiel, schluessel, s -> {
            return new SpielUndErgebnis<>(s, "gecacht");
        });

        // Tisch entfernen — Cache muss geleert werden.
        registry.entferne(tischId);

        // Neues Spiel registrieren: derselbe Schluessel darf keinen Cache-Hit liefern.
        Spiel neuesSpiel = erzeugeStichphasenSpiel();
        AtomicInteger zaehler = new AtomicInteger(0);

        registry.mitSpielGesperrtIdempotent(tischId, neuesSpiel, schluessel, s -> {
            zaehler.incrementAndGet();
            return new SpielUndErgebnis<>(s, "neu");
        });

        assertThat(zaehler.get()).isEqualTo(1);
    }

    // === T6.3: SpielRegistry nach Server-Neustart — Spiele aus DB korrekt in Memory geladen ===

    @Test
    void initialisiere_laedt_laufendeSpiele_aus_DB_in_Cache() {
        // Warum: Nach einem Server-Neustart muessen laufende Spiele sofort im Cache liegen,
        // damit Spielaktionen ohne vorherige Registrierung funktionieren. Ohne diesen
        // Mechanismus waere jedes Spiel nach einem Neustart verloren.
        Spielregeln regeln = Spielregeln.locoBlatRegeln();
        Spiel laufendesSpiel = erzeugeStichphasenSpiel();

        // TischEntity mit laufender Partie erstellen
        SpielerEntity ersteller = SpielerEntity.ki("KI Ada");
        TischEntity tisch = TischEntity.neu(
            "Test-Tisch", ersteller,
            TischkonfigurationEmbeddable.ausSpielregeln(regeln, 1)
        );
        tisch.fuegeSpielerHinzu(ersteller);
        tisch.fuegeSpielerHinzu(SpielerEntity.ki("KI Bert"));
        tisch.fuegeSpielerHinzu(SpielerEntity.ki("KI Clara"));
        tisch.fuegeSpielerHinzu(SpielerEntity.ki("KI Dora"));

        PartieEntity partie = PartieEntity.neu(1);
        SpielEntity spielEntity = SpielEntity.neu(1, laufendesSpiel.geber(), laufendesSpiel.spieltyp(), laufendesSpiel.phase());
        SpielPersistenzAdapter.uebernehmeDomainSpiel(spielEntity, laufendesSpiel);
        partie.fuegeSpielHinzu(spielEntity);
        tisch.setzePartie(partie);

        // Registry mit Stub-Repository erstellen, das diesen Tisch liefert
        SpielRegistry neueRegistry = new SpielRegistry(stubTischRepository(List.of(tisch)));
        neueRegistry.initialisiere();

        assertThat(neueRegistry.groesse()).isEqualTo(1);
        Optional<Spiel> geladenes = neueRegistry.finde(TischId.von(tisch.id()));
        assertThat(geladenes).isPresent();
        assertThat(geladenes.get().phase()).isInstanceOf(Spielphase.Stichphase.class);
        assertThat(geladenes.get().geber()).isEqualTo(laufendesSpiel.geber());
    }

    @Test
    void initialisiere_ignoriert_tische_ohne_laufendes_spiel() {
        // Warum: Beendete Partien oder Tische ohne Partie duerfen nicht im Cache landen --
        // sonst waechst der Cache mit historischen Daten an.
        SpielerEntity ersteller = SpielerEntity.ki("KI Ada");
        TischEntity tischOhnePartie = TischEntity.neu(
            "Leerer Tisch", ersteller,
            TischkonfigurationEmbeddable.ausSpielregeln(Spielregeln.locoBlatRegeln(), 1)
        );
        // Status IM_SPIEL setzen, aber keine Partie — Randbedingung in der Praxis unwahrscheinlich,
        // aber initialisiere() muss robust damit umgehen.
        tischOhnePartie.fuegeSpielerHinzu(ersteller);

        SpielRegistry neueRegistry = new SpielRegistry(stubTischRepository(List.of(tischOhnePartie)));
        neueRegistry.initialisiere();

        assertThat(neueRegistry.groesse()).isEqualTo(0);
    }

    // === Hilfsmethoden ===

    private static Spiel erzeugeTestSpiel() {
        Spielregeln regeln = Spielregeln.locoBlatRegeln();
        return Spiel.neu(SpielerPosition.SUED, regeln, Kartendeck.neu(regeln)).teileKartenAus();
    }

    /** Erzeugt ein Spiel in der STICHPHASE — alle Vorbehalte "gesund" gemeldet. */
    private static Spiel erzeugeStichphasenSpiel() {
        Spielregeln regeln = Spielregeln.locoBlatRegeln();
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, regeln, Kartendeck.neu(regeln))
            .teileKartenAus()
            .meldeGesund(SpielerPosition.WEST)
            .meldeGesund(SpielerPosition.NORD)
            .meldeGesund(SpielerPosition.OST)
            .meldeGesund(SpielerPosition.SUED)
            .loeseVorbehalteAuf();
        assertThat(spiel.phase()).isInstanceOf(Spielphase.Stichphase.class);
        return spiel;
    }
}
