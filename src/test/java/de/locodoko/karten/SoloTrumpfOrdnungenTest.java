package de.locodoko.karten;

import de.locodoko.partie.SpielerPosition;
import de.locodoko.partie.Stich;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SoloTrumpfOrdnungenTest {

    @Test
    void erkenntImDamensoloNurDamenAlsTrumpf() {
        TrumpfOrdnung trumpfOrdnung = new DamensoloTrumpfOrdnung();

        assertTrue(trumpfOrdnung.istTrumpf(karte(Farbe.KREUZ, Kartenwert.DAME, 1)),
            "Im Damensolo duerfen nur Damen Trumpf sein, damit Dulle, Buben und Karo sauber in Fehlfarben zurueckfallen.");
        assertFalse(trumpfOrdnung.istTrumpf(karte(Farbe.KREUZ, Kartenwert.BUBE, 1)));
        assertFalse(trumpfOrdnung.istTrumpf(karte(Farbe.KARO, Kartenwert.AS, 1)));
        assertFalse(trumpfOrdnung.istTrumpf(karte(Farbe.HERZ, Kartenwert.ZEHN, 1)),
            "Die Dulle verliert im Damensolo ihren Trumpfstatus und muss wieder als Herz-Fehlkarte behandelt werden.");
        assertTrue(trumpfOrdnung.trumpfRang(karte(Farbe.KREUZ, Kartenwert.DAME, 1))
                > trumpfOrdnung.trumpfRang(karte(Farbe.KARO, Kartenwert.DAME, 1)),
            "Die Damen muessen im Damensolo in Farb-Reihenfolge Kreuz > Pik > Herz > Karo rangieren.");
        assertEquals(Bedienfarbe.fehl(Farbe.HERZ), trumpfOrdnung.bedienfarbeVon(karte(Farbe.HERZ, Kartenwert.ZEHN, 1)));
    }

    @Test
    void erkenntImBubensoloNurBubenAlsTrumpf() {
        TrumpfOrdnung trumpfOrdnung = new BubensoloTrumpfOrdnung();

        assertTrue(trumpfOrdnung.istTrumpf(karte(Farbe.KREUZ, Kartenwert.BUBE, 1)));
        assertFalse(trumpfOrdnung.istTrumpf(karte(Farbe.KREUZ, Kartenwert.DAME, 1)),
            "Damen werden im Bubensolo wieder normale Fehlkarten; sonst waere die Solo-Variante fachlich nicht unterscheidbar.");
        assertFalse(trumpfOrdnung.istTrumpf(karte(Farbe.KARO, Kartenwert.AS, 1)));
        assertFalse(trumpfOrdnung.istTrumpf(karte(Farbe.HERZ, Kartenwert.ZEHN, 1)));
        assertTrue(trumpfOrdnung.trumpfRang(karte(Farbe.KREUZ, Kartenwert.BUBE, 1))
                > trumpfOrdnung.trumpfRang(karte(Farbe.KARO, Kartenwert.BUBE, 1)),
            "Auch im Bubensolo muss die Farbrangfolge Kreuz > Pik > Herz > Karo stabil bleiben.");
        assertEquals(karte(Farbe.KREUZ, Kartenwert.DAME, 1).wert().fehlRang(),
            trumpfOrdnung.fehlRang(karte(Farbe.KREUZ, Kartenwert.DAME, 1)));
    }

    @Test
    void erzwingtImDamensoloAuchBeiKaroDieFehlbedienung() {
        TrumpfOrdnung trumpfOrdnung = new DamensoloTrumpfOrdnung();
        Stich stich = Stich.neu(SpielerPosition.SUED)
            .spieleKarte(SpielerPosition.SUED, karte(Farbe.KARO, Kartenwert.KOENIG, 1),
                new Hand(List.of(karte(Farbe.KARO, Kartenwert.KOENIG, 1))),
                trumpfOrdnung);
        Hand hand = new Hand(List.of(
            karte(Farbe.KARO, Kartenwert.AS, 1),
            karte(Farbe.KREUZ, Kartenwert.DAME, 1)
        ));

        assertEquals(List.of(karte(Farbe.KARO, Kartenwert.AS, 1)), stich.gueltigeKarten(hand, trumpfOrdnung),
            "Weil Karo im Damensolo Fehl ist, muss ein vorhandenes Karo bedient werden und darf nicht durch eine Dame ersetzt werden.");
    }

    @Test
    void laesstImFleischlosNurDieAngefragteFarbeGewinnen() {
        TrumpfOrdnung trumpfOrdnung = new FleischlosTrumpfOrdnung();
        Stich stich = Stich.neu(SpielerPosition.SUED)
            .spieleKarte(SpielerPosition.SUED, karte(Farbe.KREUZ, Kartenwert.KOENIG, 1),
                new Hand(List.of(karte(Farbe.KREUZ, Kartenwert.KOENIG, 1))),
                trumpfOrdnung)
            .spieleKarte(SpielerPosition.WEST, karte(Farbe.PIK, Kartenwert.AS, 1),
                new Hand(List.of(karte(Farbe.PIK, Kartenwert.AS, 1))),
                trumpfOrdnung)
            .spieleKarte(SpielerPosition.NORD, karte(Farbe.KREUZ, Kartenwert.ZEHN, 1),
                new Hand(List.of(karte(Farbe.KREUZ, Kartenwert.ZEHN, 1))),
                trumpfOrdnung)
            .spieleKarte(SpielerPosition.OST, karte(Farbe.HERZ, Kartenwert.AS, 1),
                new Hand(List.of(karte(Farbe.HERZ, Kartenwert.AS, 1))),
                trumpfOrdnung);

        assertFalse(trumpfOrdnung.istTrumpf(karte(Farbe.KREUZ, Kartenwert.DAME, 1)),
            "Im Fleischlos gibt es ueberhaupt keine Truempe; jede Karte gehoert ausschliesslich zu ihrer natuerlichen Farbe.");
        assertEquals(SpielerPosition.NORD, stich.gewinner(trumpfOrdnung).spieler(),
            "Ohne Trumpf darf nur die angefragte Farbe den Stich gewinnen; Abwerfen anderer Farben darf keinen Stich stechen.");
    }

    @Test
    void erkenntImVariablenTrumpfsoloNurDieGewaehlteFarbeAlsTrumpf() {
        // Warum wichtig: VariableTrumpfsoloTrumpfOrdnung muss die gewaehlte Farbe als Fehltrumpf
        // behandeln, waehrend andere Farben (ausser Dame/Bube) Fehlkarten bleiben.
        // Ohne diesen Test koennte eine falsche Farbe als Trumpf behandelt werden.
        Spielregeln regeln = Spielregeln.standardRegeln();

        TrumpfOrdnung herzsolo = new VariableTrumpfsoloTrumpfOrdnung(Farbe.HERZ, regeln);
        assertTrue(herzsolo.istTrumpf(karte(Farbe.HERZ, Kartenwert.KOENIG, 1)),
            "Im Herzsolo sind Herz-Karten Trumpf.");
        assertTrue(herzsolo.istTrumpf(karte(Farbe.HERZ, Kartenwert.ZEHN, 1)),
            "Die Herz-Zehn ist im Herzsolo als Herz-Karte Trumpf (aber kein Dulle-Sonderstatus).");
        assertFalse(herzsolo.istTrumpf(karte(Farbe.KARO, Kartenwert.AS, 1)),
            "Karo-As ist im Herzsolo Fehlkarte.");
        assertFalse(herzsolo.istTrumpf(karte(Farbe.PIK, Kartenwert.KOENIG, 1)));
        assertTrue(herzsolo.istTrumpf(karte(Farbe.KREUZ, Kartenwert.DAME, 1)),
            "Damen bleiben in allen variablen Trumpfsoli Trumpf.");
        assertTrue(herzsolo.istTrumpf(karte(Farbe.PIK, Kartenwert.BUBE, 1)),
            "Buben bleiben in allen variablen Trumpfsoli Trumpf.");
        assertFalse(herzsolo.spaetereGleicheKarteGewinnt(karte(Farbe.HERZ, Kartenwert.ZEHN, 1)),
            "Es gibt keinen Dulle-Mechanismus in variablen Trumpfsoli.");

        TrumpfOrdnung piksolo = new VariableTrumpfsoloTrumpfOrdnung(Farbe.PIK, regeln);
        assertTrue(piksolo.istTrumpf(karte(Farbe.PIK, Kartenwert.AS, 1)));
        assertFalse(piksolo.istTrumpf(karte(Farbe.HERZ, Kartenwert.ZEHN, 1)),
            "Herz-Zehn ist im Piksolo keine Dulle und kein Trumpf.");
        assertFalse(piksolo.istTrumpf(karte(Farbe.KARO, Kartenwert.NEUN, 1)));

        TrumpfOrdnung kreuzsolo = new VariableTrumpfsoloTrumpfOrdnung(Farbe.KREUZ, regeln);
        assertTrue(kreuzsolo.istTrumpf(karte(Farbe.KREUZ, Kartenwert.KOENIG, 1)));
        assertFalse(kreuzsolo.istTrumpf(karte(Farbe.HERZ, Kartenwert.ZEHN, 1)),
            "Herz-Zehn ist im Kreuzsolo keine Dulle.");
    }

    @Test
    void rangordnungImVariablenTrumpfsoloIstKorrekt() {
        // Warum wichtig: Buben und Damen muessen ueber den Farbtrumpfen rangieren.
        // Ohne diesen Test koennten Stiche falsch gewertet werden.
        Spielregeln regeln = Spielregeln.standardRegeln();
        TrumpfOrdnung herzsolo = new VariableTrumpfsoloTrumpfOrdnung(Farbe.HERZ, regeln);

        assertTrue(
            herzsolo.trumpfRang(karte(Farbe.KARO, Kartenwert.BUBE, 1))
                > herzsolo.trumpfRang(karte(Farbe.HERZ, Kartenwert.AS, 1)),
            "Buben muessen ueber den Farbtrumpfen rangieren.");
        assertTrue(
            herzsolo.trumpfRang(karte(Farbe.KARO, Kartenwert.DAME, 1))
                > herzsolo.trumpfRang(karte(Farbe.KREUZ, Kartenwert.BUBE, 1)),
            "Damen muessen ueber den Buben rangieren.");
        assertTrue(
            herzsolo.trumpfRang(karte(Farbe.KREUZ, Kartenwert.DAME, 1))
                > herzsolo.trumpfRang(karte(Farbe.KARO, Kartenwert.DAME, 1)),
            "Farb-Reihenfolge der Damen: Kreuz > Pik > Herz > Karo.");
        assertTrue(
            herzsolo.trumpfRang(karte(Farbe.HERZ, Kartenwert.AS, 1))
                > herzsolo.trumpfRang(karte(Farbe.HERZ, Kartenwert.KOENIG, 1)),
            "Innerhalb der Farbtrumpfe rangiert As ueber Koenig.");
    }

    private Karte karte(Farbe farbe, Kartenwert wert, int exemplarIndex) {
        return new Karte(farbe, wert, exemplarIndex);
    }
}
