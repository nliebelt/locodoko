package de.locodoko.karten;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class NormaleTrumpfOrdnungTest {

    @Test
    void erkenntTrumpfUndFehlkartenImNormalspielKorrekt() {
        TrumpfOrdnung trumpfOrdnung = new NormaleTrumpfOrdnung(Spielregeln.standardRegeln());

        assertTrue(trumpfOrdnung.istTrumpf(new Karte(Farbe.HERZ, Kartenwert.ZEHN, 1)),
            "Die Dulle ist der hoechste Trumpf und muss als solcher erkannt werden.");
        assertTrue(trumpfOrdnung.istTrumpf(new Karte(Farbe.KREUZ, Kartenwert.DAME, 1)),
            "Alle Damen sind Trumpf; die Kreuz-Dame ist fuer Parteibildung und Ranglogik zentral.");
        assertTrue(trumpfOrdnung.istTrumpf(new Karte(Farbe.PIK, Kartenwert.BUBE, 1)),
            "Alle Buben bleiben Trumpf und muessen fuer Soli austauschbar aus derselben Strategie kommen.");
        assertTrue(trumpfOrdnung.istTrumpf(new Karte(Farbe.KARO, Kartenwert.AS, 1)),
            "Karo-As gehoert im Normalspiel zur restlichen Trumpfkette.");
        assertFalse(trumpfOrdnung.istTrumpf(new Karte(Farbe.HERZ, Kartenwert.AS, 1)),
            "Herz-As bleibt Fehl und ist spaeter fuer Bedienpflicht und Stichfarbe relevant.");
        assertFalse(trumpfOrdnung.istTrumpf(new Karte(Farbe.HERZ, Kartenwert.NEUN, 1)),
            "Herz-Neun ist ebenfalls Fehl und darf nicht versehentlich in die Trumpfkette rutschen.");

        assertTrue(trumpfOrdnung.trumpfRang(new Karte(Farbe.HERZ, Kartenwert.ZEHN, 1))
                > trumpfOrdnung.trumpfRang(new Karte(Farbe.KREUZ, Kartenwert.DAME, 1)),
            "Die Dulle muss oberhalb aller Damen rangieren, damit Stichgewinner korrekt sind.");
        assertTrue(trumpfOrdnung.trumpfRang(new Karte(Farbe.KREUZ, Kartenwert.DAME, 1))
                > trumpfOrdnung.trumpfRang(new Karte(Farbe.KREUZ, Kartenwert.BUBE, 1)),
            "Damen muessen alle Buben stechen, sonst kippt die Standard-Trumpfhierarchie.");
        assertTrue(trumpfOrdnung.trumpfRang(new Karte(Farbe.KARO, Kartenwert.AS, 1))
                > trumpfOrdnung.trumpfRang(new Karte(Farbe.KARO, Kartenwert.KOENIG, 1)),
            "Innerhalb der Karo-Truempfe muss As vor Koenig liegen.");
        assertTrue(trumpfOrdnung.fehlRang(new Karte(Farbe.HERZ, Kartenwert.AS, 1))
                > trumpfOrdnung.fehlRang(new Karte(Farbe.HERZ, Kartenwert.KOENIG, 1)),
            "In Fehlfarben gilt weiterhin As vor Koenig; darauf baut die Fehlstichlogik auf.");
    }

    @Test
    void erlaubtAustauschbareTrumpfordnungenFuerAbweichendeSpieltypen() {
        Stich stich = Stich.neu(SpielerPosition.SUED)
            .spieleKarte(SpielerPosition.SUED, new Karte(Farbe.HERZ, Kartenwert.AS, 1),
                new Hand(java.util.List.of(new Karte(Farbe.HERZ, Kartenwert.AS, 1))),
                fleischlos())
            .spieleKarte(SpielerPosition.WEST, new Karte(Farbe.HERZ, Kartenwert.ZEHN, 1),
                new Hand(java.util.List.of(new Karte(Farbe.HERZ, Kartenwert.ZEHN, 1))),
                fleischlos());

        assertTrue(stich.gewinner(fleischlos()).spieler() == SpielerPosition.SUED,
            "Eine austauschbare Trumpfstrategie ist wichtig, damit Soli spaeter dieselbe Stichlogik wiederverwenden koennen.");
    }

    private TrumpfOrdnung fleischlos() {
        return new TrumpfOrdnung() {
            @Override
            public boolean istTrumpf(Karte karte) {
                return false;
            }

            @Override
            public Bedienfarbe bedienfarbeVon(Karte karte) {
                return Bedienfarbe.fehl(karte.farbe());
            }

            @Override
            public int fehlRang(Karte karte) {
                return karte.wert().fehlRang();
            }

            @Override
            public int trumpfRang(Karte karte) {
                throw new IllegalArgumentException("Es gibt im Fleischlos keine Truempe");
            }
        };
    }
}
