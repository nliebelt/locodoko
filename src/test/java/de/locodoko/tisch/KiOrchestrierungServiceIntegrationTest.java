package de.locodoko.tisch;

import de.locodoko.karten.Farbe;
import de.locodoko.karten.Hand;
import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartendeck;
import de.locodoko.karten.Kartenwert;
import de.locodoko.partie.SpielerPosition;
import de.locodoko.karten.Spielregeln;
import de.locodoko.partie.Spiel;
import de.locodoko.partie.VorbehaltAnsage;

import de.locodoko.partie.Partie;
import de.locodoko.tisch.persistenz.PartieRepository;
import de.locodoko.partie.PartieStatus;
import de.locodoko.partie.Spiel;
import de.locodoko.spieler.SpielerEntity;
import de.locodoko.tisch.TischEntity;
import de.locodoko.tisch.TischRepository;
import de.locodoko.tisch.TischkonfigurationEmbeddable;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
class KiOrchestrierungServiceIntegrationTest {

    @Autowired
    private KiOrchestrierungService kiOrchestrierungService;

    @Autowired
    private TischRepository tischRepository;

    @Autowired
    private PartieRepository partieRepository;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @Test
    void spieltKiFolgezuegeBisWiederEinMenschDranIst() {
        Spielregeln spielregeln = Spielregeln.standardRegeln();
        UUIDs ids = transactionTemplate.execute(status -> {
            TischEntity tisch = tischMitSpielern(false);
            Spiel spiel = gesundesStichspiel(spielregeln, verteilungMitVorgaben(Map.of(
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
                    karte(Farbe.KREUZ, Kartenwert.NEUN, 1),
                    karte(Farbe.HERZ, Kartenwert.AS, 1),
                    karte(Farbe.PIK, Kartenwert.KOENIG, 1)
                )
            )));
            tisch.setzePartie(partieMitSpiel(spiel, 1));
            TischEntity gespeichert = tischRepository.saveAndFlush(tisch);
            // Mit menschlichem Spieler: automatisiereTisch spielt NUR den ersten KI-Zug (WEST)
            // und plant die weiteren Zuege verzoegert. Die naechsten zwei KI-Zuege werden
            // in Integrationstests synchron ueber verzoegerteKiAktionAusfuehren simuliert.
            kiOrchestrierungService.automatisiereTisch(gespeichert);
            partieRepository.saveAndFlush(gespeichert.partie());
            return new UUIDs(gespeichert.id(), gespeichert.partie().id());
        });

        // Timing-Mechanismus: in Tests die verzoegerten KI-Zuege synchron ausloesen (NORD, OST)
        kiOrchestrierungService.verzoegerteKiAktionAusfuehren(TischId.von(ids.tischId()));
        kiOrchestrierungService.verzoegerteKiAktionAusfuehren(TischId.von(ids.tischId()));

