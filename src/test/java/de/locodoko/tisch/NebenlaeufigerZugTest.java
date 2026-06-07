package de.locodoko.tisch;

import de.locodoko.karten.Farbe;
import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartendeck;
import de.locodoko.karten.Kartenwert;
import de.locodoko.karten.Spielregeln;
import de.locodoko.partie.SpielerPosition;
import de.locodoko.karten.Hand;
import de.locodoko.tisch.persistenz.SpielRepository;
import de.locodoko.tisch.TischAntwort;
import de.locodoko.tisch.TischErstellenAnfrage;
import de.locodoko.partie.Spiel;
import de.locodoko.partie.SpielTestBuilder;
import de.locodoko.partie.VorbehaltAnsage;
import de.locodoko.spieler.SpielerNameAnfrage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.client.RestTemplate;

import java.security.Principal;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

/**
 * Nebenlaeufigekeit: Zwei parallele spieleKarte-Aufrufe fuer denselben Spieler.
 *
 * <p>WARUM: Ohne dedizierten Handler landet {@link OptimisticLockingFailureException}
 * als generischer 500-Fehler beim Client — der Zug ist verloren und der Client hat keine
 * Information, dass er seinen Snapshot neu laden sollte. Der Test stellt sicher, dass
 * ein Konflikt als {@link OptimisticLockingFailureException} sauber propagiert wird
 * (nicht als untypisierter RuntimeException-Wrapper) und damit vom WebSocket-Handler
 * korrekt zu {@code GLEICHZEITIGER_ZUGRIFF} umgewandelt werden kann.</p>
 */
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@Import(WebSocketPublikationIntegrationTest.TestKonfiguration.class)
class NebenlaeufigerZugTest {

    @LocalServerPort
    private int port;

    private final RestTemplate restTemplate = new RestTemplate();

    @Autowired
    private WebSocketPublikationIntegrationTest.TestWebSocketNachrichtenSpeicher nachrichtenSpeicher;

    @Autowired
    private SpielverwaltungWebSocketController webSocketController;

    @Autowired
    private SpielRepository spielRepository;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @BeforeEach
    void setUp() {
        nachrichtenSpeicher.leeren();
    }

    @Test
    void gleichzeitigeZugversucheWerdenKorrektAbgehandelt() throws InterruptedException {
        // WARUM: Wenn zwei Threads gleichzeitig denselben Spielzug versuchen, muss
        // mindestens einer gewinnen und ein etwaiger Verlierer darf nur
        // OptimisticLockingFailureException werfen — nie einen ungetypten Serverfehler.
        // Das sichert ab, dass der WebSocket-Handler GLEICHZEITIGER_ZUGRIFF (409)
        // statt SERVERFEHLER (500) an den Client senden kann.
        SpielSetup setup = starteVierSpielerTisch("Nebenlaeufer");
        setzeKontrollierteStandardhaende(setup.partieId());
        meldeGesundesSpiel(setup);
        nachrichtenSpeicher.leeren();

        int VERSUCHE = 2;
        CountDownLatch startSignal = new CountDownLatch(1);
        CountDownLatch fertigSignal = new CountDownLatch(VERSUCHE);
        CopyOnWriteArrayList<Exception> konflikte = new CopyOnWriteArrayList<>();
        AtomicInteger erfolge = new AtomicInteger(0);

        Runnable versuch = () -> {
            try {
                startSignal.await();
                webSocketController.spieleKarte(
                    setup.tischId(),
                    new KarteSpielenAnfrage("KREUZ-AS-1"),
                    principal(setup.sessionIds().get(SpielerPosition.WEST))
                );
                erfolge.incrementAndGet();
            } catch (OptimisticLockingFailureException e) {
                konflikte.add(e);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } catch (Exception e) {
                fail("Unerwartete Exception bei gleichzeitigem Zug — nur OptimisticLockingFailureException ist erlaubt, nicht: "
                    + e.getClass().getSimpleName() + ": " + e.getMessage());
            } finally {
                fertigSignal.countDown();
            }
        };

        ExecutorService executor = Executors.newFixedThreadPool(VERSUCHE);
        for (int i = 0; i < VERSUCHE; i++) {
            executor.submit(versuch);
        }
        startSignal.countDown();
        assertTrue(fertigSignal.await(10, TimeUnit.SECONDS),
            "Beide Threads muessen innerhalb von 10s abschliessen");
        executor.shutdown();

        // Mindestens einer muss gewinnen
        assertTrue(erfolge.get() >= 1,
            "Mindestens einer der parallelen Zuege muss erfolgreich sein");
        // Genau zwei Ausgaenge: Erfolge + Konflikte = Anzahl Versuche
        assertEquals(VERSUCHE, erfolge.get() + konflikte.size(),
            "Jeder Versuch muss entweder erfolgreich sein oder als OptimisticLockingFailureException enden");
    }

