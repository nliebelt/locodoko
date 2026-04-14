package de.locodoko.partie;

import de.locodoko.tisch.TischEntity;
import de.locodoko.tisch.TischRepository;
import de.locodoko.tisch.TischStatus;
import de.locodoko.spieler.SpielerRepository;
import de.locodoko.tisch.TischkonfigurationEmbeddable;
import de.locodoko.spieler.SpielerEntity;

import de.locodoko.karten.Augen;
import de.locodoko.karten.Farbe;
import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartenwert;
import de.locodoko.karten.Spielregeln;
import de.locodoko.karten.Spieltyp;
import de.locodoko.partie.Ansage;
import de.locodoko.partie.Partei;
import de.locodoko.partie.Spielergebnis;
import de.locodoko.partie.Spielphase;
import de.locodoko.partie.Spielpunkte;
import de.locodoko.partie.Sonderpunkt;
import de.locodoko.partie.SonderpunktEreignis;
import jakarta.validation.ConstraintViolationException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Integrationstests fuer die Spring Data JDBC Persistenzschicht.
 * Prueft, dass Aggregates korrekt gespeichert und wiedergeladen werden.
 * @Transactional sorgt fuer automatischen Rollback nach jedem Test (Testdaten-Isolation).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@Transactional
class PersistenzRepositoryTest {

    @Autowired
    private TischRepository tischRepository;

    @Autowired
    private SpielerRepository spielerRepository;

    @Autowired
    private PartieRepository partieRepository;

    @Autowired
    private SpielRepository spielRepository;

    @Autowired
    private HandRepository handRepository;

    @Autowired
    private StichRepository stichRepository;

    @Autowired
    private GespielteKarteRepository gespielteKarteRepository;

