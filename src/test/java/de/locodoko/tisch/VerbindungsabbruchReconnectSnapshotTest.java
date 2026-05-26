package de.locodoko.tisch;

import de.locodoko.karten.Augen;
import de.locodoko.karten.Farbe;
import de.locodoko.karten.Kartendeck;
import de.locodoko.karten.Kartenwert;
import de.locodoko.karten.Karte;
import de.locodoko.karten.Spielregeln;
import de.locodoko.partie.Partie;
import de.locodoko.partie.Partei;
import de.locodoko.partie.Spiel;
import de.locodoko.partie.Spielergebnis;
import de.locodoko.partie.Spielpunkte;
import de.locodoko.partie.SpielerPosition;
import de.locodoko.partie.SonderpunktEreignis;
import de.locodoko.partie.VorbehaltAnsage;
import de.locodoko.spieler.SpielerEntity;
import de.locodoko.spieler.SpielerId;
import de.locodoko.spieler.SpielerRepository;
import de.locodoko.tisch.persistenz.PartieRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Prüft ob {@link VerbindungsabbruchService#verarbeiteReconnect} nach einem Ctrl+R-Reload
 * den korrekten Spielstand (Spiel 2, nicht Spiel 1) im Snapshot liefert.
 *
 * <p>Hintergrund: Ctrl+R löst ~5 schnelle SockJS-Reconnect-Zyklen aus. Jeder Zyklus
 * schickt einen PartieSnapshot. Die Frage: Zeigt der Snapshot korrekt Spiel 2,
 * oder schickt das Backend fälschlicherweise Spiel 1?</p>
 *
 * <p>Kein class-level {@code @Transactional}: Die {@code afterCommit}-Hooks in
 * {@link TischEchtzeitService} feuern nur nach einem echten DB-Commit, deshalb
 * wird {@link TransactionTemplate} für den Setup verwendet.</p>
 */
@SpringBootTest
@Import(VerbindungsabbruchReconnectSnapshotTest.TestKonfiguration.class)
class VerbindungsabbruchReconnectSnapshotTest {

    @Autowired
    private VerbindungsabbruchService verbindungsabbruchService;

    @Autowired
    private TischRepository tischRepository;

    @Autowired
    private SpielerRepository spielerRepository;

    @Autowired
    private PartieRepository partieRepository;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @Autowired
    private TestWebSocketNachrichtenSpeicher nachrichtenSpeicher;

    @BeforeEach
    void setUp() {
        nachrichtenSpeicher.leeren();
    }

    /**
     * Einfacher Reconnect: Nach einem Disconnect + Reconnect muss der Snapshot
     * das laufende Spiel 2 zeigen, nicht das abgeschlossene Spiel 1.
     */
    @Test
    void reconnectSnapshotZeigtSpiel2NachErstemReconnect() {
        TischUndSpieler setup = legeSpielzustandAn();

        transactionTemplate.executeWithoutResult(status -> {
            verbindungsabbruchService.verarbeiteDisconnect(
                setup.httpSessionId(), SpielerId.von(setup.spielerId()), "Testerin");
            verbindungsabbruchService.verarbeiteReconnect(
                setup.httpSessionId(), SpielerId.von(setup.spielerId()), "Testerin");
        });

        List<WebSocketNachrichtGesendet> nachrichten = nachrichtenSpeicher.nachrichten();
        PartieEreignisAntwort snapshot = findePartieSnapshot(nachrichten, setup.httpSessionId(), setup.partieId());

        assertNotNull(snapshot.partieStand(), "Snapshot muss einen PartieStand enthalten");
        assertNotNull(snapshot.partieStand().laufendesSpiel(),
            "Snapshot muss ein laufendes Spiel enthalten — Spiel 2 ist noch nicht abgeschlossen");
        assertEquals(2, snapshot.partieStand().laufendesSpiel().spielNummer(),
            "Nach Reconnect muss der Snapshot Spiel 2 anzeigen, nicht das abgeschlossene Spiel 1. " +
            "Schlägt dieser Test fehl, liegt der Ctrl+R-Fehler im Backend.");
    }

    /**
     * Mehrfach-Reconnect (simuliert 5 schnelle SockJS-Reconnects wie bei Ctrl+R):
     * Auch nach 5 Zyklen muss der letzte Snapshot Spiel 2 zeigen.
     */
    @Test
    void reconnectSnapshotZeigtSpiel2NachFuenfSchnellenReconnects() {
        TischUndSpieler setup = legeSpielzustandAn();

        // 5 schnelle Disconnect+Reconnect-Zyklen (wie SockJS bei Ctrl+R)
        for (int i = 0; i < 5; i++) {
            String sessionId = setup.httpSessionId() + "-sock-" + i;
            transactionTemplate.executeWithoutResult(status -> {
                verbindungsabbruchService.verarbeiteDisconnect(
                    sessionId, SpielerId.von(setup.spielerId()), "Testerin");
                verbindungsabbruchService.verarbeiteReconnect(
                    sessionId, SpielerId.von(setup.spielerId()), "Testerin");
            });
        }

        List<WebSocketNachrichtGesendet> nachrichten = nachrichtenSpeicher.nachrichten();

        // Alle gesendeten Snapshots müssen Spiel 2 zeigen
        List<PartieEreignisAntwort> snapshots = findeAllePartieSnapshots(nachrichten, setup.partieId());
        assertTrue(snapshots.size() >= 5,
            "Bei 5 Reconnect-Zyklen müssen mindestens 5 Snapshots gesendet worden sein, waren: " + snapshots.size());

        for (int i = 0; i < snapshots.size(); i++) {
            PartieEreignisAntwort snapshot = snapshots.get(i);
            assertNotNull(snapshot.partieStand().laufendesSpiel(),
                "Snapshot " + i + " muss ein laufendes Spiel enthalten");
            assertEquals(2, snapshot.partieStand().laufendesSpiel().spielNummer(),
                "Snapshot " + i + " nach Ctrl+R-Reconnect muss Spiel 2 anzeigen, nicht Spiel 1. " +
                "Backend-Bug wenn hier fehlschlägt.");
        }
    }

    // -------------------------------------------------------------------------
    // Setup-Helpers
    // -------------------------------------------------------------------------

    private record TischUndSpieler(UUID spielerId, String httpSessionId, UUID partieId) {}

    /**
     * Legt einen Tisch mit 1 Mensch + 3 KI an, mit einer Partie die aus
     * Spiel 1 (abgeschlossen) + Spiel 2 (laufend, in der Stichphase) besteht.
     */
    private TischUndSpieler legeSpielzustandAn() {
        return transactionTemplate.execute(status -> {
            String httpSessionId = "session-reconnect-" + UUID.randomUUID();
            SpielerEntity mensch = SpielerEntity.menschlich("Testerin", httpSessionId);
            spielerRepository.save(mensch);

            TischEntity tisch = TischEntity.neu(
                "Reconnect-Snapshot-Test",
                mensch,
                TischkonfigurationEmbeddable.ausSpielregeln(Spielregeln.standardRegeln(), 2)
            );
            tisch.fuegeSpielerHinzu(mensch);
            tisch.fuegeSpielerHinzu(SpielerEntity.ki("KI Bert"));
            tisch.fuegeSpielerHinzu(SpielerEntity.ki("KI Clara"));
            tisch.fuegeSpielerHinzu(SpielerEntity.ki("KI Dora"));
            tischRepository.save(tisch);

            // Partie mit zwei Spielen anlegen
            Partie partie = Partie.neuePersistenz(2);

            // Spiel 1: vollständig abgeschlossen
            Spiel spiel1 = gesundesStichspiel();
            spiel1.setzeSpielNummer(1);
            spiel1.setzeErgebnis(minimalErgebnis());
            partie.fuegeSpielHinzu(spiel1);

            // Spiel 2: läuft noch (kein Ergebnis)
            Spiel spiel2 = gesundesStichspiel();
            spiel2.setzeSpielNummer(2);
            partie.fuegeSpielHinzu(spiel2);

            tisch.setzePartie(partie);
            tischRepository.saveAndFlush(tisch);

            return new TischUndSpieler(mensch.id(), httpSessionId, partie.id());
        });
    }

    private Spiel gesundesStichspiel() {
        Spielregeln regeln = Spielregeln.standardRegeln();
        Kartendeck deck = Kartendeck.neu(regeln);
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, regeln, deck);
        spiel.teileKartenAus();
        for (SpielerPosition position : SpielerPosition.imUhrzeigersinnAb(SpielerPosition.WEST)) {
            spiel.meldeVorbehalt(position, VorbehaltAnsage.GESUND);
        }
        spiel.loeseVorbehalteAuf();
        return spiel;
    }

    private Spielergebnis minimalErgebnis() {
        return new Spielergebnis(
            Map.of(Partei.RE, new Augen(130), Partei.KONTRA, new Augen(110)),
            Partei.RE,
            new Spielpunkte(1),
            1, 0, 0, 1,
            Map.of(
                SpielerPosition.SUED, new Spielpunkte(-1),
                SpielerPosition.WEST, new Spielpunkte(1),
                SpielerPosition.NORD, new Spielpunkte(1),
                SpielerPosition.OST, new Spielpunkte(-1)
            ),
            Map.of(Partei.RE, List.of(), Partei.KONTRA, List.of())
        );
    }

    // -------------------------------------------------------------------------
    // Assertion-Helpers
    // -------------------------------------------------------------------------

    private PartieEreignisAntwort findePartieSnapshot(
        List<WebSocketNachrichtGesendet> nachrichten,
        String benutzer,
        UUID partieId
    ) {
        String ziel = "/queue/partie/" + partieId;
        return nachrichten.stream()
            .filter(n -> ziel.equals(n.ziel()) && benutzer.equals(n.benutzer())
                && n.payload() instanceof PartieEreignisBatch batch
                && batch.ereignisse().stream().anyMatch(e -> e.ereignisTyp() == PartieEreignisTyp.SNAPSHOT))
            .map(n -> ((PartieEreignisBatch) n.payload()).ereignisse().stream()
                .filter(e -> e.ereignisTyp() == PartieEreignisTyp.SNAPSHOT)
                .findFirst().orElseThrow())
            .findFirst()
            .orElseThrow(() -> new AssertionError(
                "Kein SNAPSHOT für Benutzer '" + benutzer + "' auf '" + ziel + "' gefunden. " +
                "Nachrichten: " + nachrichten.stream().map(n -> n.ziel() + "/" + n.benutzer()).toList()));
    }

    private List<PartieEreignisAntwort> findeAllePartieSnapshots(
        List<WebSocketNachrichtGesendet> nachrichten,
        UUID partieId
    ) {
        String ziel = "/queue/partie/" + partieId;
        return nachrichten.stream()
            .filter(n -> ziel.equals(n.ziel())
                && n.payload() instanceof PartieEreignisBatch batch
                && batch.ereignisse().stream().anyMatch(e -> e.ereignisTyp() == PartieEreignisTyp.SNAPSHOT))
            .map(n -> ((PartieEreignisBatch) n.payload()).ereignisse().stream()
                .filter(e -> e.ereignisTyp() == PartieEreignisTyp.SNAPSHOT)
                .findFirst().orElseThrow())
            .toList();
    }

    // -------------------------------------------------------------------------
    // Test-Infrastruktur
    // -------------------------------------------------------------------------

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
