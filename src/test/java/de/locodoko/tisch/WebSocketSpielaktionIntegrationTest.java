package de.locodoko.tisch;

import de.locodoko.karten.Farbe;
import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartenwert;
import de.locodoko.karten.Kartendeck;
import de.locodoko.partie.SpielerPosition;
import de.locodoko.karten.Spielregeln;
import de.locodoko.karten.UngueltigerSpielzugException;
import de.locodoko.partie.Ansage;
import de.locodoko.partie.Partei;
import de.locodoko.partie.Spielphase;
import de.locodoko.partie.VorbehaltAnsage;
import de.locodoko.karten.Hand;
import de.locodoko.tisch.persistenz.PartieRepository;
import de.locodoko.partie.Spiel;
import de.locodoko.tisch.persistenz.SpielRepository;
import de.locodoko.tisch.TischEntity;
import de.locodoko.tisch.TischRepository;
import de.locodoko.spieler.SpielerNameAnfrage;
import de.locodoko.tisch.PartieStandAntwort;
import de.locodoko.tisch.TischAntwort;
import de.locodoko.tisch.TischErstellenAnfrage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.support.TransactionTemplate;

import java.security.Principal;
import java.time.Duration;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@Import(WebSocketPublikationIntegrationTest.TestKonfiguration.class)
class WebSocketSpielaktionIntegrationTest {

    @LocalServerPort
    private int port;

    private final RestTemplate restTemplate = new RestTemplate();

    @Autowired
    private WebSocketPublikationIntegrationTest.TestWebSocketNachrichtenSpeicher nachrichtenSpeicher;

    @Autowired
    private SpielverwaltungWebSocketController webSocketController;

    @Autowired
    private TischRepository tischRepository;

    @Autowired
    private SpielRepository spielRepository;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @BeforeEach
    void setUp() {
        nachrichtenSpeicher.leeren();
    }

    @Test
    void verarbeitetVorbehaltePerWebSocketUndPubliziertBroadcastsSowieBenutzersnapshots() {
        SpielSetup setup = starteVierSpielerTisch("Vorbehaltstisch");
        nachrichtenSpeicher.leeren();

        webSocketController.meldeVorbehalt(setup.tischId(), new VorbehaltAnfrage(VorbehaltAnsage.GESUND), principal(setup.sessionIds().get(SpielerPosition.WEST)));
        webSocketController.meldeVorbehalt(setup.tischId(), new VorbehaltAnfrage(VorbehaltAnsage.SOLO_TRUMPF), principal(setup.sessionIds().get(SpielerPosition.NORD)));
        webSocketController.meldeVorbehalt(setup.tischId(), new VorbehaltAnfrage(VorbehaltAnsage.GESUND), principal(setup.sessionIds().get(SpielerPosition.OST)));
        webSocketController.meldeVorbehalt(setup.tischId(), new VorbehaltAnfrage(VorbehaltAnsage.GESUND), principal(setup.sessionIds().get(SpielerPosition.SUED)));

        WebSocketNachrichtGesendet broadcastNachricht = findeBenutzerNachricht(
            setup.sessionIds().get(SpielerPosition.WEST),
            "/queue/partie/" + setup.partieId(),
            PartieEreignisBatch.class
        );
        PartieEreignisAntwort broadcast = ((PartieEreignisBatch) broadcastNachricht.payload()).ereignisse().get(0);
        assertEquals("STICHPHASE", broadcast.partieStand().laufendesSpiel().phase(),
            "Nach vier WebSocket-Vorbehalten muss das Spiel automatisch aufgeloest und in die Stichphase ueberfuehrt werden.");
        assertEquals("SOLO_TRUMPF", broadcast.partieStand().laufendesSpiel().spieltyp().name());

        WebSocketNachrichtGesendet nordSnapshot = findeBenutzerNachricht(
            setup.sessionIds().get(SpielerPosition.NORD),
            "/queue/partie/" + setup.partieId(),
            PartieEreignisBatch.class
        );
        PartieEreignisAntwort snapshot = ((PartieEreignisBatch) nordSnapshot.payload()).ereignisse().get(0);
        assertNotNull(snapshot.partieStand().laufendesSpiel());
        assertTrue(snapshot.partieStand().laufendesSpiel().spieler().stream()
                .filter(spieler -> SpielerPosition.NORD == spieler.position())
                .findFirst()
                .orElseThrow()
                .sichtbareHandkarten()
                .size() == 10,
            "Nach einer Spielaktion braucht jeder menschliche Spieler erneut einen benutzerbezogenen Snapshot mit eigener Hand statt eines leeren Broadcast-Stands.");
    }

