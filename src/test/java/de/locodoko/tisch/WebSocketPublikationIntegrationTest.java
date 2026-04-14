package de.locodoko.tisch;

import de.locodoko.spieler.SpielerNameAnfrage;
import de.locodoko.tisch.TischAntwort;
import de.locodoko.tisch.TischErstellenAnfrage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.web.client.RestTemplate;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;

import java.security.Principal;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@Import(WebSocketPublikationIntegrationTest.TestKonfiguration.class)
class WebSocketPublikationIntegrationTest {

    @LocalServerPort
    private int port;

    private final RestTemplate restTemplate = new RestTemplate();

    @Autowired
    private TestWebSocketNachrichtenSpeicher nachrichtenSpeicher;

    @Autowired
    private SpielverwaltungWebSocketController webSocketController;

    @BeforeEach
    void setUp() {
        nachrichtenSpeicher.leeren();
    }

    @Test
    void publiziertLobbyUndPartieNachrichtenNachTischAktionen() {
        String sessionCookie = registriereSpieler("Ada");

        TischAntwort tisch = erstelleTisch(sessionCookie, "Echtzeit-Tisch");
        starteTisch(sessionCookie, tisch.id());

        List<WebSocketNachrichtGesendet> nachrichten = nachrichtenSpeicher.nachrichten();

        WebSocketNachrichtGesendet tischlisteErstellung = findeNachricht(nachrichten, "/topic/tische", TischlisteEreignisAntwort.class, 0);
        TischlisteEreignisAntwort ersteTischliste = (TischlisteEreignisAntwort) tischlisteErstellung.payload();
        assertTrue(ersteTischliste.tische().stream().anyMatch(eintrag -> eintrag.id().equals(tisch.id())),
            "Ein neu erstellter Tisch muss sofort publiziert werden, damit andere Clients die Lobby ohne Polling sehen.");

        WebSocketNachrichtGesendet tischStartNachricht = findeNachricht(nachrichten, "/topic/tisch/" + tisch.id(), TischEreignisAntwort.class, 1);
        TischEreignisAntwort startEreignis = (TischEreignisAntwort) tischStartNachricht.payload();
        assertEquals(TischEreignisTyp.SPIEL_GESTARTET, startEreignis.ereignisTyp());
        assertNotNull(startEreignis.partieStand(),
            "Beim Start muss der erste Partie-Stand mitpubliziert werden, damit die Spielansicht direkt initialisiert werden kann.");

        WebSocketNachrichtGesendet tischlisteNachStart = findeNachricht(nachrichten, "/topic/tische", TischlisteEreignisAntwort.class, 1);
        TischlisteEreignisAntwort zweiteTischliste = (TischlisteEreignisAntwort) tischlisteNachStart.payload();
        assertFalse(zweiteTischliste.tische().stream().anyMatch(eintrag -> eintrag.id().equals(tisch.id())),
            "Gestartete Tische muessen aus der offenen Lobby verschwinden, damit beitretende Clients keinen veralteten Zustand sehen.");

        UUID partieId = Objects.requireNonNull(startEreignis.partieStand()).partieId();
        WebSocketNachrichtGesendet partieNachricht = findeNachricht(nachrichten, "/topic/partie/" + partieId, PartieEreignisAntwort.class, 0);
        PartieEreignisAntwort partieEreignis = (PartieEreignisAntwort) partieNachricht.payload();
        assertEquals(PartieEreignisTyp.PARTIE_AKTUALISIERT, partieEreignis.ereignisTyp());
        assertEquals(partieId, partieEreignis.partieStand().partieId());
    }

    @Test
    void sendetSnapshotsAnDenAnfragendenBenutzer() {
        String sessionCookie = registriereSpieler("Ada");
        String sessionId = extrahiereSessionId(sessionCookie);

        webSocketController.sendeTischlisteSnapshot((Principal) () -> sessionId);

        List<WebSocketNachrichtGesendet> nachrichten = nachrichtenSpeicher.nachrichten();
        WebSocketNachrichtGesendet snapshotNachricht = findeBenutzerNachricht(
            nachrichten,
            sessionId,
            "/queue/tische",
            TischlisteEreignisAntwort.class
        );

        TischlisteEreignisAntwort snapshot = (TischlisteEreignisAntwort) snapshotNachricht.payload();
        assertEquals(TischlisteEreignisTyp.SNAPSHOT, snapshot.ereignisTyp());
        assertNotNull(snapshot.timestamp(), "Snapshots brauchen einen Timestamp, damit Reconnects deterministisch einsortiert werden koennen.");
    }