    @Test
    void persistiertTischMitKonfigurationSpielernPartieUndStichhistorie() {
        // Spieler muessen vor dem Tisch gespeichert werden (FK-Constraint: tisch.erstellt_von_spieler_id)
        SpielerEntity erstelltVon = spielerRepository.saveAndFlush(SpielerEntity.menschlich("Ada", "session-ada"));
        SpielerEntity gast = spielerRepository.saveAndFlush(SpielerEntity.menschlich("Bert", "session-bert"));
        SpielerEntity ki = spielerRepository.saveAndFlush(SpielerEntity.ki("KI Clara"));

        TischEntity tisch = TischEntity.neu(
            "Abendtisch",
            erstelltVon,
            TischkonfigurationEmbeddable.ausSpielregeln(Spielregeln.ohneNeunenRegeln(), 12)
        );
        tisch.fuegeSpielerHinzu(erstelltVon);
        tisch.fuegeSpielerHinzu(gast);
        tisch.fuegeSpielerHinzu(ki);

        PartieEntity partie = PartieEntity.neu(12);
        partie.setzeGesamtpunktestand(SpielerPosition.SUED, 3);
        partie.setzeGesamtpunktestand(SpielerPosition.WEST, -1);
        partie.setzeGesamtpunktestand(SpielerPosition.NORD, -1);
        partie.setzeGesamtpunktestand(SpielerPosition.OST, -1);

        SpielEntity spiel = SpielEntity.neu(1, SpielerPosition.SUED, Spieltyp.NORMALSPIEL, Spielphase.GESAMTSTAND_AKTUALISIEREN);
        spiel.fuegeHandHinzu(HandEntity.neu(SpielerPosition.SUED, List.of(
            new Karte(Farbe.KREUZ, Kartenwert.DAME, 1),
            new Karte(Farbe.HERZ, Kartenwert.ZEHN, 2)
        )));

        StichEntity stich = StichEntity.neu(1, SpielerPosition.WEST, SpielerPosition.SUED, 32);
        stich.fuegeGespielteKarteHinzu(GespielteKarteEntity.neu(SpielerPosition.WEST, new Karte(Farbe.KREUZ, Kartenwert.AS, 1), 0));
        stich.fuegeGespielteKarteHinzu(GespielteKarteEntity.neu(SpielerPosition.NORD, new Karte(Farbe.KREUZ, Kartenwert.ZEHN, 1), 1));
        stich.fuegeGespielteKarteHinzu(GespielteKarteEntity.neu(SpielerPosition.OST, new Karte(Farbe.KREUZ, Kartenwert.KOENIG, 2), 2));
        stich.fuegeGespielteKarteHinzu(GespielteKarteEntity.neu(SpielerPosition.SUED, new Karte(Farbe.KREUZ, Kartenwert.DAME, 1), 3));
        spiel.fuegeStichHinzu(stich);
        spiel.uebernehmeErgebnis(beispielErgebnis());

        partie.fuegeSpielHinzu(spiel);
        partie.markiereAlsBeendet();
        tisch.setzePartie(partie);

        TischEntity gespeichert = tischRepository.saveAndFlush(tisch);

        // Spring Data JDBC liest immer direkt aus der Datenbank — kein Cache-Clear noetig
        TischEntity geladen = tischRepository.findById(de.locodoko.tisch.TischId.von(gespeichert.id())).orElseThrow();
        assertEquals(TischStatus.IM_SPIEL, geladen.status(),
            "Die Tisch-Persistenz muss den laufenden Status tragen, damit Lobby und Startlogik denselben Wahrheitsstand sehen.");
        assertEquals(12, geladen.konfiguration().anzahlSpiele());
        assertTrue(geladen.konfiguration().ohneNeunen(),
            "Die Konfiguration muss ohne Neunen erhalten bleiben, damit dieselben Karten- und Ansagegrenzen spaeter wieder gelten.");
        assertEquals(3, geladen.spieler().size(),
            "Die Sitzbelegung muss stabil gespeichert werden, weil Session-, Lobby- und KI-Logik darauf aufbauen.");
        assertNotNull(geladen.erstelltAm());

        PartieEntity geladenePartie = partieRepository.findById(geladen.partie().id()).orElseThrow();
        assertEquals(PartieStatus.BEENDET, geladenePartie.status());
        assertEquals(3, geladenePartie.gesamtpunktestand().get(SpielerPosition.SUED));

        SpielEntity geladenesSpiel = spielRepository.findAllByPartie_IdOrderBySpielNummerAsc(geladenePartie.id()).getFirst();
        assertEquals(Partei.RE, geladenesSpiel.ergebnis().siegerPartei());
        assertEquals(240, geladenesSpiel.ergebnis().reAugen() + geladenesSpiel.ergebnis().kontraAugen(),
            "Der Ergebnis-Snapshot muss die 240-Augen-Invariante abbilden, damit spaetere Auswertungen reproduzierbar bleiben.");
        assertEquals(1, geladenesSpiel.haende().size());
        assertEquals(1, geladenesSpiel.stiche().size());
        assertEquals(2, geladenesSpiel.sonderpunkte().size());

        HandEntity geladeneHand = handRepository.findBySpiel_IdAndSpielerPosition(geladenesSpiel.id(), SpielerPosition.SUED).orElseThrow();
        assertEquals(2, geladeneHand.karten().size());
        assertEquals(Kartenwert.ZEHN, geladeneHand.karten().get(1).wert());

        StichEntity geladenerStich = stichRepository.findAllBySpiel_IdOrderByStichNummerAsc(geladenesSpiel.id()).getFirst();
        assertEquals(32, geladenerStich.augen());
        assertEquals(4, gespielteKarteRepository.findAllByStich_IdOrderByReihenfolgeAsc(geladenerStich.id()).size());
        assertEquals(Kartenwert.DAME,
            gespielteKarteRepository.findAllByStich_IdOrderByReihenfolgeAsc(geladenerStich.id()).getLast().wert());

        assertTrue(spielerRepository.findBySessionId("session-ada").isPresent(),
            "Die Session-basierte Spieleridentifikation braucht eine direkte Repository-Suche, damit dieselbe Person serverseitig wiedererkannt wird.");
        assertTrue(tischRepository.existsBySpieler_SessionId("session-ada"),
            "Die Ein-Tisch-pro-Spieler-Regel braucht einen effizienten Lookup ueber die Tischbelegung.");
    }

