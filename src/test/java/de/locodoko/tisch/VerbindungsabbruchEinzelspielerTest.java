package de.locodoko.tisch;

import de.locodoko.spieler.SpielerEntity;
import de.locodoko.spieler.SpielerId;
import de.locodoko.spieler.SpielerRepository;

import de.locodoko.tisch.TischEntity;
import de.locodoko.tisch.TischRepository;
import de.locodoko.tisch.TischkonfigurationEmbeddable;
import de.locodoko.tisch.persistenz.PartieEntity;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.assertFalse;

/**
 * Prüft das Timeout-Verhalten des {@link VerbindungsabbruchService} bei Einzelspieler-Tischen.
 *
 * <p>Warum diese Tests wichtig sind: Bei Einzelspieler-Tischen (1 Mensch + 3 KI) darf kein
 * automatischer KI-Übernahme-Timeout ausgelöst werden. Ohne diese Absicherung würde der
 * menschliche Spieler nach 120 Sekunden Inaktivität seinen Platz an die KI verlieren —
 * obwohl niemand anderes auf seinen Zug wartet.
 *
 * <p>Der Reconnect-Timeout ist auf -1 Sekunden gesetzt, damit {@code pruefeReconnectTimeouts()}
 * den Timeout sofort als abgelaufen behandelt — ohne echtes Warten im Test.
 */
@SpringBootTest(properties = "locodoko.verbindung.reconnect-timeout-sekunden=-1")
@Transactional
class VerbindungsabbruchEinzelspielerTest {

    @Autowired
    private VerbindungsabbruchService verbindungsabbruchService;

    @Autowired
    private TischRepository tischRepository;

    @Autowired
    private SpielerRepository spielerRepository;

    private SpielerEntity mensch;

    @BeforeEach
    void setUp() {
        mensch = SpielerEntity.menschlich("Solo-Spielerin", "session-solo-123");
        spielerRepository.save(mensch);

        SpielerEntity ki1 = SpielerEntity.ki("KI-Nord");
        SpielerEntity ki2 = SpielerEntity.ki("KI-Ost");
        SpielerEntity ki3 = SpielerEntity.ki("KI-West");

        TischEntity tisch = TischEntity.neu("Solo-Tisch", mensch, TischkonfigurationEmbeddable.standard());
        tisch.fuegeSpielerHinzu(mensch);
        tisch.fuegeSpielerHinzu(ki1);
        tisch.fuegeSpielerHinzu(ki2);
        tisch.fuegeSpielerHinzu(ki3);
        // setzePartie setzt Status auf IM_SPIEL; tischRepository.save speichert die Partie kaskadiert
        tisch.setzePartie(PartieEntity.neu(6));
        tischRepository.save(tisch);
    }

    /**
     * Kernanforderung (Spec §4.18): Bei einem Einzelspieler-Tisch darf nach Timeout-Ablauf
     * keine KI-Übernahme stattfinden. Der menschliche Spieler behält seinen Platz.
     *
     * <p>Testet direkt die Schutzprüfung in {@code pruefeReconnectTimeouts()}, die bei
     * {@code humanPlayerCount == 1} die KI-Übernahme abbricht.
     */
    @Test
    void einzelspielerTischLoestKeinenKiTimeoutAus() {
        verbindungsabbruchService.verarbeiteDisconnect(
                mensch.sessionId(),
                SpielerId.von(mensch.id()),
                mensch.name()
        );

        // Timeout gilt mit reconnect-timeout-sekunden=-1 sofort als abgelaufen
        verbindungsabbruchService.pruefeReconnectTimeouts();

        SpielerEntity geladen = spielerRepository.findById(mensch.id()).orElseThrow();
        assertFalse(
                geladen.istKiUebernommen(),
                "Auf einem Einzelspieler-Tisch (1 Mensch + 3 KI) darf die KI nicht automatisch " +
                "übernehmen — der Spieler hat keine Mitspieler, die er blockieren könnte."
        );
    }
}
