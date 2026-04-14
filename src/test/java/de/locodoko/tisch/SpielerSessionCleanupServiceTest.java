package de.locodoko.tisch;

import de.locodoko.spieler.SpielerEntity;
import de.locodoko.spieler.SpielerRepository;

import de.locodoko.partie.PartieEntity;
import de.locodoko.partie.PartieRepository;
import de.locodoko.spieler.SpielerEntity;
import de.locodoko.spieler.SpielerRepository;
import de.locodoko.tisch.TischEntity;
import de.locodoko.tisch.TischId;
import de.locodoko.tisch.TischRepository;
import de.locodoko.tisch.TischkonfigurationEmbeddable;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Tests für den {@link SpielerSessionCleanupService}.
 *
 * <p>Warum diese Tests wichtig sind:
 * <ul>
 *   <li>Ohne Session-Cleanup würden abgelaufene Sessions weiterhin in der Datenbank stehen,
 *       was dazu führt, dass Spieler sich nicht mehr neu registrieren können
 *       (eindeutige Session-ID-Einschränkung).</li>
 *   <li>Abgelaufene Spieler an wartenden Tischen würden den Tisch dauerhaft blockieren —
 *       andere Spieler könnten weder beitreten noch der Tisch gestartet werden.</li>
 *   <li>Das Disconnect-Tracking des VerbindungsabbruchService würde für abgelaufene Sessions
 *       weiter laufen und fälschlicherweise KI-Übernahmen auslösen, obwohl keine Reconnects
 *       mehr möglich sind.</li>
 * </ul>
 */
@SpringBootTest
@Transactional
class SpielerSessionCleanupServiceTest {

    @Autowired
    private SpielerSessionCleanupService cleanupService;

    @Autowired
    private TischRepository tischRepository;

    @Autowired
    private SpielerRepository spielerRepository;

    @Autowired
    private PartieRepository partieRepository;

    private SpielerEntity spieler;

    @BeforeEach
    void setUp() {
        spieler = SpielerEntity.menschlich("Testerin", "session-cleanup-123");
        spielerRepository.save(spieler);
    }

    /**
     * Unbekannte Session: Kein Spieler mit dieser Session-ID — kein Fehler, kein Effekt.
     * Schützt vor NullPointerException bei anonymen Sessions oder doppelten Cleanup-Aufrufen.
     */
    @Test
    void unbekannteSessionIdVerursachtKeinenFehler() {
        // Keine Exception erwartet
        cleanupService.bereinige("nicht-vorhandene-session-id");
    }

    /**
     * Null-Sicherheit: Kein Fehler bei null als Session-ID.
     */
    @Test
    void nullSessionIdVerursachtKeinenFehler() {
        cleanupService.bereinige(null);
    }

    /**
     * Kein Tisch: Spieler ohne Tischzugehörigkeit bekommt die Session-ID geleert.
     * Danach kann der Spieler sich mit einer neuen Session neu registrieren.
     */
    @Test
    void spielerOhneTischBekommtSessionIdGeleert() {
        String sessionId = spieler.sessionId();

        cleanupService.bereinige(sessionId);

        SpielerEntity nachBereinigung = spielerRepository.findById(spieler.id()).orElseThrow();
        assertNull(
                nachBereinigung.sessionId(),
                "Nach Session-Ablauf muss die Session-ID null sein, damit der Spieler " +
                "sich mit einer neuen Session neu registrieren kann."
        );
    }

