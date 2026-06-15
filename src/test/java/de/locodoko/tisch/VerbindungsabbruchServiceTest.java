package de.locodoko.tisch;

import de.locodoko.spieler.SpielerEntity;
import de.locodoko.spieler.SpielerId;
import de.locodoko.spieler.SpielerRepository;

import de.locodoko.spieler.SpielerEntity;
import de.locodoko.spieler.SpielerRepository;
import de.locodoko.tisch.TischEntity;
import de.locodoko.tisch.TischId;
import de.locodoko.tisch.TischRepository;
import de.locodoko.tisch.TischStatus;
import de.locodoko.tisch.TischkonfigurationEmbeddable;
import de.locodoko.tisch.PartieStandAntwort;
import de.locodoko.tisch.KiSpielerFabrik;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Tests für den {@link VerbindungsabbruchService}.
 *
 * <p>Warum diese Tests wichtig sind:
 * <ul>
 *   <li>Der Disconnect-Mechanismus ist sicherheitskritisch: Ohne ihn würde ein getrennter Spieler
 *       die ganze Partie blockieren, weil die KI-Orchestrierung bei seinem Zug stoppt.</li>
 *   <li>Das Reconnect-Fenster muss korrekt erkannt werden, damit kein Spieler unbeabsichtigt
 *       durch die KI ersetzt wird.</li>
 *   <li>Die KI-Übernahme muss den Spieler persistent markieren, damit sie auch nach einem
 *       Neustart der Orchestrierung (neuer HTTP-Request) greift.</li>
 * </ul>
 */
@SpringBootTest
@Transactional
class VerbindungsabbruchServiceTest {

    @Autowired
    private VerbindungsabbruchService verbindungsabbruchService;

    @Autowired
    private TischRepository tischRepository;

    @Autowired
    private SpielerRepository spielerRepository;

    @Autowired
    private KiSpielerFabrik kiSpielerFabrik;

    @Autowired
    private PartieCountdownService partieCountdownService;

    private SpielerEntity menschlicherSpieler;
    private TischEntity tisch;

    @BeforeEach
    void setUp() {
        // Einfacher Tisch mit einem menschlichen Spieler für alle Tests
        menschlicherSpieler = SpielerEntity.menschlich("Testerin", "session-test-" + UUID.randomUUID().toString());
        spielerRepository.save(menschlicherSpieler);

        tisch = TischEntity.neu("Verbindungstest-Tisch", menschlicherSpieler, TischkonfigurationEmbeddable.standard());
        tisch.fuegeSpielerHinzu(menschlicherSpieler);
        tischRepository.save(tisch);
    }

    /**
     * Disconnect-Erkennung: Ein getrennter Spieler muss sofort als "getrennt" geführt werden.
     * Ohne dieses Flag würde die KI den Spieler nicht übernehmen können.
     */
    @Test
    void spielerWirdNachDisconnectAlsGetrenntMarkiert() {
        String sessionId = menschlicherSpieler.sessionId();
        UUID spielerId = menschlicherSpieler.id();

        verbindungsabbruchService.verarbeiteDisconnect(sessionId, SpielerId.von(spielerId), menschlicherSpieler.name());

        assertTrue(
                verbindungsabbruchService.istGetrennt(sessionId),
                "Ein getrennter Spieler muss sofort im Disconnect-Tracking erfasst werden, " +
                "damit der Reconnect-Timer läuft und die KI später übernehmen kann."
        );
    }

    /**
     * Reconnect-Logik: Ein Spieler, der sich innerhalb des Timeouts reconnectet,
     * muss wieder als verbunden gelten — der KI-Übernahme-Timer darf nicht weiter laufen.
     */
    @Test
    void spielerNichtMehrGetrenntNachReconnect() {
        String sessionId = menschlicherSpieler.sessionId();
        UUID spielerId = menschlicherSpieler.id();

        verbindungsabbruchService.verarbeiteDisconnect(sessionId, SpielerId.von(spielerId), menschlicherSpieler.name());
        assertTrue(verbindungsabbruchService.istGetrennt(sessionId));

        verbindungsabbruchService.verarbeiteReconnect(sessionId, SpielerId.von(spielerId), menschlicherSpieler.name());

        assertFalse(
                verbindungsabbruchService.istGetrennt(sessionId),
                "Nach einem Reconnect darf der Spieler nicht mehr als getrennt gelten — " +
                "sonst würde die KI ihn nach dem Timeout doch noch übernehmen."
        );
    }