    @Test
    void lehntVorbehaltAusserhalbDerReihenfolgeAb() {
        SpielSetup setup = starteVierSpielerTisch("Ungueltiger Vorbehalt");
        nachrichtenSpeicher.leeren();

        SpielverwaltungKonfliktException exception = assertThrows(
            SpielverwaltungKonfliktException.class,
            () -> webSocketController.meldeVorbehalt(
                setup.tischId(),
                new VorbehaltAnfrage(VorbehaltAnsage.GESUND),
                principal(setup.sessionIds().get(SpielerPosition.SUED))
            )
        );

        assertEquals("VORBEHALT_UNGUELTIG", exception.fehlerCode());
        assertTrue(nachrichtenSpeicher.nachrichten().isEmpty(),
            "Ein ungueltiger Vorbehalt darf keinen Broadcast ausloesen, damit alle Clients denselben unveraenderten Spielstand behalten.");
    }

    @Test
    void verarbeitetArmutAngebotAblehnungUndAnnahmePerWebSocket() {
        SpielSetup setup = starteVierSpielerTisch("Armutstisch");
        setzeKontrollierteArmutshaende(setup.partieId());
        nachrichtenSpeicher.leeren();

        webSocketController.meldeVorbehalt(setup.tischId(), new VorbehaltAnfrage(VorbehaltAnsage.ARMUT), principal(setup.sessionIds().get(SpielerPosition.WEST)));
        webSocketController.meldeVorbehalt(setup.tischId(), new VorbehaltAnfrage(VorbehaltAnsage.GESUND), principal(setup.sessionIds().get(SpielerPosition.NORD)));
        webSocketController.meldeVorbehalt(setup.tischId(), new VorbehaltAnfrage(VorbehaltAnsage.GESUND), principal(setup.sessionIds().get(SpielerPosition.OST)));
        webSocketController.meldeVorbehalt(setup.tischId(), new VorbehaltAnfrage(VorbehaltAnsage.GESUND), principal(setup.sessionIds().get(SpielerPosition.SUED)));
        webSocketController.verarbeiteArmutAntwort(
            setup.tischId(),
            new ArmutAntwortAnfrage(false, List.of("KREUZ-DAME-1", "KREUZ-BUBE-1", "KARO-AS-1")),
            principal(setup.sessionIds().get(SpielerPosition.WEST))
        );
        webSocketController.verarbeiteArmutAntwort(
            setup.tischId(),
            new ArmutAntwortAnfrage(false, List.of()),
            principal(setup.sessionIds().get(SpielerPosition.NORD))
        );
        webSocketController.verarbeiteArmutAntwort(
            setup.tischId(),
            new ArmutAntwortAnfrage(true, List.of("KREUZ-AS-2", "PIK-AS-2", "HERZ-AS-1")),
            principal(setup.sessionIds().get(SpielerPosition.OST))
        );

        WebSocketNachrichtGesendet broadcastNachricht = findeBenutzerNachricht(
            setup.sessionIds().get(SpielerPosition.WEST),
            "/queue/partie/" + setup.partieId(),
            PartieEreignisBatch.class
        );
        PartieEreignisAntwort broadcast = ((PartieEreignisBatch) broadcastNachricht.payload()).ereignisse().get(0);
        assertEquals("STICHPHASE", broadcast.partieStand().laufendesSpiel().phase(),
            "Nach Angebot, Ablehnung und Annahme muss der WebSocket-Armutfluss die Stichphase erreichen, damit das Spiel ohne manuelle Eingriffe weiterlaufen kann.");

        WebSocketNachrichtGesendet ostSnapshot = findeBenutzerNachricht(
            setup.sessionIds().get(SpielerPosition.OST),
            "/queue/partie/" + setup.partieId(),
            PartieEreignisBatch.class
        );
        PartieEreignisAntwort snapshot = ((PartieEreignisBatch) ostSnapshot.payload()).ereignisse().get(0);
        PartieStandAntwort.SpielerImSpielAntwort ost = snapshot.partieStand().laufendesSpiel().spieler().stream()
            .filter(spieler -> spieler.position() == SpielerPosition.OST)
            .findFirst()
            .orElseThrow();
        assertTrue(ost.sichtbareHandkarten().stream().anyMatch(karte -> "KREUZ-DAME-1".equals(karte.id())),
            "Der annehmende Spieler muss die angebotenen Trumpfkarten im benutzerbezogenen Snapshot sehen, damit der Kartentausch im UI nachvollziehbar bleibt.");
    }

