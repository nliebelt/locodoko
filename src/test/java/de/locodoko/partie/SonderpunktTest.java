package de.locodoko.partie;

import de.locodoko.karten.Farbe;
import de.locodoko.karten.Hand;
import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartenwert;
import de.locodoko.karten.NormaleTrumpfOrdnung;
import de.locodoko.karten.Spielregeln;
import de.locodoko.karten.TrumpfOrdnung;
import org.junit.jupiter.api.Test;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Isolierte Unit-Tests fuer {@link SonderpunktBewerter}.
 *
 * <p>Testet jeden Sonderpunkt (Fuchs, Karlchen, Doppelkopf) einzeln — im Gegensatz
 * zu {@link PunkteRechnerTest}, der alle drei kombiniert prueft.</p>
 */
class SonderpunktTest {

    private final Spielregeln spielregeln = Spielregeln.standardRegeln();
    private final TrumpfOrdnung trumpfOrdnung = new NormaleTrumpfOrdnung(spielregeln);
    private final SonderpunktBewerter bewerter = new SonderpunktBewerter();
    // SUED + WEST = RE (haben Kreuz-Damen), NORD + OST = KONTRA
    private final Parteien parteien = Parteien.ausNormalspielHaenden(Map.of(
        SpielerPosition.SUED, new Hand(List.of(kreuzDame(1))),
        SpielerPosition.WEST, new Hand(List.of(kreuzDame(2))),
        SpielerPosition.NORD, new Hand(List.of(herzAs(1))),
        SpielerPosition.OST, new Hand(List.of(pikAs(1)))
    ));

