package de.locodoko.ki.orchestrierung;

import de.locodoko.karten.Farbe;
import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartendeck;
import de.locodoko.karten.Kartenwert;
import de.locodoko.karten.Spielregeln;
import de.locodoko.partie.Partie;
import de.locodoko.partie.Spiel;
import de.locodoko.partie.SpielerPosition;
import de.locodoko.partie.VorbehaltAnsage;
import de.locodoko.partie.ereignisse.FuchsGefangen;
import de.locodoko.spieler.SpielerEntity;
import de.locodoko.tisch.SpielAktionsService;
import de.locodoko.tisch.TischEntity;
import de.locodoko.tisch.TischId;
import de.locodoko.tisch.TischRepository;
import de.locodoko.tisch.TischkonfigurationEmbeddable;
import de.locodoko.tisch.persistenz.PartieRepository;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Integrationstests fuer die Publikation von Sonderpunkt-Domain-Events.
 *
 * <p>Verifiziert, dass {@link SpielAktionsService} beim Eintreten von Sonderpunkten
 * korrekte Spring-ApplicationEvents publiziert. Diese Events ermoeglichen zukuenftigen
 * Listenern (Statistik, Benachrichtigungen) typsichere Reaktion auf Spielereignisse.</p>
 */
@SpringBootTest
@RecordApplicationEvents
class SonderpunktDomainEreignisTest {

    @Autowired
    ApplicationEvents applicationEvents;

    @Autowired
    SpielAktionsService spielAktionsService;

    @Autowired
    TischRepository tischRepository;

    @Autowired
    PartieRepository partieRepository;

    @Autowired
    TransactionTemplate transactionTemplate;

    /**
     * Prueft, dass ein {@link FuchsGefangen}-Event publiziert wird, wenn ein menschlicher
     * Spieler den Fuchs (Karo-As) eines Gegenspielers einfaengt.
     *
     * <p>Aufbau: WEST (Re-Partei, hat Kreuz-Damen + Karo-As-1) spielt seinen Fuchs als
     * Aufspieler. Die KI-Orchestrierung spielt NORD und OST automatisch. SUED (Mensch, Kontra)
     * faengt den Fuchs mit der Dulle (Herz-Zehn) ein.</p>
     *
     * <p>Warum wichtig: Das FuchsGefangen-Domain-Event ist die Grundlage fuer zukuenftige
     * Erweiterungen (Echtzeit-Statistik, Benachrichtigungen). Ohne diesen Test koennte die
     * Event-Publikation still entfernt werden, ohne dass Folge-Features es bemerken.</p>
     */
    @Test
    void veroeffentlichtFuchsGefangenEreignisWennMenschFuchsFaengt() {
        Spielregeln spielregeln = Spielregeln.standardRegeln();

        UUID[] tischId = new UUID[1];
        transactionTemplate.executeWithoutResult(status -> {
            String suffix = UUID.randomUUID().toString().substring(0, 8);
            SpielerEntity sued = SpielerEntity.menschlich("Mensch-" + suffix, "session-" + suffix);
            TischEntity tisch = TischEntity.neu("FuchsTest-" + suffix, sued,
                TischkonfigurationEmbeddable.ausSpielregeln(spielregeln, 1));
            tisch.fuegeSpielerHinzu(sued);
            tisch.fuegeSpielerHinzu(SpielerEntity.ki("KI-West-" + suffix));
            tisch.fuegeSpielerHinzu(SpielerEntity.ki("KI-Nord-" + suffix));
            tisch.fuegeSpielerHinzu(SpielerEntity.ki("KI-Ost-" + suffix));

            // WEST (Re-Partei) erhaelt beide Kreuz-Damen und Karo-As-1 (Fuchs).
            // SUED (Kontra) erhaelt beide Dullen. KARO-AS-2 wird SUED zugewiesen
            // damit er nicht in spaetere Stiche gelangt, in denen Re ihn faengt
            // und ein zweites FuchsGefangen-Event ausloest.
            Spiel spiel = gesundesStichspiel(spielregeln, Map.of(
                SpielerPosition.WEST, List.of(
                    karte(Farbe.KREUZ, Kartenwert.DAME, 1),
                    karte(Farbe.KREUZ, Kartenwert.DAME, 2),
                    karte(Farbe.KARO, Kartenwert.AS, 1)
                ),
                SpielerPosition.SUED, List.of(
                    karte(Farbe.HERZ, Kartenwert.ZEHN, 1),
                    karte(Farbe.HERZ, Kartenwert.ZEHN, 2),
                    karte(Farbe.KARO, Kartenwert.AS, 2)
                )
            ));
            tisch.setzePartie(partieMitSpiel(spiel));
            TischEntity gespeichert = tischRepository.saveAndFlush(tisch);
            tischId[0] = gespeichert.id();
        });

        // WEST (KI, Re-Partei, Aufspieler) spielt Karo-As-1 (Fuchs) manuell.
        // Nach dem Commit spielt die KI-Orchestrierung NORD und OST automatisch
        // bis SUED (Mensch) wieder an der Reihe ist.
        transactionTemplate.executeWithoutResult(status -> {
            TischEntity tisch = tischRepository.findById(TischId.von(tischId[0])).orElseThrow();
            SpielerEntity west = tisch.spieler().get(1);
            spielAktionsService.spieleKarte(TischId.von(tischId[0]), west, "KARO-AS-1");
        });

        // SUED (Mensch, Kontra) faengt den Fuchs mit der Dulle — hoechster Trumpf.
        // Innerhalb dieser Transaktion wird FuchsGefangen via publishEvent() publiziert.
        transactionTemplate.executeWithoutResult(status -> {
            TischEntity tisch = tischRepository.findById(TischId.von(tischId[0])).orElseThrow();
            SpielerEntity sued = tisch.spieler().get(0);
            spielAktionsService.spieleKarte(TischId.von(tischId[0]), sued, "HERZ-ZEHN-1");
        });

        boolean fuchsGefangenEreignisPubliziert = applicationEvents.stream(FuchsGefangen.class)
            .anyMatch(e -> e.tischId().equals(tischId[0])
                && e.opfer() == SpielerPosition.WEST
                && e.taeter() == SpielerPosition.SUED);

        assertTrue(fuchsGefangenEreignisPubliziert,
            "SpielAktionsService muss ein FuchsGefangen(taeter=SUED, opfer=WEST)-Event publizieren, " +
            "damit zukuenftige Listener typsicher auf das Fuchs-Fangen-Ereignis reagieren koennen.");
    }