    /**
     * Erstverbindung: Ein Spieler, der sich zum ersten Mal verbindet, wird nicht als Reconnect gewertet.
     * Dies verhindert ungewollte Broadcasts oder Statusänderungen bei Erstverbindungen.
     */
    @Test
    void erstverbindungLoesstKeinenReconnectAus() {
        String sessionId = menschlicherSpieler.sessionId();
        UUID spielerId = menschlicherSpieler.id();

        // Kein vorheriger Disconnect — soll keine Exception und keinen Eintrag erzeugen
        verbindungsabbruchService.verarbeiteReconnect(sessionId, SpielerId.von(spielerId), menschlicherSpieler.name());

        assertFalse(
                verbindungsabbruchService.istGetrennt(sessionId),
                "Beim ersten Verbinden gibt es keinen Disconnect-Timer — " +
                "verarbeiteReconnect muss das stillschweigend ignorieren."
        );
    }

    /**
     * Null-Sicherheit: Disconnect mit fehlenden Attributen (z. B. fehlgeschlagener Handshake)
     * darf keine Exception werfen.
     */
    @Test
    void disconnectMitNullAttributenWirftKeineException() {
        // Fehlgeschlagene Handshakes können SessionDisconnectEvents ohne Spieler-Attribute erzeugen
        verbindungsabbruchService.verarbeiteDisconnect(null, null, null, null);
        // Kein Fehler erwartet
    }

    /**
     * KiUebernommen-Flag: Nach der KI-Übernahme muss der Spieler in der Datenbank
     * als kiUebernommen markiert sein, damit KiOrchestrierungService auch nach einem
     * Neustart der Orchestrierung für ihn spielt.
     */
    @Test
    void spielerWirdNachKiUebernahmeInDbMarkiert() {
        SpielerEntity spieler = spielerRepository.findById(menschlicherSpieler.id()).orElseThrow();
        spieler.markiereAlsKiUebernommen();
        spielerRepository.save(spieler);

        SpielerEntity geladen = spielerRepository.findById(menschlicherSpieler.id()).orElseThrow();
        assertTrue(
                geladen.istKiUebernommen(),
                "Das kiUebernommen-Flag muss persistiert werden, damit die KI-Orchestrierung " +
                "auch nach Server-Neustart oder erneutem DB-Laden für den Spieler weiter spielen kann."
        );
    }

    /**
     * KiUebernommen aufheben: Beim Start des nächsten Spiels muss das kiUebernommen-Flag
     * zurückgesetzt werden, damit ein reconnecteter Spieler wieder selbst spielen kann.
     */
    @Test
    void kiUebernahmeWirdNachSpielstartAufgehoben() {
        SpielerEntity spieler = spielerRepository.findById(menschlicherSpieler.id()).orElseThrow();
        spieler.markiereAlsKiUebernommen();
        spielerRepository.save(spieler);

        SpielerEntity markiert = spielerRepository.findById(menschlicherSpieler.id()).orElseThrow();
        assertTrue(markiert.istKiUebernommen());

        markiert.hebeKiUebernahmeAuf();
        spielerRepository.save(markiert);

        SpielerEntity aufgehoben = spielerRepository.findById(menschlicherSpieler.id()).orElseThrow();
        assertFalse(
                aufgehoben.istKiUebernommen(),
                "Nach dem Spielstart muss die KI-Übernahme aufgehoben sein, damit " +
                "reconnectete Spieler ihr nächstes Spiel wieder selbst steuern können."
        );
    }