    @Test
    void loeschtPartienSpieleUndSticheWennEinTischEntferntWird() {
        SpielerEntity erstelltVon = spielerRepository.saveAndFlush(SpielerEntity.menschlich("Ada", "session-loeschen"));
        SpielerEntity ki = spielerRepository.saveAndFlush(SpielerEntity.ki("KI Dora"));

        TischEntity tisch = TischEntity.neu("Loeschtisch", erstelltVon, TischkonfigurationEmbeddable.standard());
        tisch.fuegeSpielerHinzu(erstelltVon);
        tisch.fuegeSpielerHinzu(ki);

        PartieEntity partie = PartieEntity.neu(24);
        SpielEntity spiel = SpielEntity.neu(1, SpielerPosition.WEST, Spieltyp.NORMALSPIEL, new Spielphase.Stichphase(Stich.neu(SpielerPosition.WEST), Set.of(), null));
        StichEntity stich = StichEntity.neu(1, SpielerPosition.WEST, SpielerPosition.WEST, 11);
        stich.fuegeGespielteKarteHinzu(GespielteKarteEntity.neu(SpielerPosition.WEST, new Karte(Farbe.HERZ, Kartenwert.AS, 1), 0));
        spiel.fuegeStichHinzu(stich);
        partie.fuegeSpielHinzu(spiel);
        tisch.setzePartie(partie);
        TischEntity gespeichert = tischRepository.saveAndFlush(tisch);

        tischRepository.deleteById(de.locodoko.tisch.TischId.von(gespeichert.id()));

        assertEquals(0, tischRepository.count(),
            "Wenn ein Tisch geloescht wird, darf kein verwaistes Lobby-Aggregat in der Datenbank bleiben.");
        assertEquals(0, partieRepository.count(),
            "Partien muessen mit dem Tisch verschwinden, damit kein historischer Zustand ohne Einstiegspunkt uebrig bleibt.");
        assertEquals(0, spielRepository.count());
        assertEquals(0, stichRepository.count());
        assertEquals(0, gespielteKarteRepository.count());
        assertEquals(2, spielerRepository.count(),
            "Spieler bleiben erhalten, weil die Session-Identitaet den Tisch ueberlebt und spaeter neue Tische betreten koennen muss.");
    }

    @Test
    void lehntUngueltigeTischkonfigurationenAb() {
        SpielerEntity erstelltVon = spielerRepository.saveAndFlush(SpielerEntity.menschlich("Ada", "session-validierung"));

        TischEntity ungueltigerTisch = TischEntity.neu(
            "Ungueltig",
            erstelltVon,
            TischkonfigurationEmbeddable.ausSpielregeln(Spielregeln.standardRegeln(), 0)
        );
        ungueltigerTisch.fuegeSpielerHinzu(erstelltVon);

        assertThrows(ConstraintViolationException.class, () -> tischRepository.saveAndFlush(ungueltigerTisch),
            "Die Persistenz muss ungueltige Konfigurationen sofort abweisen, damit Lobby und REST keine fachlich kaputten Tische anlegen koennen.");
    }

    @Test
    void lehntDoppelteSessionIdsAb() {
        spielerRepository.saveAndFlush(SpielerEntity.menschlich("Bert", "session-doppelt"));
        spielerRepository.saveAndFlush(SpielerEntity.ki("KI Berta"));

        // Spring Data JDBC wirft DbActionExecutionException, die DataIntegrityViolationException kapselt.
        // Wir pruefen, dass irgendeine RuntimeException mit der richtigen Ursache geworfen wird.
        RuntimeException ex = assertThrows(RuntimeException.class,
            () -> spielerRepository.saveAndFlush(SpielerEntity.menschlich("Clara", "session-doppelt")),
            "Session-IDs muessen eindeutig bleiben, weil sie die einzige serverseitige Identifikation menschlicher Spieler bilden.");
        Throwable ursache = ex;
        boolean hatIntegritaetsverletzung = false;
        while (ursache != null) {
            if (ursache instanceof DataIntegrityViolationException) {
                hatIntegritaetsverletzung = true;
                break;
            }
            ursache = ursache.getCause();
        }
        assertTrue(hatIntegritaetsverletzung, "Die Exception muss eine DataIntegrityViolationException kapseln.");
    }

    @Test
    void liefertLeeresErgebnisFuerUnbekannteSessionIds() {
        assertTrue(spielerRepository.findBySessionId("unbekannt").isEmpty(),
            "Unbekannte Sessions duerfen keinen Phantom-Spieler liefern, damit neue Besuche sauber von bestehenden Spielern getrennt bleiben.");
    }