    @Test
    void fuchsGefangen_WennKontraResFuchsFaengt() {
        // NORD (KONTRA) eroeffnet mit Dulle und gewinnt, SUED (RE) spielt Fuchs (Karo-As)
        // Prueft: Fangen-Erkennung bei strikter Parteizuordnung — ohne diesen Test bliebe
        // die Fuchs-Gefangen-Logik im SonderpunktBewerter ohne eigenstaendige Absicherung.
        Stich stich = Stich.neu(SpielerPosition.NORD)
            .spieleKarte(SpielerPosition.NORD, dulle(1), new Hand(List.of(dulle(1))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.OST, pikNeun(1), new Hand(List.of(pikNeun(1))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.SUED, karoAs(1), new Hand(List.of(karoAs(1))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.WEST, herzNeun(1), new Hand(List.of(herzNeun(1))), trumpfOrdnung);

        EnumMap<Partei, List<SonderpunktEreignis>> ergebnis =
            bewerter.bewerte(List.of(stich), parteien, trumpfOrdnung, spielregeln);

        assertEquals(1, ergebnis.get(Partei.KONTRA).size());
        assertEquals(Sonderpunkt.FUCHS_GEFANGEN, ergebnis.get(Partei.KONTRA).get(0).art());
        assertTrue(ergebnis.get(Partei.RE).isEmpty(),
            "RE bekommt keinen Sonderpunkt wenn ihr Fuchs von KONTRA gefangen wird.");
    }

    @Test
    void keinFuchs_WennEigeneParteiFuchsGewinnt() {
        // WEST (RE) eroeffnet mit Dulle und gewinnt, SUED (RE) spielt Fuchs — gleiche Partei
        // Prueft: Fuchs-Gefangen tritt nicht auf wenn Gewinner und Fuchs-Spieler dieselbe Partei haben.
        Stich stich = Stich.neu(SpielerPosition.WEST)
            .spieleKarte(SpielerPosition.WEST, dulle(1), new Hand(List.of(dulle(1))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.NORD, pikNeun(1), new Hand(List.of(pikNeun(1))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.OST, herzNeun(1), new Hand(List.of(herzNeun(1))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.SUED, karoAs(1), new Hand(List.of(karoAs(1))), trumpfOrdnung);

        EnumMap<Partei, List<SonderpunktEreignis>> ergebnis =
            bewerter.bewerte(List.of(stich), parteien, trumpfOrdnung, spielregeln);

        assertTrue(ergebnis.get(Partei.RE).isEmpty(),
            "Fuchs gefangen gilt nicht wenn Fuchs-Spieler und Stich-Gewinner zur selben Partei gehoeren.");
        assertTrue(ergebnis.get(Partei.KONTRA).isEmpty());
    }

    @Test
    void karlchen_WennKreuzBubeLetzenStichGewinnt() {
        // WEST (RE) gewinnt den einzigen (= letzten) Stich mit Kreuz-Bube
        // Prueft: Karlchen-Erkennung im letzten Stich — ohne diesen Test bliebe die
        // Index-Pruefung (index == stiche.size() - 1) unbemerkt falls sie fehlt oder falsch ist.
        Stich stich = Stich.neu(SpielerPosition.WEST)
            .spieleKarte(SpielerPosition.WEST, kreuzBube(1), new Hand(List.of(kreuzBube(1))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.NORD, pikNeun(1), new Hand(List.of(pikNeun(1))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.OST, herzNeun(1), new Hand(List.of(herzNeun(1))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.SUED, kreuzNeun(1), new Hand(List.of(kreuzNeun(1))), trumpfOrdnung);

        EnumMap<Partei, List<SonderpunktEreignis>> ergebnis =
            bewerter.bewerte(List.of(stich), parteien, trumpfOrdnung, spielregeln, 11);

        assertEquals(1, ergebnis.get(Partei.RE).size());
        assertEquals(Sonderpunkt.KARLCHEN, ergebnis.get(Partei.RE).get(0).art());
    }

    @Test
    void keinKarlchen_WennKreuzBubeNichtLetzenStichGewinnt() {
        // WEST (RE) gewinnt ersten Stich mit Kreuz-Bube — zweiter Stich ist der letzte
        // Prueft: Karlchen gilt ausschliesslich fuer den letzten Stich, nicht fuer fruehere.
        Stich ersterStich = Stich.neu(SpielerPosition.WEST)
            .spieleKarte(SpielerPosition.WEST, kreuzBube(1), new Hand(List.of(kreuzBube(1))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.NORD, pikNeun(1), new Hand(List.of(pikNeun(1))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.OST, herzNeun(1), new Hand(List.of(herzNeun(1))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.SUED, kreuzNeun(1), new Hand(List.of(kreuzNeun(1))), trumpfOrdnung);
        Stich letzterStich = Stich.neu(SpielerPosition.SUED)
            .spieleKarte(SpielerPosition.SUED, dulle(1), new Hand(List.of(dulle(1))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.WEST, herzNeun(2), new Hand(List.of(herzNeun(2))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.NORD, kreuzZehn(1), new Hand(List.of(kreuzZehn(1))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.OST, pikNeun(2), new Hand(List.of(pikNeun(2))), trumpfOrdnung);

        EnumMap<Partei, List<SonderpunktEreignis>> ergebnis =
            bewerter.bewerte(List.of(ersterStich, letzterStich), parteien, trumpfOrdnung, spielregeln);

        boolean hatKarlchen = ergebnis.values().stream()
            .flatMap(List::stream)
            .anyMatch(e -> e.art() == Sonderpunkt.KARLCHEN);
        assertFalse(hatKarlchen,
            "Karlchen gilt nur wenn der Kreuz-Bube den LETZTEN Stich gewinnt, nicht einen frueheren.");
    }

    @Test
    void doppelkopf_Bei40OderMehrAugenImStich() {
        // 2 Dullen (10+10) + 2 Kreuz-Zehn (10+10) = 40 Augen — WEST (RE) gewinnt
        // Kreuz-Zehn statt Karo-As, damit kein FUCHS_GEFANGEN die Zaehlung verfaelscht.
        // Prueft: Die 40-Augen-Grenze fuer Doppelkopf — ohne diesen Test bliebe die
        // mindestens(40)-Pruefung unbemerkt falls der Grenzwert verschoben wird.
        Stich stich = Stich.neu(SpielerPosition.SUED)
            .spieleKarte(SpielerPosition.SUED, dulle(1), new Hand(List.of(dulle(1))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.WEST, dulle(2), new Hand(List.of(dulle(2))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.NORD, kreuzZehn(1), new Hand(List.of(kreuzZehn(1))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.OST, kreuzZehn(2), new Hand(List.of(kreuzZehn(2))), trumpfOrdnung);

        EnumMap<Partei, List<SonderpunktEreignis>> ergebnis =
            bewerter.bewerte(List.of(stich), parteien, trumpfOrdnung, spielregeln);

        assertEquals(1, ergebnis.get(Partei.RE).size());
        assertEquals(Sonderpunkt.DOPPELKOPF, ergebnis.get(Partei.RE).get(0).art());
    }

    @Test
    void keinDoppelkopf_WennDeaktiviert() {
        // Prueft: Spielregeln steuern die Sonderpunktberechnung — ist Doppelkopf
        // deaktiviert, darf er selbst bei 40+ Augen nicht vergeben werden.
        Spielregeln ohneDoKo = spielregeln.mitSonderpunkten(true, true, false);
        Stich stich = Stich.neu(SpielerPosition.SUED)
            .spieleKarte(SpielerPosition.SUED, dulle(1), new Hand(List.of(dulle(1))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.WEST, dulle(2), new Hand(List.of(dulle(2))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.NORD, kreuzZehn(1), new Hand(List.of(kreuzZehn(1))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.OST, kreuzZehn(2), new Hand(List.of(kreuzZehn(2))), trumpfOrdnung);

        EnumMap<Partei, List<SonderpunktEreignis>> ergebnis =
            bewerter.bewerte(List.of(stich), parteien, trumpfOrdnung, ohneDoKo);

        assertTrue(ergebnis.get(Partei.RE).isEmpty());
        assertTrue(ergebnis.get(Partei.KONTRA).isEmpty());
    }

    @Test
    void keinFuchs_WennDeaktiviert() {
        // Prueft: Ist Fuchs deaktiviert, darf kein FUCHS_GEFANGEN vergeben werden.
        Spielregeln ohneFuchs = spielregeln.mitSonderpunkten(false, true, true);
        Stich stich = Stich.neu(SpielerPosition.NORD)
            .spieleKarte(SpielerPosition.NORD, dulle(1), new Hand(List.of(dulle(1))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.OST, pikNeun(1), new Hand(List.of(pikNeun(1))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.SUED, karoAs(1), new Hand(List.of(karoAs(1))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.WEST, herzNeun(1), new Hand(List.of(herzNeun(1))), trumpfOrdnung);

        EnumMap<Partei, List<SonderpunktEreignis>> ergebnis =
            bewerter.bewerte(List.of(stich), parteien, trumpfOrdnung, ohneFuchs);

        assertTrue(ergebnis.get(Partei.KONTRA).isEmpty(),
            "Ist Fuchs deaktiviert, darf kein FUCHS_GEFANGEN vergeben werden.");
        assertTrue(ergebnis.get(Partei.RE).isEmpty());
    }

    @Test
    void keinKarlchen_WennDeaktiviert() {
        // Prueft: Ist Karlchen deaktiviert, darf kein KARLCHEN vergeben werden.
        Spielregeln ohneKarlchen = spielregeln.mitSonderpunkten(true, false, true);
        Stich stich = Stich.neu(SpielerPosition.WEST)
            .spieleKarte(SpielerPosition.WEST, kreuzBube(1), new Hand(List.of(kreuzBube(1))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.NORD, pikNeun(1), new Hand(List.of(pikNeun(1))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.OST, herzNeun(1), new Hand(List.of(herzNeun(1))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.SUED, kreuzNeun(1), new Hand(List.of(kreuzNeun(1))), trumpfOrdnung);

        EnumMap<Partei, List<SonderpunktEreignis>> ergebnis =
            bewerter.bewerte(List.of(stich), parteien, trumpfOrdnung, ohneKarlchen);

        assertTrue(ergebnis.get(Partei.RE).isEmpty(),
            "Ist Karlchen deaktiviert, darf kein KARLCHEN vergeben werden.");
    }

    private Karte dulle(int exemplar) { return new Karte(Farbe.HERZ, Kartenwert.ZEHN, exemplar); }
    private Karte karoAs(int exemplar) { return new Karte(Farbe.KARO, Kartenwert.AS, exemplar); }
    private Karte kreuzAs(int exemplar) { return new Karte(Farbe.KREUZ, Kartenwert.AS, exemplar); }
    private Karte kreuzBube(int exemplar) { return new Karte(Farbe.KREUZ, Kartenwert.BUBE, exemplar); }
    private Karte kreuzDame(int exemplar) { return new Karte(Farbe.KREUZ, Kartenwert.DAME, exemplar); }
    private Karte kreuzNeun(int exemplar) { return new Karte(Farbe.KREUZ, Kartenwert.NEUN, exemplar); }
    private Karte kreuzZehn(int exemplar) { return new Karte(Farbe.KREUZ, Kartenwert.ZEHN, exemplar); }
    private Karte herzAs(int exemplar) { return new Karte(Farbe.HERZ, Kartenwert.AS, exemplar); }
    private Karte herzNeun(int exemplar) { return new Karte(Farbe.HERZ, Kartenwert.NEUN, exemplar); }
    private Karte pikAs(int exemplar) { return new Karte(Farbe.PIK, Kartenwert.AS, exemplar); }
    private Karte pikNeun(int exemplar) { return new Karte(Farbe.PIK, Kartenwert.NEUN, exemplar); }
}
