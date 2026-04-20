package de.locodoko.partie;

import de.locodoko.karten.Farbe;
import de.locodoko.karten.Hand;
import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartenwert;
import de.locodoko.karten.NormaleTrumpfOrdnung;
import de.locodoko.karten.Spielregeln;
import de.locodoko.karten.TrumpfOrdnung;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class SonderpunktBewerterTest {

    private final Spielregeln spielregeln = Spielregeln.standardRegeln();
    private final TrumpfOrdnung trumpfOrdnung = new NormaleTrumpfOrdnung(spielregeln);
    private final Parteien parteien = Parteien.ausNormalspielHaenden(Map.of(
        SpielerPosition.SUED, new Hand(List.of(kreuzDame(1))),
        SpielerPosition.WEST, new Hand(List.of(kreuzDame(2))),
        SpielerPosition.NORD, new Hand(List.of(herzAs(1))),
        SpielerPosition.OST, new Hand(List.of(pikAs(1)))
    ));
    private final SonderpunktBewerter bewerter = new SonderpunktBewerter();

    @Test
    void erkenntFuchsKarlchenUndDoppelkopfParteiweise() {
        List<Stich> stiche = List.of(
            Stich.neu(SpielerPosition.SUED)
                .spieleKarte(SpielerPosition.SUED, dulle(1), new Hand(List.of(dulle(1))), trumpfOrdnung)
                .spieleKarte(SpielerPosition.WEST, dulle(2), new Hand(List.of(dulle(2))), trumpfOrdnung)
                .spieleKarte(SpielerPosition.NORD, karoAs(1), new Hand(List.of(karoAs(1))), trumpfOrdnung)
                .spieleKarte(SpielerPosition.OST, kreuzAs(1), new Hand(List.of(kreuzAs(1))), trumpfOrdnung),
            Stich.neu(SpielerPosition.WEST)
                .spieleKarte(SpielerPosition.WEST, kreuzBube(1), new Hand(List.of(kreuzBube(1))), trumpfOrdnung)
                .spieleKarte(SpielerPosition.NORD, herzAs(2), new Hand(List.of(herzAs(2))), trumpfOrdnung)
                .spieleKarte(SpielerPosition.OST, pikAs(2), new Hand(List.of(pikAs(2))), trumpfOrdnung)
                .spieleKarte(SpielerPosition.SUED, kreuzAs(2), new Hand(List.of(kreuzAs(2))), trumpfOrdnung)
        );

        Map<Partei, List<SonderpunktEreignis>> sonderpunkte = bewerter.bewerte(stiche, parteien, trumpfOrdnung, spielregeln, 10);

        List<Sonderpunkt> reArten = sonderpunkte.get(Partei.RE).stream().map(SonderpunktEreignis::art).toList();
        assertEquals(List.of(Sonderpunkt.DOPPELKOPF, Sonderpunkt.FUCHS_GEFANGEN, Sonderpunkt.KARLCHEN), reArten,
            "Fuchs, Karlchen und Doppelkopf muessen gesammelt an die gewinnende Partei gehen, weil sie spaeter gemeinsam in die Wertung einfliessen.");
        // Fuchs gefangen: WEST fängt NORD's Fuchs (WEST gewinnt den ersten Stich, NORD spielt Karo-As)
        SonderpunktEreignis fuchsEreignis = sonderpunkte.get(Partei.RE).stream()
            .filter(e -> e.art() == Sonderpunkt.FUCHS_GEFANGEN).findFirst().orElseThrow();
        assertEquals(SpielerPosition.WEST, fuchsEreignis.taeter(), "Taeter muss der Stichgewinner WEST sein");
        assertEquals(SpielerPosition.NORD, fuchsEreignis.opfer(), "Opfer muss der Fuchs-Besitzer NORD sein");
        assertEquals(List.of(), sonderpunkte.get(Partei.KONTRA));
    }

    @Test
    void respektiertDeaktivierteSonderpunkte() {
        Spielregeln regelnOhneSonderpunkte = spielregeln.mitSonderpunkten(false, false, false);
        List<Stich> stiche = List.of(
            Stich.neu(SpielerPosition.SUED)
                .spieleKarte(SpielerPosition.SUED, dulle(1), new Hand(List.of(dulle(1))), trumpfOrdnung)
                .spieleKarte(SpielerPosition.WEST, dulle(2), new Hand(List.of(dulle(2))), trumpfOrdnung)
                .spieleKarte(SpielerPosition.NORD, karoAs(1), new Hand(List.of(karoAs(1))), trumpfOrdnung)
                .spieleKarte(SpielerPosition.OST, kreuzAs(1), new Hand(List.of(kreuzAs(1))), trumpfOrdnung)
        );

        Map<Partei, List<SonderpunktEreignis>> sonderpunkte =
            bewerter.bewerte(stiche, parteien, trumpfOrdnung, regelnOhneSonderpunkte);

        assertEquals(List.of(), sonderpunkte.get(Partei.RE));
        assertEquals(List.of(), sonderpunkte.get(Partei.KONTRA),
            "Schalter in den Spielregeln muessen Sonderpunkte wirklich deaktivieren, damit Tischkonfigurationen fachlich belastbar bleiben.");
    }

    private Karte dulle(int exemplar) {
        return new Karte(Farbe.HERZ, Kartenwert.ZEHN, exemplar);
    }

    private Karte karoAs(int exemplar) {
        return new Karte(Farbe.KARO, Kartenwert.AS, exemplar);
    }

    private Karte kreuzAs(int exemplar) {
        return new Karte(Farbe.KREUZ, Kartenwert.AS, exemplar);
    }

    private Karte kreuzBube(int exemplar) {
        return new Karte(Farbe.KREUZ, Kartenwert.BUBE, exemplar);
    }

    private Karte kreuzDame(int exemplar) {
        return new Karte(Farbe.KREUZ, Kartenwert.DAME, exemplar);
    }

    private Karte herzAs(int exemplar) {
        return new Karte(Farbe.HERZ, Kartenwert.AS, exemplar);
    }

    private Karte pikAs(int exemplar) {
        return new Karte(Farbe.PIK, Kartenwert.AS, exemplar);
    }
}