    @Test
    void verarbeitetKartePerWebSocketUndPubliziertStichmitteSowieSpielbareFolgekarten() {
        SpielSetup setup = starteVierSpielerTisch("Kartentisch");
        setzeKontrollierteStandardhaende(setup.partieId());
        meldeGesundesSpiel(setup);
        nachrichtenSpeicher.leeren();

        webSocketController.spieleKarte(
            setup.tischId(),
            new KarteSpielenAnfrage("KREUZ-AS-1"),
            principal(setup.sessionIds().get(SpielerPosition.WEST))
        );

        WebSocketNachrichtGesendet broadcastNachricht = findeBenutzerNachricht(
            setup.sessionIds().get(SpielerPosition.WEST),
            "/queue/partie/" + setup.partieId(),
            PartieEreignisBatch.class
        );
        PartieEreignisAntwort broadcast = ((PartieEreignisBatch) broadcastNachricht.payload()).ereignisse().get(0);
        assertEquals(1, broadcast.partieStand().laufendesSpiel().aktuelleStichmitte().size(),
            "Nach einer gueltigen Kartenaktion muss die Broadcast-Stichmitte die bereits ausgespielten Karten enthalten, damit alle Clients denselben Tischzustand sehen.");
        assertEquals("KREUZ-AS-1", broadcast.partieStand().laufendesSpiel().aktuelleStichmitte().getFirst().karte().id());

        WebSocketNachrichtGesendet nordSnapshotNachricht = findeBenutzerNachricht(
            setup.sessionIds().get(SpielerPosition.NORD),
            "/queue/partie/" + setup.partieId(),
            PartieEreignisBatch.class
        );
        PartieEreignisAntwort nordSnapshot = ((PartieEreignisBatch) nordSnapshotNachricht.payload()).ereignisse().get(0);
        assertTrue(nordSnapshot.partieStand().laufendesSpiel().spielbareKarten().stream()
                .allMatch(karte -> "KREUZ".equals(karte.farbe())),
            "Der naechste Spieler muss im benutzerbezogenen Snapshot nur regelkonforme Folgekarten sehen, damit das Frontend keine ungueltigen Zuege anbietet.");
    }

    @Test
    void lehntUngueltigeKartePerWebSocketBeiBedienpflichtAb() {
        SpielSetup setup = starteVierSpielerTisch("Ungueltige Karte");
        setzeKontrollierteStandardhaende(setup.partieId());
        meldeGesundesSpiel(setup);
        webSocketController.spieleKarte(
            setup.tischId(),
            new KarteSpielenAnfrage("KREUZ-AS-1"),
            principal(setup.sessionIds().get(SpielerPosition.WEST))
        );
        // Auf asynchrone Events des gültigen Zugs warten, bevor der Speicher geleert wird
        findeBenutzerNachricht(setup.sessionIds().get(SpielerPosition.WEST), "/queue/partie/" + setup.partieId(), PartieEreignisBatch.class);
        nachrichtenSpeicher.leeren();

        // Bedienpflicht-Verletzung ist ein Regelverstoß → UngueltigerSpielzugException (422, nicht 409)
        UngueltigerSpielzugException exception = assertThrows(
            UngueltigerSpielzugException.class,
            () -> webSocketController.spieleKarte(
                setup.tischId(),
                new KarteSpielenAnfrage("PIK-AS-1"),
                principal(setup.sessionIds().get(SpielerPosition.NORD))
            )
        );

        assertTrue(exception.getMessage().contains("Bedienpflicht"),
            "Die Fehlermeldung muss die Bedienpflicht als Ursache nennen.");
        assertTrue(nachrichtenSpeicher.nachrichten().isEmpty(),
            "Ein bedienpflichtwidriger Zug darf keine WebSocket-Folgeevents ausloesen, damit alle Clients auf demselben unveraenderten Stichstand bleiben.");
    }