    private SpielSetup starteVierSpielerTisch(String tischName) {
        String suedCookie = registriereSpieler("Ada");
        String westCookie = registriereSpieler("Bert");
        String nordCookie = registriereSpieler("Clara");
        String ostCookie = registriereSpieler("Dora");

        TischAntwort tisch = erstelleTisch(suedCookie, tischName);
        betreteTisch(westCookie, tisch.id());
        betreteTisch(nordCookie, tisch.id());
        betreteTisch(ostCookie, tisch.id());
        starteTisch(suedCookie, tisch.id());
        UUID partieId = nachrichtenSpeicher.nachrichten().stream()
            .filter(nachricht -> ("/topic/tisch/" + tisch.id()).equals(nachricht.ziel()))
            .map(WebSocketNachrichtGesendet::payload)
            .filter(TischEreignisAntwort.class::isInstance)
            .map(TischEreignisAntwort.class::cast)
            .map(TischEreignisAntwort::partieStand)
            .filter(Objects::nonNull)
            .map(partieStand -> partieStand.partieId())
            .findFirst()
            .orElseThrow(() -> new AssertionError("Keine Partie-ID fuer den gestarteten Tisch publiziert."));
        Map<SpielerPosition, String> sessionIds = Map.of(
            SpielerPosition.SUED, extrahiereSessionId(suedCookie),
            SpielerPosition.WEST, extrahiereSessionId(westCookie),
            SpielerPosition.NORD, extrahiereSessionId(nordCookie),
            SpielerPosition.OST, extrahiereSessionId(ostCookie)
        );
        return new SpielSetup(tisch.id(), partieId, sessionIds);
    }

    private void setzeKontrollierteStandardhaende(UUID partieId) {
        transactionTemplate.executeWithoutResult(status -> {
            Spiel spiel = spielRepository.findAllByPartie_IdOrderBySpielNummerAsc(partieId).getFirst();
            List<Karte> restkarten = new ArrayList<>(Kartendeck.neu(Spielregeln.locoBlatRegeln()).karten());
            EnumMap<SpielerPosition, List<Karte>> vorgaben = new EnumMap<>(SpielerPosition.class);
            vorgaben.put(SpielerPosition.WEST, List.of(
                new Karte(Farbe.KREUZ, Kartenwert.AS, 1),
                new Karte(Farbe.KREUZ, Kartenwert.DAME, 1),
                new Karte(Farbe.PIK, Kartenwert.ZEHN, 1)
            ));
            EnumMap<SpielerPosition, List<Karte>> haende = new EnumMap<>(SpielerPosition.class);
            for (SpielerPosition pos : SpielerPosition.standardReihenfolge()) {
                List<Karte> karten = new ArrayList<>(vorgaben.getOrDefault(pos, List.of()));
                karten.forEach(restkarten::remove);
                haende.put(pos, karten);
            }
            for (SpielerPosition pos : SpielerPosition.standardReihenfolge()) {
                while (haende.get(pos).size() < 10) {
                    haende.get(pos).add(restkarten.removeFirst());
                }
            }
            Map<SpielerPosition, Hand> neueHaende = haende.entrySet().stream()
                .collect(java.util.stream.Collectors.toMap(Map.Entry::getKey, e -> new Hand(e.getValue())));
            SpielTestBuilder.von(spiel).mitHaenden(neueHaende);
            spielRepository.save(spiel);
        });
    }