    @Test
    void persistiertAnsagehistorieAktuelleStichmitteUndHochzeitstatusImLaufendenSpiel() {
        // Spieler muessen vor dem Tisch gespeichert werden (FK-Constraint)
        SpielerEntity erstelltVon = spielerRepository.saveAndFlush(SpielerEntity.menschlich("Ada", "session-laufend"));
        SpielerEntity gast = spielerRepository.saveAndFlush(SpielerEntity.menschlich("Bert", "session-laufend-2"));

        TischEntity tisch = TischEntity.neu("Laufender Tisch", erstelltVon, TischkonfigurationEmbeddable.standard());
        tisch.fuegeSpielerHinzu(erstelltVon);
        tisch.fuegeSpielerHinzu(gast);

        PartieEntity partie = PartieEntity.neu(1);
        SpielEntity spiel = SpielEntity.neu(1, SpielerPosition.SUED, Spieltyp.HOCHZEIT, new Spielphase.Stichphase(Stich.neu(SpielerPosition.SUED), Set.of(), null));
        spiel.fuegeHandHinzu(HandEntity.neu(SpielerPosition.WEST, List.of(new Karte(Farbe.KREUZ, Kartenwert.DAME, 1))));
        spiel.ersetzeAnsagen(List.of(AnsageEreignisEmbeddable.neu(SpielerPosition.WEST, Ansage.RE)));
        spiel.setzeAktuellenStich(
            SpielerPosition.WEST,
            List.of(AktuellerStichKarteEmbeddable.aus(
                new GespielteKarte(SpielerPosition.WEST, new Karte(Farbe.KREUZ, Kartenwert.AS, 1), 0)
            ))
        );
        spiel.setzeHochzeitStatus(SpielerPosition.WEST, 2, SpielerPosition.NORD, false);
        partie.fuegeSpielHinzu(spiel);
        tisch.setzePartie(partie);

        TischEntity gespeichert = tischRepository.saveAndFlush(tisch);

        // Spring Data JDBC liest immer direkt aus der DB — kein Cache-Clear noetig
        SpielEntity geladenesSpiel = spielRepository.findAllByPartie_IdOrderBySpielNummerAsc(gespeichert.partie().id()).getFirst();
        assertEquals(1, geladenesSpiel.ansagen().size(),
            "Die Ansagehistorie muss im laufenden Spiel persistiert bleiben, damit Snapshots und Reconnects denselben oeffentlichen Ansagezustand wiederherstellen koennen.");
        assertEquals(Ansage.RE, geladenesSpiel.ansagen().getFirst().ansage());
        assertEquals(SpielerPosition.WEST, geladenesSpiel.aktuellerStichAufspielerPosition());
        assertEquals(1, geladenesSpiel.aktuellerStichKarten().size(),
            "Die laufende Stichmitte muss gespeichert werden, damit nach einem Broadcast oder Reload keine bereits ausgespielten Karten verschwinden.");
        assertEquals(SpielerPosition.WEST, geladenesSpiel.hochzeitSpielerPosition());
        assertEquals(2, geladenesSpiel.hochzeitGeklaerteStiche());
        assertEquals(SpielerPosition.NORD, geladenesSpiel.hochzeitPartnerSpielerPosition());
    }

    private Spielergebnis beispielErgebnis() {
        Map<Partei, Augen> augen = new EnumMap<>(Partei.class);
        augen.put(Partei.RE, new Augen(151));
        augen.put(Partei.KONTRA, new Augen(89));

        Map<SpielerPosition, Spielpunkte> spielpunkte = new EnumMap<>(SpielerPosition.class);
        spielpunkte.put(SpielerPosition.SUED, new Spielpunkte(3));
        spielpunkte.put(SpielerPosition.WEST, new Spielpunkte(-1));
        spielpunkte.put(SpielerPosition.NORD, new Spielpunkte(-1));
        spielpunkte.put(SpielerPosition.OST, new Spielpunkte(-1));

        Map<Partei, List<SonderpunktEreignis>> sonderpunkte = new EnumMap<>(Partei.class);
        sonderpunkte.put(Partei.RE, List.of(
            new SonderpunktEreignis(Sonderpunkt.FUCHS_GEFANGEN, SpielerPosition.SUED, SpielerPosition.NORD),
            new SonderpunktEreignis(Sonderpunkt.DOPPELKOPF, SpielerPosition.SUED, null)
        ));
        sonderpunkte.put(Partei.KONTRA, List.of());

        return new Spielergebnis(augen, Partei.RE, new Spielpunkte(3), 1, 0, 0, 1, spielpunkte, sonderpunkte);
    }
}