    @Test
    void verarbeitetAnsagePerWebSocketUndOffenbartDieParteiImBenutzersnapshot() {
        SpielSetup setup = starteVierSpielerTisch("Ansagentisch");
        setzeKontrollierteStandardhaende(setup.partieId());
        meldeGesundesSpiel(setup);
        nachrichtenSpeicher.leeren();

        webSocketController.sageAn(
            setup.tischId(),
            new AnsageAnfrage(Ansage.RE),
            principal(setup.sessionIds().get(SpielerPosition.WEST))
        );

        WebSocketNachrichtGesendet broadcastNachricht = findeBenutzerNachricht(
            setup.sessionIds().get(SpielerPosition.WEST),
            "/queue/partie/" + setup.partieId(),
            PartieEreignisBatch.class
        );
        PartieEreignisAntwort broadcast = ((PartieEreignisBatch) broadcastNachricht.payload()).ereignisse().get(0);
        assertEquals(1, broadcast.partieStand().laufendesSpiel().ansageHistorie().size(),
            "Nach einer gueltigen Ansage muss die Broadcast-Historie wachsen, damit Frontend und spaetere KI denselben Ansagezustand kennen.");
        assertEquals(Ansage.RE, broadcast.partieStand().laufendesSpiel().ansageHistorie().getFirst().ansage());
        assertEquals(SpielerPosition.WEST, broadcast.partieStand().laufendesSpiel().ansageHistorie().getFirst().spielerPosition());

        WebSocketNachrichtGesendet nordSnapshotNachricht = findeBenutzerNachricht(
            setup.sessionIds().get(SpielerPosition.NORD),
            "/queue/partie/" + setup.partieId(),
            PartieEreignisBatch.class
        );
        PartieEreignisAntwort nordSnapshot = ((PartieEreignisBatch) nordSnapshotNachricht.payload()).ereignisse().get(0);
        PartieStandAntwort.SpielerImSpielAntwort westAusNordSicht = nordSnapshot.partieStand().laufendesSpiel().spieler().stream()
            .filter(spieler -> spieler.position() == SpielerPosition.WEST)
            .findFirst()
            .orElseThrow();
        assertEquals(Partei.RE, westAusNordSicht.partei(),
            "Eine Re-Ansage muss die Partei des ansagenden Spielers im benutzerbezogenen Snapshot offenbaren, damit Mitspieler den Zustand korrekt sehen.");
    }

    @Test
    void lehntUngueltigeAnsagePerWebSocketAb() {
        SpielSetup setup = starteVierSpielerTisch("Ungueltige Ansage");
        setzeKontrollierteStandardhaende(setup.partieId());
        meldeGesundesSpiel(setup);
        // Auf asynchrone Events der Vorbehaltsrunde warten, bevor der Speicher geleert wird
        findeBenutzerNachricht(setup.sessionIds().get(SpielerPosition.WEST), "/queue/partie/" + setup.partieId(), PartieEreignisBatch.class);
        nachrichtenSpeicher.leeren();

        SpielverwaltungKonfliktException exception = assertThrows(
            SpielverwaltungKonfliktException.class,
            () -> webSocketController.sageAn(
                setup.tischId(),
                new AnsageAnfrage(Ansage.KONTRA),
                principal(setup.sessionIds().get(SpielerPosition.WEST))
            )
        );

        assertEquals("ANSAGE_UNGUELTIG", exception.fehlerCode());
        assertTrue(nachrichtenSpeicher.nachrichten().isEmpty(),
            "Eine ungueltige Ansage darf keinen Broadcast ausloesen, damit der serverseitige Ansagezustand fuer alle Clients unveraendert bleibt.");
    }

