package de.locodoko.partie;

import de.locodoko.karten.Farbe;
import de.locodoko.karten.Hand;
import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartenwert;
import de.locodoko.karten.Spielregeln;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Unit-Tests fuer VorbehaltAnsage.istZulaessig().
 *
 * <p>Prueft die drei Schmeissen-Varianten (Fuenf Koenige, Fuenf Neunen, Wenig Trumpf)
 * sowie deren Abhaengigkeit von der Spielregeln-Konfiguration. Wichtig: ohne diese Tests
 * koennte eine fehlerhafte Kartenfilter-Bedingung (z.B. falscher Kartenwert) unbemerkt
 * bleiben, da das Enum keine Laufzeitfehler wirft — es gibt einfach still false zurueck.</p>
 */
class VorbehaltAnsageTest {

    private final Spielregeln mitSchmeissen = Spielregeln.standardRegeln().mitSchmeissenAktiv(true);
    private final Spielregeln ohneSchmeissen = Spielregeln.standardRegeln().mitSchmeissenAktiv(false);

    // Nicht-Trumpf-Karten: nur Kreuz und Pik ohne Dame/Bube (Karo ist Trumpffarbe in NormaleTrumpfOrdnung!)
    private static Karte kreuzAs(int i)    { return new Karte(Farbe.KREUZ, Kartenwert.AS,     i); }
    private static Karte pikAs(int i)      { return new Karte(Farbe.PIK,   Kartenwert.AS,     i); }
    private static Karte kreuzKoenig(int i){ return new Karte(Farbe.KREUZ, Kartenwert.KOENIG, i); }
    private static Karte pikKoenig(int i)  { return new Karte(Farbe.PIK,   Kartenwert.KOENIG, i); }
    private static Karte kreuzZehn(int i)  { return new Karte(Farbe.KREUZ, Kartenwert.ZEHN,   i); }
    private static Karte pikZehn(int i)    { return new Karte(Farbe.PIK,   Kartenwert.ZEHN,   i); }

    // Fuer Schmeissen-Karten
    private static Karte koenig(Farbe farbe, int i) { return new Karte(farbe, Kartenwert.KOENIG, i); }
    private static Karte neun(Farbe farbe, int i)   { return new Karte(farbe, Kartenwert.NEUN,   i); }

    // Sicherer Trumpf: Karo-Bube ist in NormaleTrumpfOrdnung immer Trumpf
    private static Karte karoBube(int i) { return new Karte(Farbe.KARO, Kartenwert.BUBE, i); }

    // --- SCHMEISSEN (Fuenf Koenige) ---

    @Test
    void schmeissen_fuenfKoenige_zulaessig() {
        Hand hand = new Hand(List.of(
            koenig(Farbe.KREUZ, 1), koenig(Farbe.KREUZ, 2),
            koenig(Farbe.PIK,   1), koenig(Farbe.PIK,   2),
            koenig(Farbe.KARO,  1),
            pikAs(1), pikAs(2), kreuzAs(1), kreuzAs(2), pikKoenig(1)
        ));
        assertTrue(VorbehaltAnsage.SCHMEISSEN.istZulaessig(hand, mitSchmeissen));
    }

    @Test
    void schmeissen_vierKoenige_nichtZulaessig() {
        Hand hand = new Hand(List.of(
            koenig(Farbe.KREUZ, 1), koenig(Farbe.KREUZ, 2),
            koenig(Farbe.PIK,   1), koenig(Farbe.PIK,   2),
            pikAs(1), pikAs(2), kreuzAs(1), kreuzAs(2), pikZehn(1), pikZehn(2)
        ));
        assertFalse(VorbehaltAnsage.SCHMEISSEN.istZulaessig(hand, mitSchmeissen));
    }

    @Test
    void schmeissen_fuenfKoenige_schmeissenDeaktiviert() {
        Hand hand = new Hand(List.of(
            koenig(Farbe.KREUZ, 1), koenig(Farbe.KREUZ, 2),
            koenig(Farbe.PIK,   1), koenig(Farbe.PIK,   2),
            koenig(Farbe.KARO,  1),
            pikAs(1), pikAs(2), kreuzAs(1), kreuzAs(2), pikKoenig(1)
        ));
        assertFalse(VorbehaltAnsage.SCHMEISSEN.istZulaessig(hand, ohneSchmeissen));
    }

