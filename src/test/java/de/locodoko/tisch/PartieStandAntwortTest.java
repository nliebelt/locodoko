package de.locodoko.tisch;

import de.locodoko.karten.Augen;
import de.locodoko.karten.Farbe;
import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartenwert;
import de.locodoko.partie.AktuellerStichKarteEmbeddable;
import de.locodoko.partie.HandJsonEintrag;
import de.locodoko.partie.SpielerPosition;
import de.locodoko.karten.Spielregeln;
import de.locodoko.karten.Spieltyp;
import de.locodoko.partie.Partei;
import de.locodoko.partie.Spielergebnis;
import de.locodoko.partie.Spielpunkte;
import de.locodoko.partie.Spielphase;
import de.locodoko.partie.Sonderpunkt;
import de.locodoko.partie.SonderpunktEreignis;
import de.locodoko.partie.StichJsonEintrag;
import de.locodoko.partie.Partie;
import de.locodoko.partie.Spiel;
import de.locodoko.spieler.SpielerEntity;
import de.locodoko.tisch.TischEntity;
import de.locodoko.tisch.TischkonfigurationEmbeddable;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

class PartieStandAntwortTest {

    @Test
    void bildetLetztesSpielergebnisUndAbgeschlosseneSticheImSnapshotAb() {
        TischEntity tisch = TischEntity.neu(
            "Ergebnisrunde",
            SpielerEntity.menschlich("Anna", "session-anna"),
            TischkonfigurationEmbeddable.ausSpielregeln(Spielregeln.standardRegeln(), 8)
        );
        tisch.fuegeSpielerHinzu(SpielerEntity.menschlich("Anna", "session-anna"));
        tisch.fuegeSpielerHinzu(SpielerEntity.menschlich("Ben", "session-ben"));
        tisch.fuegeSpielerHinzu(SpielerEntity.menschlich("Clara", "session-clara"));
        tisch.fuegeSpielerHinzu(SpielerEntity.menschlich("Dirk", "session-dirk"));

        Partie partie = Partie.neuePersistenz(8);
        Spiel spiel = Spiel.neuePersistenz(1, SpielerPosition.SUED, Spieltyp.NORMALSPIEL, Spielphase.GESAMTSTAND_AKTUALISIEREN);

        StichJsonEintrag ersterStich = new StichJsonEintrag(1, SpielerPosition.SUED, SpielerPosition.WEST, 26,
            List.of(
                new AktuellerStichKarteEmbeddable(SpielerPosition.SUED, Farbe.KREUZ, Kartenwert.AS, 1, 0),
                new AktuellerStichKarteEmbeddable(SpielerPosition.WEST, Farbe.KARO, Kartenwert.ZEHN, 1, 1),
                new AktuellerStichKarteEmbeddable(SpielerPosition.NORD, Farbe.HERZ, Kartenwert.AS, 1, 2),
                new AktuellerStichKarteEmbeddable(SpielerPosition.OST, Farbe.PIK, Kartenwert.AS, 1, 3)
            ));

        StichJsonEintrag zweiterStich = new StichJsonEintrag(2, SpielerPosition.WEST, SpielerPosition.SUED, 18,
            List.of(
                new AktuellerStichKarteEmbeddable(SpielerPosition.WEST, Farbe.KREUZ, Kartenwert.ZEHN, 2, 0),
                new AktuellerStichKarteEmbeddable(SpielerPosition.NORD, Farbe.KREUZ, Kartenwert.KOENIG, 1, 1),
                new AktuellerStichKarteEmbeddable(SpielerPosition.OST, Farbe.KREUZ, Kartenwert.NEUN, 1, 2),
                new AktuellerStichKarteEmbeddable(SpielerPosition.SUED, Farbe.KARO, Kartenwert.BUBE, 1, 3)
            ));

        spiel.fuegeStichHinzu(ersterStich);
        spiel.fuegeStichHinzu(zweiterStich);
        spiel.uebernehmeErgebnis(new Spielergebnis(
            Map.of(Partei.RE, new Augen(151), Partei.KONTRA, new Augen(89)),
            Partei.RE,
            new Spielpunkte(3),
            1, 1, 1, 1,
            Map.of(
                SpielerPosition.SUED, new Spielpunkte(3),
                SpielerPosition.WEST, new Spielpunkte(3),
                SpielerPosition.NORD, new Spielpunkte(-3),
                SpielerPosition.OST, new Spielpunkte(-3)
            ),
            Map.of(
                Partei.RE, List.of(new SonderpunktEreignis(Sonderpunkt.DOPPELKOPF, SpielerPosition.SUED, null)),
                Partei.KONTRA, List.of(new SonderpunktEreignis(Sonderpunkt.FUCHS_GEFANGEN, SpielerPosition.NORD, SpielerPosition.SUED))
            )
        ));

        partie.fuegeSpielHinzu(spiel);
        partie.setzeGesamtpunktestand(SpielerPosition.SUED, 3);
        partie.setzeGesamtpunktestand(SpielerPosition.WEST, 3);
        partie.setzeGesamtpunktestand(SpielerPosition.NORD, -3);
        partie.setzeGesamtpunktestand(SpielerPosition.OST, -3);
        tisch.setzePartie(partie);

        PartieStandAntwort antwort = PartieStandAntwort.aus(tisch);

        assertNull(antwort.laufendesSpiel(),
            "Nach abgeschlossenem Spiel darf der Snapshot kein laufendes Spiel mehr melden.");
        assertNotNull(antwort.letztesSpielergebnis(),
            "Die letzte Auswertung muss im Snapshot enthalten sein, damit das Frontend Ergebnis-Overlays ohne lokale Nachberechnung darstellen kann.");
        assertEquals(Partei.RE, antwort.letztesSpielergebnis().siegerPartei());
        assertEquals(151, antwort.letztesSpielergebnis().augenProPartei().get(Partei.RE));
        assertEquals(1, antwort.letztesSpielergebnis().sonderpunkteProPartei().get(Partei.RE).size());
        assertEquals(Sonderpunkt.DOPPELKOPF, antwort.letztesSpielergebnis().sonderpunkteProPartei().get(Partei.RE).getFirst().art());
        assertEquals(SpielerPosition.SUED, antwort.letztesSpielergebnis().sonderpunkteProPartei().get(Partei.RE).getFirst().taeter());
        assertEquals(2, antwort.letzteAbgeschlosseneStiche().size(),
            "Die zuletzt abgeschlossenen Stiche muessen im Snapshot bleiben, damit die Letzte-Stiche-Ansicht auch nach der Wertung noch denselben serverseitigen Verlauf zeigen kann.");
        assertEquals(2, antwort.letzteAbgeschlosseneStiche().get(1).stichNummer());
        assertEquals(SpielerPosition.SUED, antwort.letzteAbgeschlosseneStiche().get(1).gewinnerPosition());
        assertEquals("KREUZ-ZEHN-2", antwort.letzteAbgeschlosseneStiche().get(1).gespielteKarten().getFirst().karte().id());
    }