        transactionTemplate.executeWithoutResult(status -> {
            TischEntity tisch = tischRepository.findById(TischId.von(ids.tischId())).orElseThrow();
            PartieStandAntwort stand = PartieStandAntwort.aus(tisch, tisch.spieler().getFirst().id());

            assertEquals(SpielerPosition.SUED, stand.laufendesSpiel().aktuellerSpieler(),
                "Nach drei automatischen KI-Karten muss der menschliche Spieler wieder am Zug sein, damit 1-Mensch-gegen-3-KI ohne manuelle Backend-Eingriffe spielbar bleibt.");
            assertEquals(3, stand.laufendesSpiel().aktuelleStichmitte().size(),
                "Die KI-Orchestrierung muss die komplette Folge bis zum menschlichen Zug ausspielen, damit das Frontend keinen halbfertigen Zwischenzustand erhaelt.");
            assertTrue(stand.laufendesSpiel().aktuelleStichmitte().stream()
                .noneMatch(karte -> karte.spielerPosition() == SpielerPosition.SUED));
        });
    }

    @Test
    void spieltEineKompletteVierKiPartieAutomatischZuEnde() {
        UUIDs ids = transactionTemplate.execute(status -> {
            Spielregeln spielregeln = Spielregeln.standardRegeln();
            TischEntity tisch = tischMitSpielern(true);
            Spiel spiel = gesundesStichspiel(spielregeln, verteilungMitVorgaben(Map.of(
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
                    karte(Farbe.KREUZ, Kartenwert.NEUN, 1),
                    karte(Farbe.HERZ, Kartenwert.AS, 1),
                    karte(Farbe.PIK, Kartenwert.KOENIG, 1)
                )
            )));
            tisch.setzePartie(partieMitSpiel(spiel, 1));
            TischEntity gespeichert = tischRepository.saveAndFlush(tisch);
            kiOrchestrierungService.automatisiereTisch(gespeichert);
            partieRepository.saveAndFlush(gespeichert.partie());
            return new UUIDs(gespeichert.id(), gespeichert.partie().id());
        });

        transactionTemplate.executeWithoutResult(status -> {
            TischEntity tisch = tischRepository.findById(TischId.von(ids.tischId())).orElseThrow();
            Partie partie = tisch.partie();

            assertEquals(PartieStatus.BEENDET, partie.status(),
                "Eine Partie mit vier KI-Spielern muss ohne menschliche Eingriffe vollstaendig enden, sonst bleibt das 4x-KI-Akzeptanzkriterium unerfuellt.");
            assertEquals(1, partie.spiele().size());
            assertNotNull(partie.spiele().getFirst().ergebnis(),
                "Das vollautomatische KI-Spiel braucht ein persistiertes Ergebnis, damit Ergebnis-Overlay und Gesamtstand darauf aufbauen koennen.");
            assertEquals(0, partie.gesamtpunktestandAusDb().values().stream().mapToInt(Integer::intValue).sum(),
                "Auch vollautomatische KI-Partien muessen die Nullsummen-Invariante des Gesamtstands wahren.");
            PartieStandAntwort stand = PartieStandAntwort.aus(tisch);
            assertNull(stand.laufendesSpiel(),
                "Nach dem Ende einer Ein-Spiel-Partie darf kein weiteres laufendes Spiel mehr sichtbar sein.");
        });
    }

    private TischEntity tischMitSpielern(boolean alleKi) {
        SpielerEntity erstelltVon = alleKi ? SpielerEntity.ki("KI Ada") : SpielerEntity.menschlich("Ada", "session-ada");
        TischEntity tisch = TischEntity.neu(
            alleKi ? "Vier KI" : "Ein Mensch",
            erstelltVon,
            TischkonfigurationEmbeddable.ausSpielregeln(Spielregeln.standardRegeln(), 1)
        );
        tisch.fuegeSpielerHinzu(erstelltVon);
        tisch.fuegeSpielerHinzu(SpielerEntity.ki("KI Bert"));
        tisch.fuegeSpielerHinzu(SpielerEntity.ki("KI Clara"));
        tisch.fuegeSpielerHinzu(SpielerEntity.ki("KI Dora"));
        return tisch;
    }

    private Partie partieMitSpiel(Spiel spiel, int anzahlSpiele) {
        Partie partie = Partie.neuePersistenz(anzahlSpiele);
        Spiel spielEntity = Spiel.neuePersistenz(1, spiel.geber(), spiel.spieltyp(), spiel.phase());
        spielEntity.uebernehmeDomainStand(spiel);
        partie.fuegeSpielHinzu(spielEntity);
        return partie;
    }

    private Spiel gesundesStichspiel(Spielregeln spielregeln, Map<SpielerPosition, List<Karte>> haende) {
        Kartendeck deck = Kartendeck.ausKarten(deckReihenfolgeFuerHaende(haende));
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, spielregeln, deck).teileKartenAus();
        for (SpielerPosition position : SpielerPosition.imUhrzeigersinnAb(SpielerPosition.WEST)) {
            spiel = spiel.meldeVorbehalt(position, VorbehaltAnsage.GESUND);
        }
        return spiel.loeseVorbehalteAuf();
    }

    private Map<SpielerPosition, List<Karte>> verteilungMitVorgaben(Map<SpielerPosition, List<Karte>> vorgaben) {
        List<Karte> restkarten = new ArrayList<>(Kartendeck.neu(Spielregeln.standardRegeln()).karten());
        EnumMap<SpielerPosition, List<Karte>> haende = new EnumMap<>(SpielerPosition.class);
        for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
            List<Karte> karten = new ArrayList<>(vorgaben.getOrDefault(position, List.of()));
            karten.forEach(restkarten::remove);
            haende.put(position, karten);
        }
        for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
            while (haende.get(position).size() < 12) {
                haende.get(position).add(restkarten.removeFirst());
            }
        }
        return Map.copyOf(haende);
    }

    private List<Karte> deckReihenfolgeFuerHaende(Map<SpielerPosition, List<Karte>> haende) {
        List<Karte> reihenfolge = new ArrayList<>();
        int kartenProSpieler = haende.values().stream().mapToInt(List::size).max().orElse(0);
        for (int index = 0; index < kartenProSpieler; index++) {
            for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
                reihenfolge.add(haende.get(position).get(index));
            }
        }
        return List.copyOf(reihenfolge);
    }

    private Karte karte(Farbe farbe, Kartenwert wert, int exemplarIndex) {
        return new Karte(farbe, wert, exemplarIndex);
    }

    /**
     * BUG-5: DKV-Turnier-Preset (alle Sonderregeln deaktiviert, mit Neunen) —
     * Spiel muss ueber die KI-Orchestrierung korrekt abgeschlossen werden.
     * Testet mit 2 Spielen um den Uebergang zum naechsten Spiel zu prüfen.
     */
    @Test
    void spieltEineKompletteVierKiPartieMitDkvRegelnZuEnde() {
        Spielregeln dkvRegeln = Spielregeln.dkvRegeln();
        UUIDs ids = transactionTemplate.execute(status -> {
            TischEntity tisch = tischMitSpielernUndRegeln(dkvRegeln, 2);
            Spiel spiel = gesundesStichspiel(dkvRegeln, verteilungMitVorgabenFuerRegeln(dkvRegeln, Map.of(
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
                    karte(Farbe.KREUZ, Kartenwert.NEUN, 1),
                    karte(Farbe.HERZ, Kartenwert.AS, 1),
                    karte(Farbe.PIK, Kartenwert.KOENIG, 1)
                )
            )));
            tisch.setzePartie(partieMitSpiel(spiel, 2));
            TischEntity gespeichert = tischRepository.saveAndFlush(tisch);
            kiOrchestrierungService.automatisiereTisch(gespeichert);
            partieRepository.saveAndFlush(gespeichert.partie());
            return new UUIDs(gespeichert.id(), gespeichert.partie().id());
        });

        transactionTemplate.executeWithoutResult(status -> {
            TischEntity tisch = tischRepository.findById(TischId.von(ids.tischId())).orElseThrow();
            Partie partie = tisch.partie();

            assertEquals(PartieStatus.BEENDET, partie.status(),
                "Eine DKV-Partie mit vier KI-Spielern muss nach 2 Spielen vollstaendig enden (BUG-5).");
            assertEquals(2, partie.spiele().size(),
                "Es muessen genau 2 Spiele in der DKV-Partie sein.");
            assertTrue(partie.spiele().stream().allMatch(s -> s.ergebnis() != null),
                "Alle Spiele muessen ein persistiertes Ergebnis haben.");
            assertEquals(0, partie.gesamtpunktestandAusDb().values().stream().mapToInt(Integer::intValue).sum(),
                "Der Gesamtpunktestand muss nullsummig bleiben.");
        });
    }

    private TischEntity tischMitSpielernUndRegeln(Spielregeln spielregeln, int anzahlSpiele) {
        SpielerEntity erstelltVon = SpielerEntity.ki("KI Ada");
        TischEntity tisch = TischEntity.neu(
            "DKV Test",
            erstelltVon,
            TischkonfigurationEmbeddable.ausSpielregeln(spielregeln, anzahlSpiele)
        );
        tisch.fuegeSpielerHinzu(erstelltVon);
        tisch.fuegeSpielerHinzu(SpielerEntity.ki("KI Bert"));
        tisch.fuegeSpielerHinzu(SpielerEntity.ki("KI Clara"));
        tisch.fuegeSpielerHinzu(SpielerEntity.ki("KI Dora"));
        return tisch;
    }

    private Map<SpielerPosition, List<Karte>> verteilungMitVorgabenFuerRegeln(
        Spielregeln spielregeln,
        Map<SpielerPosition, List<Karte>> vorgaben
    ) {
        List<Karte> restkarten = new ArrayList<>(Kartendeck.neu(spielregeln).karten());
        int kartenProSpieler = restkarten.size() / 4;
        EnumMap<SpielerPosition, List<Karte>> haende = new EnumMap<>(SpielerPosition.class);
        for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
            List<Karte> karten = new ArrayList<>(vorgaben.getOrDefault(position, List.of()));
            karten.forEach(restkarten::remove);
            haende.put(position, karten);
        }
        for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
            while (haende.get(position).size() < kartenProSpieler) {
                haende.get(position).add(restkarten.removeFirst());
            }
        }
        return Map.copyOf(haende);
    }

    private record UUIDs(java.util.UUID tischId, java.util.UUID partieId) {
    }
}