    @Test
    void wirftSpielEinWennNiemandDieArmutPerWebSocketAnnimmt() {
        // Wichtig: Wenn niemand die Armut annimmt, muss das Backend das Spiel einwerfen
        // und einen WebSocket-Broadcast mit der neuen Vorbehaltsrunde senden, damit das
        // Frontend den erzwungenen Neustart ohne Polling erkennen kann.
        SpielSetup setup = starteVierSpielerTisch("Einwurftisch");
        setzeKontrollierteArmutshaende(setup.partieId());
        nachrichtenSpeicher.leeren();

        webSocketController.meldeVorbehalt(setup.tischId(), new VorbehaltAnfrage(VorbehaltAnsage.ARMUT), principal(setup.sessionIds().get(SpielerPosition.WEST)));
        webSocketController.meldeVorbehalt(setup.tischId(), new VorbehaltAnfrage(VorbehaltAnsage.GESUND), principal(setup.sessionIds().get(SpielerPosition.NORD)));
        webSocketController.meldeVorbehalt(setup.tischId(), new VorbehaltAnfrage(VorbehaltAnsage.GESUND), principal(setup.sessionIds().get(SpielerPosition.OST)));
        webSocketController.meldeVorbehalt(setup.tischId(), new VorbehaltAnfrage(VorbehaltAnsage.GESUND), principal(setup.sessionIds().get(SpielerPosition.SUED)));

        // WEST legt Trumpfkarten an (Armut-Angebot)
        webSocketController.verarbeiteArmutAntwort(
            setup.tischId(),
            new ArmutAntwortAnfrage(false, List.of("KREUZ-DAME-1", "KREUZ-BUBE-1", "KARO-AS-1")),
            principal(setup.sessionIds().get(SpielerPosition.WEST))
        );
        // Alle drei Mitspieler lehnen ab
        webSocketController.verarbeiteArmutAntwort(setup.tischId(), new ArmutAntwortAnfrage(false, List.of()), principal(setup.sessionIds().get(SpielerPosition.NORD)));
        webSocketController.verarbeiteArmutAntwort(setup.tischId(), new ArmutAntwortAnfrage(false, List.of()), principal(setup.sessionIds().get(SpielerPosition.OST)));
        webSocketController.verarbeiteArmutAntwort(setup.tischId(), new ArmutAntwortAnfrage(false, List.of()), principal(setup.sessionIds().get(SpielerPosition.SUED)));

        WebSocketNachrichtGesendet broadcast = findeBenutzerNachricht(setup.sessionIds().get(SpielerPosition.WEST), "/queue/partie/" + setup.partieId(), PartieEreignisBatch.class);
        PartieEreignisAntwort ereignis = ((PartieEreignisBatch) broadcast.payload()).ereignisse().get(0);

        assertEquals("VORBEHALT_ANSAGE", ereignis.partieStand().laufendesSpiel().phase(),
            "Wenn niemand die Armut annimmt, muss das Spiel eingeworfen und ein Broadcast mit der neuen Vorbehaltsphase gesendet werden.");
        ereignis.partieStand().laufendesSpiel().spieler().forEach(spieler ->
            assertEquals(10, spieler.verbleibendeKarten(),
                "Nach einem Armut-Einwurf muss jeder Spieler wieder 10 Karten erhalten (locoBlatRegeln=ohneNeunen), damit die neue Vorbehaltsrunde auf einem vollstaendigen Deck basiert."));
    }