    @Test
    void maskiertGegnerHandkartenImSnapshot() {
        // Eigene Handkarten duerfen nie an Gegner verraten werden — serverseitige Maskierung
        // ist die letzte Verteidigungslinie gegen Client-seitiges Cheating.
        SpielerEntity anna = SpielerEntity.menschlich("Anna", "session-anna");
        TischEntity tisch = TischEntity.neu(
            "Filtert-Karten-Test",
            anna,
            TischkonfigurationEmbeddable.ausSpielregeln(Spielregeln.standardRegeln(), 8)
        );
        tisch.fuegeSpielerHinzu(anna);
        tisch.fuegeSpielerHinzu(SpielerEntity.menschlich("Ben", "session-ben"));
        tisch.fuegeSpielerHinzu(SpielerEntity.menschlich("Clara", "session-clara"));
        tisch.fuegeSpielerHinzu(SpielerEntity.menschlich("Dirk", "session-dirk"));

        Partie partie = Partie.neuePersistenz(8);
        Spiel spiel = Spiel.neuePersistenz(1, SpielerPosition.SUED, Spieltyp.NORMALSPIEL, Spielphase.VORBEHALT_ANSAGE);

        List<Karte> annasKarten = List.of(
            new Karte(Farbe.KREUZ, Kartenwert.DAME, 1),
            new Karte(Farbe.HERZ, Kartenwert.ZEHN, 1)
        );
        spiel.fuegeHandHinzu(HandJsonEintrag.aus(SpielerPosition.SUED, annasKarten));
        spiel.fuegeHandHinzu(HandJsonEintrag.aus(SpielerPosition.NORD, List.of(
            new Karte(Farbe.KARO, Kartenwert.AS, 1),
            new Karte(Farbe.PIK, Kartenwert.KOENIG, 1)
        )));
        partie.fuegeSpielHinzu(spiel);
        tisch.setzePartie(partie);

        PartieStandAntwort antwort = PartieStandAntwort.aus(tisch, anna.id());

        assertNotNull(antwort.laufendesSpiel(), "Laufendes Spiel muss vorhanden sein");
        var spieler = antwort.laufendesSpiel().spieler();

        var spieSued = spieler.stream().filter(s -> s.position() == SpielerPosition.SUED).findFirst().orElseThrow();
        assertNotNull(spieSued.sichtbareHandkarten(),
            "Eigene Handkarten (SUED) muessen fuer den anfragenden Spieler sichtbar sein");
        assertEquals(2, spieSued.sichtbareHandkarten().size());
        assertEquals("KREUZ-DAME-1", spieSued.sichtbareHandkarten().getFirst().id());

        var spieNord = spieler.stream().filter(s -> s.position() == SpielerPosition.NORD).findFirst().orElseThrow();
        assertNull(spieNord.sichtbareHandkarten(),
            "Gegner-Handkarten duerfen im Snapshot nie als ID/Wert sichtbar sein — nur die Anzahl");
        assertEquals(2, spieNord.verbleibendeKarten(),
            "Die Kartenanzahl des Gegners muss korrekt geliefert werden");
    }

    private Karte karte(Farbe farbe, Kartenwert wert, int exemplarIndex) {
        return new Karte(farbe, wert, exemplarIndex);
    }
}
