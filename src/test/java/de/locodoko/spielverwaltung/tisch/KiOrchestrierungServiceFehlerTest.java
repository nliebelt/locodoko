package de.locodoko.spielverwaltung.tisch;

import de.locodoko.spiel.karten.Karte;
import de.locodoko.spiel.karten.Kartendeck;
import de.locodoko.spiel.karten.SpielerPosition;
import de.locodoko.spiel.karten.Spielregeln;
import de.locodoko.spiel.ki.KiArmutAntwort;
import de.locodoko.spiel.ki.KiSpielzustand;
import de.locodoko.spiel.ki.KiStrategie;
import de.locodoko.spiel.partie.Ansage;
import de.locodoko.spiel.partie.Spiel;
import de.locodoko.spiel.partie.Spielphase;
import de.locodoko.spiel.partie.VorbehaltAnsage;
import de.locodoko.spielverwaltung.persistenz.PartieEntity;
import de.locodoko.spielverwaltung.persistenz.PartieRepository;
import de.locodoko.spielverwaltung.persistenz.SpielEntity;
import de.locodoko.spielverwaltung.persistenz.SpielerEntity;
import de.locodoko.spielverwaltung.persistenz.TischEntity;
import de.locodoko.spielverwaltung.persistenz.TischRepository;
import de.locodoko.spielverwaltung.persistenz.TischkonfigurationEmbeddable;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Testet die Fehlerbehandlung im KiOrchestrierungService.
 *
 * Wichtig: Wenn die KI-Strategie eine Exception wirft, darf die Partie nicht in einem
 * inkonsistenten Zustand haengen bleiben. Die Exception wird abgefangen, die Partie
 * bleibt im letzten konsistenten Datenbankstand.
 *
 * Statt Mockito wird eine innere {@link WirftImmerKiStrategie} als Test-Bean registriert,
 * da Mockito im Projekt bewusst nicht als Abhaengigkeit eingebunden ist.
 */
@SpringBootTest
class KiOrchestrierungServiceFehlerTest {

    /**
     * Test-Konfiguration: Ersetzt die echte KiStrategie durch eine, die bei jedem
     * Aufruf sofort wirft. Damit koennen wir testen, dass der Orchestrierungsdienst
     * robust auf Strategie-Fehler reagiert.
     */
    @TestConfiguration
    static class WirftImmerKiStrategieKonfiguration {

        @Bean
        @Primary
        KiStrategie wirftImmerKiStrategie() {
            return new WirftImmerKiStrategie();
        }
    }

    /**
     * KiStrategie, die bei jedem Aufruf eine IllegalStateException wirft –
     * simuliert einen unerwarteten Programmfehler in der KI-Entscheidungslogik.
     */
    static class WirftImmerKiStrategie implements KiStrategie {
        @Override
        public VorbehaltAnsage waehleVorbehalt(KiSpielzustand zustand) {
            throw new IllegalStateException("Simulierter KI-Fehler: waehleVorbehalt");
        }

        @Override
        public List<Karte> waehleArmutAngebot(KiSpielzustand zustand) {
            throw new IllegalStateException("Simulierter KI-Fehler: waehleArmutAngebot");
        }

        @Override
        public KiArmutAntwort waehleArmutAntwort(KiSpielzustand zustand) {
            throw new IllegalStateException("Simulierter KI-Fehler: waehleArmutAntwort");
        }

        @Override
        public Optional<Ansage> waehleAnsage(KiSpielzustand zustand) {
            throw new IllegalStateException("Simulierter KI-Fehler: waehleAnsage");
        }

        @Override
        public Karte waehleKarte(KiSpielzustand zustand) {
            throw new IllegalStateException("Simulierter KI-Fehler: waehleKarte");
        }
    }

    @Autowired
    private KiOrchestrierungService kiOrchestrierungService;

    @Autowired
    private TischRepository tischRepository;

    @Autowired
    private PartieRepository partieRepository;

    @Autowired
    private TransactionTemplate transactionTemplate;

    /**
     * Wenn die KI-Strategie in der STICHPHASE eine Exception wirft, darf
     * automatisiereTisch() nicht propagieren. Die Spielphase muss unveraendert
     * STICHPHASE bleiben, kein Stich darf begonnen worden sein.
     *
     * Wichtig: Ohne Fehlerbehandlung wuerde jeder folgende WebSocket-Request
     * dieselbe Exception erzeugen und die Partie dauerhaft blockieren.
     */
    @Test
    void bleibtKonsistentBeiKiStrategieExceptionInStichphase() {
        java.util.UUID tischId = transactionTemplate.execute(status -> {
            Spielregeln spielregeln = Spielregeln.standardRegeln();
            TischEntity tisch = allKiTisch();
            // Spiel direkt in STICHPHASE versetzen (alle Vorbehalte gesund, keine KI-Beteiligung)
            Spiel spiel = gesundesStichspiel(spielregeln);
            tisch.setzePartie(partieMitSpiel(spiel, 1));
            TischEntity gespeichert = tischRepository.saveAndFlush(tisch);

            // automatisiereTisch() darf trotz KI-Exception nicht werfen
            assertDoesNotThrow(
                () -> kiOrchestrierungService.automatisiereTisch(gespeichert),
                "Eine KI-Strategie-Exception in der Stichphase darf nicht propagieren, " +
                "sonst bricht der WebSocket-Handler ab und die Partie bleibt dauerhaft blockiert."
            );

            partieRepository.saveAndFlush(gespeichert.partie());
            return gespeichert.id();
        });

        // Datenbankstand: Phase muss unveraendert STICHPHASE sein, kein Stich begonnen
        transactionTemplate.executeWithoutResult(status -> {
            TischEntity tisch = tischRepository.findById(tischId).orElseThrow();
            SpielEntity laufendesSpiel = tisch.partie().spiele().getLast();

            assertEquals(Spielphase.STICHPHASE, laufendesSpiel.phase(),
                "Die Spielphase muss nach einer KI-Exception unveraendert STICHPHASE sein, " +
                "weil uebernehmeDomainSpiel() nie aufgerufen wurde und der letzte Datenbankstand gilt.");

            assertEquals(0, laufendesSpiel.stiche().size(),
                "Es darf kein Stich persistiert worden sein, weil die KI-Exception " +
                "aufgetreten ist bevor uebernehmeDomainSpiel() den neuen Stand schreiben konnte.");
        });
    }