    /**
     * Countdown-Abbruch: Wenn der letzte menschliche Spieler den Timeout überschreitet und der Tisch
     * auf WARTEND gesetzt wird, muss ein laufender Partie-Countdown abgebrochen werden.
     * Ohne diesen Fix feuert der Timer weiter und sendet COUNTDOWN_TICK an den nicht mehr aktiven Tisch.
     */
    @Test
    void countdownWirdAbgebrochenWennLetzterSpielerTimeout() throws Exception {
        // Tisch per Reflection auf IM_SPIEL setzen (simuliert laufende Partie mit Countdown)
        tisch = tischRepository.findById(TischId.von(tisch.id())).orElseThrow();
        var statusFeld = tisch.getClass().getDeclaredField("status");
        statusFeld.setAccessible(true);
        statusFeld.set(tisch, TischStatus.IM_SPIEL.name());
        tischRepository.save(tisch);

        // Countdown für diesen Tisch starten
        partieCountdownService.starteCountdown(tisch.id());
        assertTrue(
            partieCountdownService.hatAktivenCountdown(tisch.id()),
            "Countdown muss nach starteCountdown aktiv sein"
        );

        // Letzter Spieler trennt sich und erreicht den Timeout
        String sessionId = menschlicherSpieler.sessionId();
        verbindungsabbruchService.verarbeiteDisconnect(sessionId, SpielerId.von(menschlicherSpieler.id()), menschlicherSpieler.name());
        verbindungsabbruchService.verarbeiteTimeouts(Instant.now().plusSeconds(9999));

        assertFalse(
            partieCountdownService.hatAktivenCountdown(tisch.id()),
            "Countdown muss nach Timeout des letzten Spielers abgebrochen sein — " +
            "sonst sendet er weiter COUNTDOWN_TICK an den nicht mehr aktiven Tisch."
        );
    }

    /**
     * Konfiguration: Der konfigurierte Reconnect-Timeout muss korrekt ausgelesen werden.
     * Ohne konfigurierbaren Timeout könnten Spieler in Tests oder langsamen Netzwerken
     * fälschlicherweise durch die KI übernommen werden.
     */
    @Test
    void reconnectTimeoutIstKonfiguriert() {
        int timeout = verbindungsabbruchService.reconnectTimeoutSekunden();
        assertTrue(
                timeout > 0,
                "Der Reconnect-Timeout muss größer als 0 sein — ein Timeout von 0 würde " +
                "sofortige KI-Übernahme ohne Wartezeit bedeuten."
        );
    }

    /**
     * Tisch-Status nach letztem Disconnect: Wenn der einzige menschliche Spieler den Timeout
     * überschreitet, muss der Tisch auf WARTEND gesetzt werden — nicht auf IM_SPIEL bleiben.
     * Ohne diesen Fix wäre der Tisch permanent blockiert und für neue Spieler nicht beitrittsfähig.
     */
    @Test
    void tischWirdNachTimeoutDesLetztenSpielerAufWartendGesetzt() throws Exception {
        // Tisch auf IM_SPIEL setzen (simuliert laufende Partie)
        tisch = tischRepository.findById(TischId.von(tisch.id())).orElseThrow();
        var statusFeld = tisch.getClass().getDeclaredField("status");
        statusFeld.setAccessible(true);
        statusFeld.set(tisch, TischStatus.IM_SPIEL.name());
        tischRepository.save(tisch);

        String sessionId = menschlicherSpieler.sessionId();
        verbindungsabbruchService.verarbeiteDisconnect(sessionId, SpielerId.von(menschlicherSpieler.id()), menschlicherSpieler.name());

        // Zeitgrenze weit in der Zukunft → alle Disconnect-Einträge sind "abgelaufen"
        verbindungsabbruchService.verarbeiteTimeouts(Instant.now().plusSeconds(9999));

        TischEntity aktuell = tischRepository.findById(TischId.von(tisch.id())).orElseThrow();
        assertEquals(
                TischStatus.WARTEND,
                aktuell.status(),
                "Nach Timeout des letzten menschlichen Spielers muss der Tisch auf WARTEND stehen, " +
                "damit neue Spieler beitreten können und er nicht dauerhaft blockiert bleibt."
        );
    }
}
