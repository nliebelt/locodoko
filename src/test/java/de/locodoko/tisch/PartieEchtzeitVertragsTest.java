package de.locodoko.tisch;

import de.locodoko.karten.Farbe;
import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartendeck;
import de.locodoko.karten.Kartenwert;
import de.locodoko.karten.Spielregeln;
import de.locodoko.karten.Hand;
import de.locodoko.partie.Spiel;
import de.locodoko.partie.SpielerPosition;
import de.locodoko.partie.VorbehaltAnsage;
import de.locodoko.spieler.SpielerNameAnfrage;
import de.locodoko.tisch.persistenz.SpielRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.client.RestTemplate;

import java.security.Principal;
import java.time.Duration;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Integrationstest für den WebSocket-Echtzeit-Vertrag der Partie-Events.
 *
 * Prüft drei Invarianten, die für die korrekte Frontend-Synchronisation essentiell sind:
 *
 * 1. Versionsmonotonie: Events aus verschiedenen Spielaktionen haben streng steigende Versionen.
 *    Events aus derselben Transaktion (z.B. KarteGespielt + StichAbgeschlossen beim 4. Zug)
 *    können dieselbe Version haben (@Version wird einmal pro saveAndFlush inkrementiert).
 *
 * 2. Keine Duplikate: Kein Spieler empfängt zwei Events mit derselben Kombination aus
 *    EreignisTyp und Version.
 *
 * 3. Ereignisreihenfolge: Innerhalb eines Stichs kommen alle KarteGespielt-Events
 *    vor dem StichAbgeschlossen-Event an.
 */
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@Import(WebSocketPublikationIntegrationTest.TestKonfiguration.class)
class PartieEchtzeitVertragsTest {

    private static final Duration ASYNC_TIMEOUT = Duration.ofSeconds(5);

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

    /**
     * Spielt einen vollständigen Stich mit kontrollierten Händen und prüft alle drei
     * Vertrags-Invarianten für jeden der vier Spieler.
     *
     * Setup: WEST führt mit KREUZ-AS-1 (non-trump). NORD, OST, SUED haben je eine einzige
     * non-trump KREUZ-Karte und müssen bedienen. WEST gewinnt den Stich.
     *
     * Erwartete Event-Sequenz pro Spieler:
     * KarteGespielt(WEST, V1) → KarteGespielt(NORD, V2) → KarteGespielt(OST, V3)
     * → KarteGespielt(SUED, V4) → StichAbgeschlossen(V4)
     *
     * Dabei: V1 < V2 < V3 < V4 (zwischen Aktionen strikt steigend),
     * aber StichAbgeschlossen(V4) == KarteGespielt(SUED, V4) (gleiche Transaktion).
     */
    @Test
    void vertragstest_VersionenMonotonUndKeineDuplikateUndEreignisreihenfolge() {
        SpielSetup setup = starteVierSpielerTisch("Vertragstest");
        setzeKontrollierteStichHaende(setup.partieId());
        meldeGesundesSpiel(setup);
        nachrichtenSpeicher.leeren();

        // Einen vollständigen KREUZ-Stich spielen: WEST führt, alle anderen bedienen.
        webSocketController.spieleKarte(setup.tischId(), new KarteSpielenAnfrage("KREUZ-AS-1"), principal(setup.sessionIds().get(SpielerPosition.WEST)));
        webSocketController.spieleKarte(setup.tischId(), new KarteSpielenAnfrage("KREUZ-ZEHN-1"), principal(setup.sessionIds().get(SpielerPosition.NORD)));
        webSocketController.spieleKarte(setup.tischId(), new KarteSpielenAnfrage("KREUZ-KOENIG-1"), principal(setup.sessionIds().get(SpielerPosition.OST)));
        webSocketController.spieleKarte(setup.tischId(), new KarteSpielenAnfrage("KREUZ-AS-2"), principal(setup.sessionIds().get(SpielerPosition.SUED)));

        // Auf StichAbgeschlossen für alle Spieler warten, bevor Assertions laufen.
        for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
            String sessionId = setup.sessionIds().get(position);
            String queue = "/queue/partie/" + setup.partieId();
            await().atMost(ASYNC_TIMEOUT).until(() ->
                nachrichtenSpeicher.nachrichten().stream()
                    .filter(n -> queue.equals(n.ziel())
                        && sessionId.equals(n.benutzer())
                        && n.payload() instanceof PartieEreignisBatch)
                    .flatMap(n -> ((PartieEreignisBatch) n.payload()).ereignisse().stream())
                    .anyMatch(e -> e instanceof PartieEreignisAntwort.StichAbgeschlossen)
            );
        }