    /**
     * Wenn die KI-Strategie in der VORBEHALT_ANSAGE-Phase eine Exception wirft,
     * darf automatisiereTisch() ebenfalls nicht propagieren. Die Spielphase muss
     * unveraendert VORBEHALT_ANSAGE bleiben.
     */
    @Test
    void bleibtKonsistentBeiKiStrategieExceptionInVorbehaltphase() {
        java.util.UUID tischId = transactionTemplate.execute(status -> {
            Spielregeln spielregeln = Spielregeln.standardRegeln();
            TischEntity tisch = allKiTisch();
            // Spiel in VORBEHALT_ANSAGE-Phase (noch kein Vorbehalt gemeldet)
            Spiel spiel = Spiel.neu(SpielerPosition.SUED, spielregeln, Kartendeck.neu(spielregeln).gemischt())
                .teileKartenAus();
            tisch.setzePartie(partieMitSpiel(spiel, 1));
            TischEntity gespeichert = tischRepository.saveAndFlush(tisch);

            assertDoesNotThrow(
                () -> kiOrchestrierungService.automatisiereTisch(gespeichert),
                "Eine KI-Strategie-Exception in der Vorbehaltphase darf nicht propagieren."
            );

            partieRepository.saveAndFlush(gespeichert.partie());
            return gespeichert.id();
        });

        transactionTemplate.executeWithoutResult(status -> {
            TischEntity tisch = tischRepository.findById(tischId).orElseThrow();
            SpielEntity laufendesSpiel = tisch.partie().spiele().getLast();

            assertEquals(Spielphase.VORBEHALT_ANSAGE, laufendesSpiel.phase(),
                "Die Spielphase muss nach einer KI-Exception in der Vorbehaltphase unveraendert " +
                "VORBEHALT_ANSAGE bleiben, damit kein halbgemeldeter Vorbehalt persistiert wird.");
        });
    }

    // --- Hilfsmethoden ---

    /** Tisch mit vier KI-Spielern (kein menschlicher Spieler). */
    private TischEntity allKiTisch() {
        SpielerEntity ki1 = SpielerEntity.ki("KI Ada");
        TischEntity tisch = TischEntity.neu("Fehlertest", ki1,
            TischkonfigurationEmbeddable.ausSpielregeln(Spielregeln.standardRegeln(), 1));
        tisch.fuegeSpielerHinzu(ki1);
        tisch.fuegeSpielerHinzu(SpielerEntity.ki("KI Bert"));
        tisch.fuegeSpielerHinzu(SpielerEntity.ki("KI Clara"));
        tisch.fuegeSpielerHinzu(SpielerEntity.ki("KI Dora"));
        return tisch;
    }

    /**
     * Erstellt ein Spiel in der STICHPHASE: Alle Vorbehalte als gesund gemeldet und
     * Vorbehalte aufgeloest, ohne die KI-Strategie zu benutzen (direkte Domain-Aufrufe).
     *
     * Nutzt einen deterministischen Zufallsgenerator mit fester Startzahl, um sicherzustellen,
     * dass beide Kreuz-Damen auf unterschiedliche Spieler verteilt werden (Normalspiel).
     * Bei ungueltig zufaelliger Verteilung wird mit naechster Startzahl neu gemischt.
     */
    private Spiel gesundesStichspiel(Spielregeln spielregeln) {
        for (long startzahl = 0; startzahl < 100; startzahl++) {
            try {
                Spiel spiel = Spiel.neu(SpielerPosition.SUED, spielregeln,
                        Kartendeck.neu(spielregeln).gemischt(new java.util.Random(startzahl)))
                    .teileKartenAus();
                for (SpielerPosition position : SpielerPosition.imUhrzeigersinnAb(SpielerPosition.WEST)) {
                    spiel = spiel.meldeVorbehalt(position, VorbehaltAnsage.GESUND);
                }
                return spiel.loeseVorbehalteAuf();
            } catch (IllegalStateException e) {
                // Ungueltige Kartenverteilung (z.B. beide Kreuz-Damen in einer Hand) — neue Startzahl
            }
        }
        throw new IllegalStateException("Kein gueltiges Normalspiel nach 100 Versuchen gefunden");
    }

    /** Verpackt ein Domain-Spiel in eine PartieEntity. */
    private PartieEntity partieMitSpiel(Spiel spiel, int anzahlSpiele) {
        PartieEntity partie = PartieEntity.neu(anzahlSpiele);
        SpielEntity spielEntity = SpielEntity.neu(1, spiel.geber(), spiel.spieltyp(), spiel.phase());
        SpielPersistenzAdapter.uebernehmeDomainSpiel(spielEntity, spiel);
        partie.fuegeSpielHinzu(spielEntity);
        return partie;
    }
}