    @Test
    void sendetImDebugSnapshotAlleHandkartenNurAnDenAnfragendenBenutzer() {
        String sessionCookie = registriereSpieler("Ada");
        String sessionId = extrahiereSessionId(sessionCookie);

        TischAntwort tisch = erstelleTisch(sessionCookie, "Debug-Tisch");
        starteTisch(sessionCookie, tisch.id());

        UUID partieId = findePartieIdFuerTisch(tisch.id());
        nachrichtenSpeicher.leeren();

        webSocketController.sendePartieDebugSnapshot(partieId, (Principal) () -> sessionId);

        WebSocketNachrichtGesendet partieSnapshot = findeBenutzerNachricht(
            nachrichtenSpeicher.nachrichten(),
            sessionId,
            "/queue/partie/" + partieId,
            PartieEreignisAntwort.class
        );
        PartieEreignisAntwort ereignis = (PartieEreignisAntwort) partieSnapshot.payload();
        assertNotNull(ereignis.partieStand().laufendesSpiel());
        assertTrue(
            ereignis.partieStand().laufendesSpiel().spieler().stream()
                .allMatch(spieler -> spieler.sichtbareHandkarten() != null && spieler.sichtbareHandkarten().size() == 10),
            "Der Debug-Snapshot soll fuer Entwicklungszwecke alle Haende nur benutzerbezogen offenlegen."
        );
    }

    private WebSocketNachrichtGesendet findeNachricht(
        List<WebSocketNachrichtGesendet> nachrichten,
        String ziel,
        Class<?> payloadTyp,
        int index
    ) {
        List<WebSocketNachrichtGesendet> passendeNachrichten = nachrichten.stream()
            .filter(nachricht -> ziel.equals(nachricht.ziel()) && payloadTyp.isInstance(nachricht.payload()))
            .toList();
        assertTrue(passendeNachrichten.size() > index,
            () -> "Es wurde keine passende WebSocket-Nachricht fuer " + ziel + " an Index " + index + " publiziert.");
        return passendeNachrichten.get(index);
    }

    private WebSocketNachrichtGesendet findeBenutzerNachricht(
        List<WebSocketNachrichtGesendet> nachrichten,
        String benutzer,
        String ziel,
        Class<?> payloadTyp
    ) {
        return nachrichten.stream()
            .filter(nachricht ->
                ziel.equals(nachricht.ziel())
                    && benutzer.equals(nachricht.benutzer())
                    && payloadTyp.isInstance(nachricht.payload())
            )
            .findFirst()
            .orElseThrow(() -> new AssertionError("Es wurde keine benutzerbezogene Snapshot-Nachricht publiziert."));
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
            new HttpEntity<>(new TischErstellenAnfrage(name, null), headers),
            TischAntwort.class
        );
        return Objects.requireNonNull(antwort.getBody());
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

    private UUID findePartieIdFuerTisch(UUID tischId) {
        return nachrichtenSpeicher.nachrichten().stream()
            .filter(nachricht -> ("/topic/tisch/" + tischId).equals(nachricht.ziel()))
            .map(WebSocketNachrichtGesendet::payload)
            .filter(TischEreignisAntwort.class::isInstance)
            .map(TischEreignisAntwort.class::cast)
            .map(TischEreignisAntwort::partieStand)
            .filter(Objects::nonNull)
            .map(partieStand -> partieStand.partieId())
            .findFirst()
            .orElseThrow(() -> new AssertionError("Es wurde keine Partie-ID fuer den gestarteten Tisch publiziert."));
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

    @TestConfiguration
    static class TestKonfiguration {

        @Bean
        TestWebSocketNachrichtenSpeicher testWebSocketNachrichtenSpeicher() {
            return new TestWebSocketNachrichtenSpeicher();
        }
    }

    static class TestWebSocketNachrichtenSpeicher implements WebSocketNachrichtenBeobachter {

        private final CopyOnWriteArrayList<WebSocketNachrichtGesendet> nachrichten = new CopyOnWriteArrayList<>();

        @Override
        public void nachrichtGesendet(WebSocketNachrichtGesendet nachricht) {
            nachrichten.add(nachricht);
        }

        List<WebSocketNachrichtGesendet> nachrichten() {
            return new ArrayList<>(nachrichten);
        }

        void leeren() {
            nachrichten.clear();
        }
    }
}