    @Test
    void unterstuetztWiederholteArmutEinwuerfe() {
        // Wichtig: Laut Spec gibt es keine Begrenzung fuer die Anzahl der Einwuerfe.
        // Dieser Test beweist, dass zwei aufeinanderfolgende Armut-Einwuerfe korrekt
        // verarbeitet werden und das Spiel nach jedem Einwurf wieder in VORBEHALT_ANSAGE
        // landet, ohne kuenstliche Grenzen oder Zustandsfehler.
        SpielSetup setup = starteVierSpielerTisch("WiederholterEinwurftisch");

        // --- Erster Einwurf ---
        setzeKontrollierteArmutshaende(setup.partieId());
        webSocketController.meldeVorbehalt(setup.tischId(), new VorbehaltAnfrage(VorbehaltAnsage.ARMUT), principal(setup.sessionIds().get(SpielerPosition.WEST)));
        webSocketController.meldeVorbehalt(setup.tischId(), new VorbehaltAnfrage(VorbehaltAnsage.GESUND), principal(setup.sessionIds().get(SpielerPosition.NORD)));
        webSocketController.meldeVorbehalt(setup.tischId(), new VorbehaltAnfrage(VorbehaltAnsage.GESUND), principal(setup.sessionIds().get(SpielerPosition.OST)));
        webSocketController.meldeVorbehalt(setup.tischId(), new VorbehaltAnfrage(VorbehaltAnsage.GESUND), principal(setup.sessionIds().get(SpielerPosition.SUED)));
        webSocketController.verarbeiteArmutAntwort(setup.tischId(), new ArmutAntwortAnfrage(false, List.of("KREUZ-DAME-1", "KREUZ-BUBE-1", "KARO-AS-1")), principal(setup.sessionIds().get(SpielerPosition.WEST)));
        webSocketController.verarbeiteArmutAntwort(setup.tischId(), new ArmutAntwortAnfrage(false, List.of()), principal(setup.sessionIds().get(SpielerPosition.NORD)));
        webSocketController.verarbeiteArmutAntwort(setup.tischId(), new ArmutAntwortAnfrage(false, List.of()), principal(setup.sessionIds().get(SpielerPosition.OST)));
        webSocketController.verarbeiteArmutAntwort(setup.tischId(), new ArmutAntwortAnfrage(false, List.of()), principal(setup.sessionIds().get(SpielerPosition.SUED)));

        // --- Zweiter Einwurf ---
        // Nach dem ersten Einwurf kontrollierte Haende erneut setzen (dasselbe Spiel,
        // da uebernehmeDomainSpiel in-place aktualisiert und keine neue Entitaet anlegt).
        setzeKontrollierteArmutshaende(setup.partieId());
        nachrichtenSpeicher.leeren();

        webSocketController.meldeVorbehalt(setup.tischId(), new VorbehaltAnfrage(VorbehaltAnsage.ARMUT), principal(setup.sessionIds().get(SpielerPosition.WEST)));
        webSocketController.meldeVorbehalt(setup.tischId(), new VorbehaltAnfrage(VorbehaltAnsage.GESUND), principal(setup.sessionIds().get(SpielerPosition.NORD)));
        webSocketController.meldeVorbehalt(setup.tischId(), new VorbehaltAnfrage(VorbehaltAnsage.GESUND), principal(setup.sessionIds().get(SpielerPosition.OST)));
        webSocketController.meldeVorbehalt(setup.tischId(), new VorbehaltAnfrage(VorbehaltAnsage.GESUND), principal(setup.sessionIds().get(SpielerPosition.SUED)));
        webSocketController.verarbeiteArmutAntwort(setup.tischId(), new ArmutAntwortAnfrage(false, List.of("KREUZ-DAME-1", "KREUZ-BUBE-1", "KARO-AS-1")), principal(setup.sessionIds().get(SpielerPosition.WEST)));
        webSocketController.verarbeiteArmutAntwort(setup.tischId(), new ArmutAntwortAnfrage(false, List.of()), principal(setup.sessionIds().get(SpielerPosition.NORD)));
        webSocketController.verarbeiteArmutAntwort(setup.tischId(), new ArmutAntwortAnfrage(false, List.of()), principal(setup.sessionIds().get(SpielerPosition.OST)));
        webSocketController.verarbeiteArmutAntwort(setup.tischId(), new ArmutAntwortAnfrage(false, List.of()), principal(setup.sessionIds().get(SpielerPosition.SUED)));

        WebSocketNachrichtGesendet broadcast = findeBenutzerNachricht(setup.sessionIds().get(SpielerPosition.WEST), "/queue/partie/" + setup.partieId(), PartieEreignisBatch.class);
        PartieEreignisAntwort ereignis = ((PartieEreignisBatch) broadcast.payload()).ereignisse().get(0);

        assertEquals("VORBEHALT_ANSAGE", ereignis.partieStand().laufendesSpiel().phase(),
            "Wiederholte Armut-Einwuerfe muessen unbegrenzt moeglich sein; auch nach dem zweiten Einwurf muss das Spiel wieder in der Vorbehaltsphase sein.");
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
            .orElseThrow(() -> new AssertionError("Es wurde keine Partie-ID fuer den gestarteten Tisch publiziert."));
        Map<SpielerPosition, String> sessionIds = Map.of(
            SpielerPosition.SUED, extrahiereSessionId(suedCookie),
            SpielerPosition.WEST, extrahiereSessionId(westCookie),
            SpielerPosition.NORD, extrahiereSessionId(nordCookie),
            SpielerPosition.OST, extrahiereSessionId(ostCookie)
        );
        return new SpielSetup(tisch.id(), partieId, sessionIds);
    }