    private Spiel gesundesStichspiel(Spielregeln spielregeln, Map<SpielerPosition, List<Karte>> vorgaben) {
        List<Karte> restkarten = new ArrayList<>(Kartendeck.neu(spielregeln).karten());
        vorgaben.values().stream().flatMap(List::stream).forEach(restkarten::remove);

        EnumMap<SpielerPosition, List<Karte>> haende = new EnumMap<>(SpielerPosition.class);
        for (SpielerPosition pos : SpielerPosition.standardReihenfolge()) {
            haende.put(pos, new ArrayList<>(vorgaben.getOrDefault(pos, List.of())));
        }
        for (SpielerPosition pos : SpielerPosition.standardReihenfolge()) {
            while (haende.get(pos).size() < 12 && !restkarten.isEmpty()) {
                haende.get(pos).add(restkarten.remove(0));
            }
        }

        // Interleaved: deck[0]=SUED[0], deck[1]=WEST[0], deck[2]=NORD[0], deck[3]=OST[0], deck[4]=SUED[1], ...
        // Noetig weil anVierSpielerAusteilen() round-robin verteilt (deck[i] -> Spieler i%4).
        List<Karte> deckKarten = new ArrayList<>();
        for (int index = 0; index < 12; index++) {
            for (SpielerPosition pos : SpielerPosition.standardReihenfolge()) {
                deckKarten.add(haende.get(pos).get(index));
            }
        }

        Spiel spiel = Spiel.neu(SpielerPosition.SUED, spielregeln, Kartendeck.ausKarten(deckKarten));
        spiel.teileKartenAus();
        for (SpielerPosition pos : SpielerPosition.imUhrzeigersinnAb(SpielerPosition.WEST)) {
            spiel.meldeVorbehalt(pos, VorbehaltAnsage.GESUND);
        }
        spiel.loeseVorbehalteAuf();
        return spiel;
    }

    private Partie partieMitSpiel(Spiel spiel) {
        Partie partie = Partie.neuePersistenz(1);
        Spiel spielEntity = Spiel.neuePersistenz(1, spiel.geber(), spiel.spieltyp(), spiel.phase());
        spielEntity.uebernehmeDomainStand(spiel);
        partie.fuegeSpielHinzu(spielEntity);
        return partie;
    }

    private Karte karte(Farbe farbe, Kartenwert wert, int exemplar) {
        return new Karte(farbe, wert, exemplar);
    }
}