    // --- SCHMEISSEN_FUENF_NEUNEN ---

    @Test
    void schmeissenFuenfNeunen_fuenfNeunen_zulaessig() {
        // Kreuz-Neun ist KEIN Trumpf (nur Karo-Neun ist Trumpf). Pik-Neun auch kein Trumpf.
        Hand hand = new Hand(List.of(
            neun(Farbe.KREUZ, 1), neun(Farbe.KREUZ, 2),
            neun(Farbe.PIK,   1), neun(Farbe.PIK,   2),
            neun(Farbe.KARO,  1),
            pikAs(1), pikAs(2), kreuzAs(1), kreuzAs(2), pikKoenig(1)
        ));
        assertTrue(VorbehaltAnsage.SCHMEISSEN_FUENF_NEUNEN.istZulaessig(hand, mitSchmeissen));
    }

    @Test
    void schmeissenFuenfNeunen_vierNeunen_nichtZulaessig() {
        Hand hand = new Hand(List.of(
            neun(Farbe.KREUZ, 1), neun(Farbe.KREUZ, 2),
            neun(Farbe.PIK,   1), neun(Farbe.PIK,   2),
            pikAs(1), pikAs(2), kreuzAs(1), kreuzAs(2), pikZehn(1), pikZehn(2)
        ));
        assertFalse(VorbehaltAnsage.SCHMEISSEN_FUENF_NEUNEN.istZulaessig(hand, mitSchmeissen));
    }

    @Test
    void schmeissenFuenfNeunen_fuenfNeunen_schmeissenDeaktiviert() {
        Hand hand = new Hand(List.of(
            neun(Farbe.KREUZ, 1), neun(Farbe.KREUZ, 2),
            neun(Farbe.PIK,   1), neun(Farbe.PIK,   2),
            neun(Farbe.KARO,  1),
            pikAs(1), pikAs(2), kreuzAs(1), kreuzAs(2), pikKoenig(1)
        ));
        assertFalse(VorbehaltAnsage.SCHMEISSEN_FUENF_NEUNEN.istZulaessig(hand, ohneSchmeissen));
    }

    // --- SCHMEISSEN_WENIG_TRUMPF ---

    @Test
    void schmeissenWenigTrumpf_einTrumpf_zulaessig() {
        Hand hand = new Hand(List.of(
            karoBube(1),
            kreuzAs(1), kreuzAs(2), pikAs(1), pikAs(2),
            kreuzKoenig(1), kreuzKoenig(2), pikKoenig(1), pikKoenig(2), pikZehn(1)
        ));
        assertTrue(VorbehaltAnsage.SCHMEISSEN_WENIG_TRUMPF.istZulaessig(hand, mitSchmeissen));
    }

    @Test
    void schmeissenWenigTrumpf_zweiTruempfe_nichtZulaessig() {
        Hand hand = new Hand(List.of(
            karoBube(1), karoBube(2),
            kreuzAs(1), kreuzAs(2), pikAs(1), pikAs(2),
            kreuzKoenig(1), kreuzKoenig(2), pikKoenig(1), pikKoenig(2)
        ));
        assertFalse(VorbehaltAnsage.SCHMEISSEN_WENIG_TRUMPF.istZulaessig(hand, mitSchmeissen));
    }

    @Test
    void schmeissenWenigTrumpf_einTrumpf_schmeissenDeaktiviert() {
        Hand hand = new Hand(List.of(
            karoBube(1),
            kreuzAs(1), kreuzAs(2), pikAs(1), pikAs(2),
            kreuzKoenig(1), kreuzKoenig(2), pikKoenig(1), pikKoenig(2), pikZehn(1)
        ));
        assertFalse(VorbehaltAnsage.SCHMEISSEN_WENIG_TRUMPF.istZulaessig(hand, ohneSchmeissen));
    }

    @Test
    void schmeissenWenigTrumpf_keinTrumpf_zulaessig() {
        Hand hand = new Hand(List.of(
            kreuzAs(1), kreuzAs(2), pikAs(1), pikAs(2),
            kreuzKoenig(1), kreuzKoenig(2), pikKoenig(1), pikKoenig(2), kreuzZehn(1), pikZehn(1)
        ));
        assertTrue(VorbehaltAnsage.SCHMEISSEN_WENIG_TRUMPF.istZulaessig(hand, mitSchmeissen));
    }
}