        // Vertrags-Invarianten für jeden Spieler prüfen.
        for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
            String sessionId = setup.sessionIds().get(position);
            List<PartieEreignisAntwort> ereignisse = sammelPartieEreignisse(sessionId, setup.partieId());

            assertEquals(5, ereignisse.size(),
                position + ": Genau 4 KarteGespielt + 1 StichAbgeschlossen erwartet.");

            pruefeVersionsvertrag(ereignisse, position);
            pruefeKeineDuplikate(ereignisse, position);
            pruefeEreignisreihenfolge(ereignisse, position);
            pruefeVersionsKonsistenz(ereignisse, position);
        }
    }

    /**
     * Assertion 1 — Versionsmonotonie:
     * - Alle Events sind nicht-abnehmend (V[i] >= V[i-1]).
     * - KarteGespielt-Events aus verschiedenen Spielaktionen sind streng steigend
     *   (jede spieleKarte-Transaktion inkrementiert @Version exakt einmal).
     */
    private void pruefeVersionsvertrag(List<PartieEreignisAntwort> ereignisse, SpielerPosition position) {
        for (int i = 1; i < ereignisse.size(); i++) {
            assertTrue(ereignisse.get(i).version() >= ereignisse.get(i - 1).version(),
                position + ": Version darf nicht abnehmen (Event " + i + ": "
                    + ereignisse.get(i).version() + " < " + ereignisse.get(i - 1).version() + ").");
        }

        // Zwischen verschiedenen Karten-Aktionen (je eigene Transaktion) muss die Version
        // der KarteGespielt-Events streng monoton steigen.
        List<PartieEreignisAntwort> kartenEvents = ereignisse.stream()
            .filter(e -> e instanceof PartieEreignisAntwort.KarteGespielt)
            .toList();
        for (int i = 1; i < kartenEvents.size(); i++) {
            assertTrue(kartenEvents.get(i).version() > kartenEvents.get(i - 1).version(),
                position + ": Versionen der KarteGespielt-Events müssen streng steigen (Aktion "
                    + i + ": " + kartenEvents.get(i).version()
                    + " nicht > " + kartenEvents.get(i - 1).version() + ").");
        }
    }

    /**
     * Assertion 2 — Keine Duplikate:
     * Kein Spieler empfängt zwei Events mit identischer (EreignisTyp + Version)-Signatur.
     * KarteGespielt(V4) und StichAbgeschlossen(V4) gelten als verschieden (unterschiedlicher Typ).
     */
    private void pruefeKeineDuplikate(List<PartieEreignisAntwort> ereignisse, SpielerPosition position) {
        Set<String> signaturen = new HashSet<>();
        for (PartieEreignisAntwort ereignis : ereignisse) {
            String signatur = ereignis.ereignisTyp() + "@" + ereignis.version();
            assertFalse(signaturen.contains(signatur),
                position + ": Duplikat-Event empfangen: " + signatur);
            signaturen.add(signatur);
        }
    }

    /**
     * Assertion 3 — Ereignisreihenfolge:
     * Alle 4 KarteGespielt-Events eines Stichs kommen vor dem StichAbgeschlossen an.
     * StichAbgeschlossen ist das letzte Event in der Sequenz.
     */
    private void pruefeEreignisreihenfolge(List<PartieEreignisAntwort> ereignisse, SpielerPosition position) {
        int letzterIndex = ereignisse.size() - 1;
        assertInstanceOf(PartieEreignisAntwort.StichAbgeschlossen.class, ereignisse.get(letzterIndex),
            position + ": Das letzte Event eines Stichs muss StichAbgeschlossen sein.");
        for (int i = 0; i < letzterIndex; i++) {
            assertInstanceOf(PartieEreignisAntwort.KarteGespielt.class, ereignisse.get(i),
                position + ": Alle Events vor StichAbgeschlossen müssen KarteGespielt sein (Index " + i + ").");
        }
    }

    /**
     * Konsistenz-Check: event.version() und event.partieStand().version() müssen übereinstimmen,
     * da beide vom selben Partie-Aggregat-Snapshot stammen.
     */
    private void pruefeVersionsKonsistenz(List<PartieEreignisAntwort> ereignisse, SpielerPosition position) {
        for (PartieEreignisAntwort ereignis : ereignisse) {
            assertEquals(ereignis.version(), ereignis.partieStand().version(),
                position + ": event.version() und partieStand.version() müssen identisch sein ("
                    + ereignis.ereignisTyp() + "@" + ereignis.version() + ").");
        }
    }

    // --- Setup-Hilfsmethoden ---

    /**
     * Kontrollierte Hände für den Vertragstest: WEST bekommt alle "freien" KREUZ-non-Trump-Karten,
     * damit NORD/OST/SUED je genau eine KREUZ-non-Trump-Karte haben und zur Bedienpflicht gezwungen sind.
     *
     * WEST  : KREUZ-AS-1 (Führkarte), KREUZ-ZEHN-2, KREUZ-KOENIG-2 + auto-fill
     * NORD  : KREUZ-ZEHN-1  + auto-fill
     * OST   : KREUZ-KOENIG-1 + auto-fill
     * SUED  : KREUZ-AS-2   + auto-fill
     */
    private void setzeKontrollierteStichHaende(UUID partieId) {
        setzeKontrollierteHaende(partieId, Map.of(
            SpielerPosition.WEST, List.of(
                karte(Farbe.KREUZ, Kartenwert.AS, 1),
                karte(Farbe.KREUZ, Kartenwert.ZEHN, 2),
                karte(Farbe.KREUZ, Kartenwert.KOENIG, 2)
            ),
            SpielerPosition.NORD, List.of(karte(Farbe.KREUZ, Kartenwert.ZEHN, 1)),
            SpielerPosition.OST,  List.of(karte(Farbe.KREUZ, Kartenwert.KOENIG, 1)),
            SpielerPosition.SUED, List.of(karte(Farbe.KREUZ, Kartenwert.AS, 2))
        ));
    }

    private SpielSetup starteVierSpielerTisch(String tischName) {
        String suedCookie = registriereSpieler("Ada");
        String westCookie = registriereSpieler("Bert");
        String nordCookie = registriereSpieler("Clara");
        String ostCookie  = registriereSpieler("Dora");

        TischAntwort tisch = erstelleTisch(suedCookie, tischName);
        betreteTisch(westCookie, tisch.id());
        betreteTisch(nordCookie, tisch.id());
        betreteTisch(ostCookie, tisch.id());
        starteTisch(suedCookie, tisch.id());

        UUID partieId = nachrichtenSpeicher.nachrichten().stream()
            .filter(n -> ("/topic/tisch/" + tisch.id()).equals(n.ziel()))
            .map(WebSocketNachrichtGesendet::payload)
            .filter(TischEreignisAntwort.class::isInstance)
            .map(TischEreignisAntwort.class::cast)
            .map(TischEreignisAntwort::partieStand)
            .filter(Objects::nonNull)
            .map(PartieStandAntwort::partieId)
            .findFirst()
            .orElseThrow(() -> new AssertionError("Keine Partie-ID nach Tischstart gefunden."));

        Map<SpielerPosition, String> sessionIds = Map.of(
            SpielerPosition.SUED, extrahiereSessionId(suedCookie),
            SpielerPosition.WEST, extrahiereSessionId(westCookie),
            SpielerPosition.NORD, extrahiereSessionId(nordCookie),
            SpielerPosition.OST,  extrahiereSessionId(ostCookie)
        );
        return new SpielSetup(tisch.id(), partieId, sessionIds);
    }

    private void meldeGesundesSpiel(SpielSetup setup) {
        webSocketController.meldeVorbehalt(setup.tischId(), new VorbehaltAnfrage(VorbehaltAnsage.GESUND), principal(setup.sessionIds().get(SpielerPosition.WEST)));
        webSocketController.meldeVorbehalt(setup.tischId(), new VorbehaltAnfrage(VorbehaltAnsage.GESUND), principal(setup.sessionIds().get(SpielerPosition.NORD)));
        webSocketController.meldeVorbehalt(setup.tischId(), new VorbehaltAnfrage(VorbehaltAnsage.GESUND), principal(setup.sessionIds().get(SpielerPosition.OST)));
        webSocketController.meldeVorbehalt(setup.tischId(), new VorbehaltAnfrage(VorbehaltAnsage.GESUND), principal(setup.sessionIds().get(SpielerPosition.SUED)));
    }

    private void setzeKontrollierteHaende(UUID partieId, Map<SpielerPosition, List<Karte>> vorgaben) {
        transactionTemplate.executeWithoutResult(status -> {
            Spiel spiel = spielRepository.findAllByPartie_IdOrderBySpielNummerAsc(partieId).getFirst();
            Map<SpielerPosition, List<Karte>> verteilung = verteilungMitVorgaben(vorgaben);
            Map<SpielerPosition, Hand> neueHaende = verteilung.entrySet().stream()
                .collect(java.util.stream.Collectors.toMap(Map.Entry::getKey, e -> new Hand(e.getValue())));
            spiel.ersetzeHaende(neueHaende);
            spielRepository.save(spiel);
        });
    }

    private Map<SpielerPosition, List<Karte>> verteilungMitVorgaben(Map<SpielerPosition, List<Karte>> vorgaben) {
        List<Karte> restkarten = new ArrayList<>(Kartendeck.neu(Spielregeln.locoBlatRegeln()).karten());
        EnumMap<SpielerPosition, List<Karte>> haende = new EnumMap<>(SpielerPosition.class);
        for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
            List<Karte> karten = new ArrayList<>(vorgaben.getOrDefault(position, List.of()));
            karten.forEach(restkarten::remove);
            haende.put(position, karten);
        }
        for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
            while (haende.get(position).size() < 10) {
                haende.get(position).add(restkarten.removeFirst());
            }
        }
        return Map.copyOf(haende);
    }

    private Karte karte(Farbe farbe, Kartenwert wert, int exemplarIndex) {
        return new Karte(farbe, wert, exemplarIndex);
    }

    // --- Event-Sammlung ---

    private List<PartieEreignisAntwort> sammelPartieEreignisse(String sessionId, UUID partieId) {
        String queue = "/queue/partie/" + partieId;
        return nachrichtenSpeicher.nachrichten().stream()
            .filter(n -> queue.equals(n.ziel())
                && sessionId.equals(n.benutzer())
                && n.payload() instanceof PartieEreignisBatch)
            .flatMap(n -> ((PartieEreignisBatch) n.payload()).ereignisse().stream())
            .toList();
    }

    // --- HTTP-Hilfsmethoden ---

    private String registriereSpieler(String name) {
        ResponseEntity<String> antwort = restTemplate.postForEntity(
            url("/api/spieler/session"),
            new SpielerNameAnfrage(name),
            String.class
        );
        String setCookie = antwort.getHeaders().getFirst(HttpHeaders.SET_COOKIE);
        if (setCookie == null || setCookie.isBlank()) {
            throw new IllegalStateException("Spielerregistrierung lieferte kein Session-Cookie.");
        }
        return setCookie;
    }

    private TischAntwort erstelleTisch(String sessionCookie, String name) {
        HttpHeaders headers = new HttpHeaders();
        headers.add(HttpHeaders.COOKIE, sessionCookie);
        ResponseEntity<TischAntwort> antwort = restTemplate.exchange(
            url("/api/tische"),
            HttpMethod.POST,
            new HttpEntity<>(new TischErstellenAnfrage(name, null, null, null), headers),
            TischAntwort.class
        );
        return Objects.requireNonNull(antwort.getBody());
    }

    private void betreteTisch(String sessionCookie, UUID tischId) {
        HttpHeaders headers = new HttpHeaders();
        headers.add(HttpHeaders.COOKIE, sessionCookie);
        restTemplate.exchange(
            url("/api/tische/" + tischId + "/beitreten"),
            HttpMethod.POST,
            new HttpEntity<>(headers),
            String.class
        );
    }

    private void starteTisch(String sessionCookie, UUID tischId) {
        HttpHeaders headers = new HttpHeaders();
        headers.add(HttpHeaders.COOKIE, sessionCookie);
        restTemplate.exchange(
            url("/api/tische/" + tischId + "/starten"),
            HttpMethod.POST,
            new HttpEntity<>(headers),
            String.class
        );
    }

    private String url(String pfad) {
        return "http://localhost:" + port + pfad;
    }

    private String extrahiereSessionId(String sessionCookie) {
        int start = sessionCookie.indexOf("JSESSIONID=");
        if (start < 0) {
            throw new IllegalArgumentException("Kein JSESSIONID-Cookie vorhanden.");
        }
        int wertStart = start + "JSESSIONID=".length();
        int ende = sessionCookie.indexOf(';', wertStart);
        return ende < 0 ? sessionCookie.substring(wertStart) : sessionCookie.substring(wertStart, ende);
    }

    private Principal principal(String sessionId) {
        return () -> sessionId;
    }

    private record SpielSetup(UUID tischId, UUID partieId, Map<SpielerPosition, String> sessionIds) {}
}