    private void meldeGesundesSpiel(SpielSetup setup) {
        webSocketController.meldeVorbehalt(setup.tischId(), new VorbehaltAnfrage(VorbehaltAnsage.GESUND), principal(setup.sessionIds().get(SpielerPosition.WEST)));
        webSocketController.meldeVorbehalt(setup.tischId(), new VorbehaltAnfrage(VorbehaltAnsage.GESUND), principal(setup.sessionIds().get(SpielerPosition.NORD)));
        webSocketController.meldeVorbehalt(setup.tischId(), new VorbehaltAnfrage(VorbehaltAnsage.GESUND), principal(setup.sessionIds().get(SpielerPosition.OST)));
        webSocketController.meldeVorbehalt(setup.tischId(), new VorbehaltAnfrage(VorbehaltAnsage.GESUND), principal(setup.sessionIds().get(SpielerPosition.SUED)));
    }

    private String registriereSpieler(String name) {
        ResponseEntity<String> antwort = restTemplate.postForEntity(
            url("/api/spieler/session"),
            new SpielerNameAnfrage(name),
            String.class
        );
        String setCookie = antwort.getHeaders().getFirst(HttpHeaders.SET_COOKIE);
        if (setCookie == null || setCookie.isBlank()) {
            throw new IllegalStateException("Spielerregistrierung hat kein Session-Cookie geliefert.");
        }
        return setCookie;
    }

    private TischAntwort erstelleTisch(String sessionCookie, String name) {
        HttpHeaders headers = new HttpHeaders();
        headers.add(HttpHeaders.COOKIE, sessionCookie);
        ResponseEntity<TischAntwort> antwort = restTemplate.exchange(
            url("/api/tische"),
            HttpMethod.POST,
            new HttpEntity<>(new TischErstellenAnfrage(name, null, null, null, null), headers),
            TischAntwort.class
        );
        return Objects.requireNonNull(antwort.getBody());
    }

    private void betreteTisch(String sessionCookie, UUID tischId) {
        HttpHeaders headers = new HttpHeaders();
        headers.add(HttpHeaders.COOKIE, sessionCookie);
        restTemplate.exchange(url("/api/tische/" + tischId + "/beitreten"), HttpMethod.POST,
            new HttpEntity<>(headers), String.class);
    }

    private void starteTisch(String sessionCookie, UUID tischId) {
        HttpHeaders headers = new HttpHeaders();
        headers.add(HttpHeaders.COOKIE, sessionCookie);
        restTemplate.exchange(url("/api/tische/" + tischId + "/starten"), HttpMethod.POST,
            new HttpEntity<>(headers), String.class);
    }

    private Principal principal(String sessionId) {
        return () -> sessionId;
    }

    private String extrahiereSessionId(String sessionCookie) {
        int start = sessionCookie.indexOf("JSESSIONID=");
        if (start < 0) throw new IllegalArgumentException("Kein JSESSIONID-Cookie vorhanden.");
        int wertStart = start + "JSESSIONID=".length();
        int ende = sessionCookie.indexOf(';', wertStart);
        return ende < 0 ? sessionCookie.substring(wertStart) : sessionCookie.substring(wertStart, ende);
    }

    private String url(String pfad) {
        return "http://localhost:" + port + pfad;
    }

    private record SpielSetup(UUID tischId, UUID partieId, Map<SpielerPosition, String> sessionIds) {
    }
}