    private void setzeKontrollierteArmutshaende(UUID partieId) {
        setzeKontrollierteHaende(partieId, Map.of(
            SpielerPosition.WEST, handMitDreiTruepfen(
                karte(Farbe.KREUZ, Kartenwert.DAME, 1),
                karte(Farbe.KREUZ, Kartenwert.BUBE, 1),
                karte(Farbe.KARO, Kartenwert.AS, 1)
            ),
            SpielerPosition.OST, gegenhandFuerArmutAnnahme(
                karte(Farbe.KREUZ, Kartenwert.AS, 2),
                karte(Farbe.PIK, Kartenwert.AS, 2),
                karte(Farbe.HERZ, Kartenwert.AS, 1)
            )
        ));
    }

    private void setzeKontrollierteStandardhaende(UUID partieId) {
        setzeKontrollierteHaende(partieId, Map.of(
            SpielerPosition.WEST, List.of(
                karte(Farbe.KREUZ, Kartenwert.AS, 1),
                karte(Farbe.KREUZ, Kartenwert.DAME, 1),
                karte(Farbe.PIK, Kartenwert.ZEHN, 1)
            ),
            SpielerPosition.NORD, List.of(
                karte(Farbe.KREUZ, Kartenwert.ZEHN, 1),
                karte(Farbe.KREUZ, Kartenwert.AS, 2),
                karte(Farbe.PIK, Kartenwert.AS, 1)
            ),
            SpielerPosition.OST, List.of(
                karte(Farbe.KREUZ, Kartenwert.KOENIG, 1),
                karte(Farbe.KREUZ, Kartenwert.DAME, 2),
                karte(Farbe.HERZ, Kartenwert.KOENIG, 1)
            ),
            SpielerPosition.SUED, List.of(
                karte(Farbe.KARO, Kartenwert.KOENIG, 1),
                karte(Farbe.HERZ, Kartenwert.AS, 1),
                karte(Farbe.PIK, Kartenwert.KOENIG, 1)
            )
        ));
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

    private void meldeGesundesSpiel(SpielSetup setup) {
        webSocketController.meldeVorbehalt(setup.tischId(), new VorbehaltAnfrage(VorbehaltAnsage.GESUND), principal(setup.sessionIds().get(SpielerPosition.WEST)));
        webSocketController.meldeVorbehalt(setup.tischId(), new VorbehaltAnfrage(VorbehaltAnsage.GESUND), principal(setup.sessionIds().get(SpielerPosition.NORD)));
        webSocketController.meldeVorbehalt(setup.tischId(), new VorbehaltAnfrage(VorbehaltAnsage.GESUND), principal(setup.sessionIds().get(SpielerPosition.OST)));
        webSocketController.meldeVorbehalt(setup.tischId(), new VorbehaltAnfrage(VorbehaltAnsage.GESUND), principal(setup.sessionIds().get(SpielerPosition.SUED)));
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

    private List<Karte> handMitDreiTruepfen(Karte ersteTrumpfkarte, Karte zweiteTrumpfkarte, Karte dritteTrumpfkarte) {
        // 3 Trumpfkarten + 7 Nichttruempfe (ohne NEUN — locoBlatRegeln=ohneNeunen) = 10 Karten
        return List.of(
            ersteTrumpfkarte,
            zweiteTrumpfkarte,
            dritteTrumpfkarte,
            karte(Farbe.KREUZ, Kartenwert.AS, 1),
            karte(Farbe.KREUZ, Kartenwert.KOENIG, 1),
            karte(Farbe.KREUZ, Kartenwert.ZEHN, 1),
            karte(Farbe.PIK, Kartenwert.AS, 1),
            karte(Farbe.PIK, Kartenwert.KOENIG, 1),
            karte(Farbe.PIK, Kartenwert.ZEHN, 1),
            karte(Farbe.HERZ, Kartenwert.KOENIG, 1)
        );
    }

    private List<Karte> gegenhandFuerArmutAnnahme(Karte rueckgabeEins, Karte rueckgabeZwei, Karte rueckgabeDrei) {
        // 3 Rueckgabekarten + 7 Fuellkarten (ohne NEUN — locoBlatRegeln=ohneNeunen) = 10 Karten
        return List.of(
            rueckgabeEins,
            rueckgabeZwei,
            rueckgabeDrei,
            karte(Farbe.KREUZ, Kartenwert.KOENIG, 2),
            karte(Farbe.KREUZ, Kartenwert.ZEHN, 2),
            karte(Farbe.PIK, Kartenwert.KOENIG, 2),
            karte(Farbe.PIK, Kartenwert.ZEHN, 2),
            karte(Farbe.HERZ, Kartenwert.KOENIG, 2),
            karte(Farbe.HERZ, Kartenwert.AS, 2),
            karte(Farbe.KARO, Kartenwert.BUBE, 1)
        );
    }

    private Karte karte(Farbe farbe, Kartenwert wert, int exemplarIndex) {
        return new Karte(farbe, wert, exemplarIndex);
    }

    private static final Duration ASYNC_TIMEOUT = Duration.ofSeconds(5);

    private WebSocketNachrichtGesendet findeLetzteNachricht(
        String ziel,
        Class<?> payloadTyp
    ) {
        await().atMost(ASYNC_TIMEOUT).until(() ->
            nachrichtenSpeicher.nachrichten().stream()
                .anyMatch(n -> ziel.equals(n.ziel()) && payloadTyp.isInstance(n.payload()))
        );
        return nachrichtenSpeicher.nachrichten().stream()
            .filter(nachricht -> ziel.equals(nachricht.ziel()) && payloadTyp.isInstance(nachricht.payload()))
            .reduce((erstes, zweites) -> zweites)
            .orElseThrow(() -> new AssertionError("Es wurde keine passende WebSocket-Nachricht fuer " + ziel + " gefunden."));
    }

    private WebSocketNachrichtGesendet findeBenutzerNachricht(
        String benutzer,
        String ziel,
        Class<?> payloadTyp
    ) {
        await().atMost(ASYNC_TIMEOUT).until(() ->
            nachrichtenSpeicher.nachrichten().stream()
                .anyMatch(n -> ziel.equals(n.ziel())
                    && benutzer.equals(n.benutzer())
                    && payloadTyp.isInstance(n.payload()))
        );
        return nachrichtenSpeicher.nachrichten().stream()
            .filter(nachricht -> ziel.equals(nachricht.ziel())
                && benutzer.equals(nachricht.benutzer())
                && payloadTyp.isInstance(nachricht.payload()))
            .reduce((erstes, zweites) -> zweites)
            .orElseThrow(() -> new AssertionError("Es wurde keine benutzerbezogene Snapshot-Nachricht publiziert."));
    }

    private String url(String pfad) {
        return "http://localhost:" + port + pfad;
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

    private Principal principal(String sessionId) {
        return () -> sessionId;
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

    private record SpielSetup(UUID tischId, UUID partieId, Map<SpielerPosition, String> sessionIds) {
    }
}