    /**
     * Wartender Tisch: Spieler wird nach Session-Ablauf aus dem wartenden Tisch entfernt.
     * Der Tisch bleibt bestehen (wenn noch andere Spieler da sind).
     * Dies verhindert, dass abgelaufene Spieler den Tisch dauerhaft blockieren.
     */
    @Test
    void spielerWirdVonWartendemTischEntferntNachSessionAblauf() {
        SpielerEntity zweiterSpieler = SpielerEntity.menschlich("Zweite", "session-zweite-456");
        spielerRepository.save(zweiterSpieler);

        TischEntity tisch = TischEntity.neu("Testisch", spieler, TischkonfigurationEmbeddable.standard());
        tisch.fuegeSpielerHinzu(spieler);
        tisch.fuegeSpielerHinzu(zweiterSpieler);
        tischRepository.saveAndFlush(tisch);

        cleanupService.bereinige(spieler.sessionId());

        TischEntity nachBereinigung = tischRepository.findById(TischId.von(tisch.id())).orElseThrow();
        assertFalse(
                nachBereinigung.enthaeltSpieler(spieler),
                "Nach Session-Ablauf muss der Spieler aus dem wartenden Tisch entfernt worden sein, " +
                "damit der Tisch nicht dauerhaft durch abgelaufene Sessions blockiert wird."
        );
        assertTrue(
                nachBereinigung.enthaeltSpieler(zweiterSpieler),
                "Der zweite Spieler darf durch den Cleanup des ersten nicht beeinträchtigt werden."
        );
    }

    /**
     * Letzter Spieler verlässt wartenden Tisch: Der leere Tisch muss gelöscht werden.
     * Verhindert Geistertische ohne Spieler in der Datenbank.
     */
    @Test
    void leererTischWirdGeloeschtNachSessionAblaufDesLetztenSpielers() {
        TischEntity tisch = TischEntity.neu("Einzeltisch", spieler, TischkonfigurationEmbeddable.standard());
        tisch.fuegeSpielerHinzu(spieler);
        tischRepository.saveAndFlush(tisch);

        cleanupService.bereinige(spieler.sessionId());

        assertFalse(
                tischRepository.existsById(TischId.von(tisch.id())),
                "Ein leerer Tisch muss nach dem Session-Ablauf des letzten Spielers gelöscht werden — " +
                "sonst entstehen Geistertische ohne Spieler, die den Lobby-Zustand verfälschen."
        );
    }

    /**
     * Session-ID wird nach Entfernen vom wartenden Tisch geleert.
     * Stellt sicher, dass der Spieler sich nach Session-Ablauf neu registrieren kann.
     */
    @Test
    void sessionIdWirdNachEntfernenVomWartendemTischGeleert() {
        TischEntity tisch = TischEntity.neu("Tisch-für-Cleanup", spieler, TischkonfigurationEmbeddable.standard());
        tisch.fuegeSpielerHinzu(spieler);
        tischRepository.saveAndFlush(tisch);

        cleanupService.bereinige(spieler.sessionId());

        SpielerEntity nachBereinigung = spielerRepository.findById(spieler.id()).orElseThrow();
        assertNull(
                nachBereinigung.sessionId(),
                "Die Session-ID muss nach der Tisch-Bereinigung geleert werden, " +
                "damit der Spieler sich mit einer neuen Session registrieren kann."
        );
    }

    /**
     * Aktiver Tisch: Spieler an einem laufenden Tisch wird NICHT entfernt — die KI spielt für ihn.
     * Die Session-ID wird geleert, damit der Spieler sich neu registrieren kann.
     * Dies ist wichtig, weil ein laufendes Spiel nicht abgebrochen werden darf.
     */
    @Test
    void spielerBleibtAnAktivenTischNachSessionAblauf() {
        PartieEntity partie = PartieEntity.neu(5);
        partieRepository.save(partie);

        TischEntity tisch = TischEntity.neu("Aktiver Tisch", spieler, TischkonfigurationEmbeddable.standard());
        tisch.fuegeSpielerHinzu(spieler);
        tisch.setzePartie(partie); // setzt Status auf IM_SPIEL
        tischRepository.saveAndFlush(tisch);

        cleanupService.bereinige(spieler.sessionId());

        TischEntity nachBereinigung = tischRepository.findById(TischId.von(tisch.id())).orElseThrow();
        assertTrue(
                nachBereinigung.enthaeltSpieler(spieler),
                "Bei einem aktiven Tisch darf der Spieler nicht entfernt werden — " +
                "die KI spielt das laufende Spiel für ihn zu Ende."
        );

        SpielerEntity spielerNachBereinigung = spielerRepository.findById(spieler.id()).orElseThrow();
        assertNull(
                spielerNachBereinigung.sessionId(),
                "Die Session-ID muss geleert werden, damit der Spieler sich mit " +
                "einer neuen Session für das nächste Spiel registrieren kann."
        );
    }
}
