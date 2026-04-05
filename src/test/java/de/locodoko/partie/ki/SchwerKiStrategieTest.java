package de.locodoko.partie.ki;

import de.locodoko.karten.Farbe;
import de.locodoko.karten.Hand;
import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartenwert;
import de.locodoko.karten.NormaleTrumpfOrdnung;
import de.locodoko.karten.SpielerPosition;
import de.locodoko.karten.Spielregeln;
import de.locodoko.karten.Spieltyp;
import de.locodoko.karten.Stich;
import de.locodoko.partie.Ansage;
import de.locodoko.partie.Ansagen;
import de.locodoko.partie.Parteien;
import de.locodoko.partie.Spielphase;
import de.locodoko.partie.VorbehaltAnsage;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Tests fuer {@link SchwerKiStrategie}.
 *
 * Die schwere KI soll dieselbe Kartenauswahl wie die Standard-KI verwenden,
 * aber aggressivere Ansage-Schwellenwerte haben. Die Tests pruefen, dass:
 * 1. RE schon bei einer moderaten Hand angesagt wird (Schwelle 24 statt 28).
 * 2. Die Kartenauswahl identisch mit der Standard-KI ist (Vererbung intakt).
 */
class SchwerKiStrategieTest {

    private final Spielregeln spielregeln = Spielregeln.standardRegeln();
    private final NormaleTrumpfOrdnung trumpfOrdnung = new NormaleTrumpfOrdnung(spielregeln);
    private final SchwerKiStrategie strategie = new SchwerKiStrategie();
    private final StandardKiStrategie standardStrategie = new StandardKiStrategie();

    /**
     * RE-Ansage bei mittlerer Hand: Die schwere KI sagt an (Schwelle 24),
     * die Standard-KI nicht (Schwelle 28).
     *
     * Handstaerke: 2 Kreuz-Damen (2x4=8) + 4 non-As-Truempfe (4x3=12) = 20... nein:
     * Alle 6 Karten sind Truempfe: 6x3=18, plus 2 Kreuz-Damen bonus: 2x4=8 → 26.
     * Standard-Schwelle RE: 28 → kein RE.
     * Schwer-Schwelle RE: 24 → RE!
     */
    @Test
    void sagtReSchonBeiMittlererHandAn() {
        // Handstaerke: 6 Truempfe (6x3=18) + 2 Kreuz-Damen-Bonus (2x4=8) = 26
        // (Keine Dullen, keine Asse → saubere Berechnung)
        // Standard-Schwelle RE: 28 → kein RE.   Schwer-Schwelle RE: 24 → RE!
        KiSpielzustand zustand = new KiSpielzustand(
            SpielerPosition.WEST,
            Spieltyp.NORMALSPIEL,
            Spielphase.STICHPHASE,
            spielregeln,
            trumpfOrdnung,
            new Hand(List.of(
                karte(Farbe.KREUZ, Kartenwert.DAME, 1),
                karte(Farbe.KREUZ, Kartenwert.DAME, 2),
                karte(Farbe.PIK, Kartenwert.BUBE, 1),
                karte(Farbe.HERZ, Kartenwert.BUBE, 1),
                karte(Farbe.KARO, Kartenwert.KOENIG, 1),
                karte(Farbe.KARO, Kartenwert.NEUN, 1)
            )),
            Parteien.ausSolo(SpielerPosition.WEST),
            Ansagen.leer(),
            List.of(),
            Stich.neu(SpielerPosition.WEST),
            null,
            null,
            List.of(karte(Farbe.KREUZ, Kartenwert.DAME, 1)),
            List.of(Ansage.RE),
            List.of()
        );

        assertTrue(strategie.waehleAnsage(zustand).isPresent(),
            "Die schwere KI soll mit Handstaerke 26 bereits RE ansagen (Schwelle 24), " +
            "damit der Schwierigkeitsunterschied zur Standard-KI (Schwelle 28) spuerbar ist.");
        assertEquals(Ansage.RE, strategie.waehleAnsage(zustand).orElseThrow());

        assertTrue(standardStrategie.waehleAnsage(zustand).isEmpty(),
            "Die Standard-KI darf mit Handstaerke 26 kein RE ansagen (Schwelle 28), " +
            "um den Unterschied zwischen STANDARD und SCHWER klar abzugrenzen.");
    }

    /**
     * Kartenauswahl der schweren KI identisch mit Standard-KI.
     * SchwerKiStrategie erbt waehleKarte() von StandardKiStrategie — Vererbung muss funktionieren.
     */
    @Test
    void kartenauswahlGleichWieStandardKi() {
        Karte kreuzDame = karte(Farbe.KREUZ, Kartenwert.DAME, 1);
        Karte karoNeun = karte(Farbe.KARO, Kartenwert.NEUN, 1);
        KiSpielzustand zustand = new KiSpielzustand(
            SpielerPosition.WEST,
            Spieltyp.NORMALSPIEL,
            Spielphase.STICHPHASE,
            spielregeln,
            trumpfOrdnung,
            new Hand(List.of(kreuzDame, karoNeun)),
            null,
            Ansagen.leer(),
            List.of(),
            null,
            null,
            null,
            List.of(kreuzDame, karoNeun),
            List.of(),
            List.of()
        );

        Karte schwerKarte = strategie.waehleKarte(zustand);
        Karte standardKarte = standardStrategie.waehleKarte(zustand);
        assertEquals(standardKarte, schwerKarte,
            "Die Kartenauswahl der schweren KI muss identisch mit der Standard-KI sein, " +
            "da SchwerKiStrategie waehleKarte() von StandardKiStrategie erbt.");
    }

    /**
     * Vorbehalt-Auswahl der schweren KI identisch mit Standard-KI.
     */
    @Test
    void vorbehaltauswahlGleichWieStandardKi() {
        KiSpielzustand zustand = new KiSpielzustand(
            SpielerPosition.WEST,
            Spieltyp.NORMALSPIEL,
            Spielphase.VORBEHALT_ANSAGE,
            spielregeln,
            trumpfOrdnung,
            new Hand(List.of(
                karte(Farbe.HERZ, Kartenwert.ZEHN, 1),
                karte(Farbe.HERZ, Kartenwert.ZEHN, 2),
                karte(Farbe.KREUZ, Kartenwert.DAME, 1),
                karte(Farbe.PIK, Kartenwert.DAME, 1),
                karte(Farbe.HERZ, Kartenwert.DAME, 1),
                karte(Farbe.KREUZ, Kartenwert.BUBE, 1),
                karte(Farbe.PIK, Kartenwert.BUBE, 1),
                karte(Farbe.KARO, Kartenwert.AS, 1),
                karte(Farbe.KARO, Kartenwert.ZEHN, 1),
                karte(Farbe.KARO, Kartenwert.KOENIG, 1),
                karte(Farbe.KREUZ, Kartenwert.AS, 1),
                karte(Farbe.PIK, Kartenwert.AS, 1)
            )),
            null,
            Ansagen.leer(),
            List.of(),
            null,
            null,
            null,
            List.of(),
            List.of(),
            List.of(VorbehaltAnsage.GESUND, VorbehaltAnsage.SOLO_TRUMPF)
        );

        assertEquals(standardStrategie.waehleVorbehalt(zustand), strategie.waehleVorbehalt(zustand),
            "Die schwere KI soll dieselbe Vorbehalt-Entscheidung wie die Standard-KI treffen, " +
            "da nur die Ansage-Schwellenwerte unterschiedlich sind.");
    }

    /**
     * KONTRA-Ansage bei mittlerer Hand: Die schwere KI sagt an (Schwelle 22),
     * die Standard-KI nicht (Schwelle 26).
     *
     * Handstaerke: 8 Truempfe (keine Dullen, keine Kreuz-Damen, keine Asse) = 8*3 = 24.
     * Schwer-Schwelle KONTRA (eigenePartei=KONTRA): 22 → KONTRA!
     * Standard-Schwelle KONTRA (eigenePartei=KONTRA): 26 → kein KONTRA.
     *
     * Wichtig: Ohne diesen Test wäre der KONTRA-Schwellenunterschied (22 vs 26) ungetestet
     * — nur der RE-Unterschied wäre belegt. Doppelkopf-Partien drehen sich häufig um
     * KONTRA-Ankündigungen, daher ist diese Abgrenzung spielpraktisch relevant.
     */
    @Test
    void sagtKontraSchonBeiMittlererHandAn() {
        // Handstaerke: 8 Truempfe × 3 = 24 (keine Dullen/Kreuz-Damen/Asse → saubere Berechnung)
        KiSpielzustand zustand = new KiSpielzustand(
            SpielerPosition.WEST,
            Spieltyp.NORMALSPIEL,
            Spielphase.STICHPHASE,
            spielregeln,
            trumpfOrdnung,
            new Hand(List.of(
                karte(Farbe.PIK, Kartenwert.BUBE, 1),
                karte(Farbe.PIK, Kartenwert.BUBE, 2),
                karte(Farbe.HERZ, Kartenwert.BUBE, 1),
                karte(Farbe.HERZ, Kartenwert.BUBE, 2),
                karte(Farbe.KARO, Kartenwert.BUBE, 1),
                karte(Farbe.KARO, Kartenwert.BUBE, 2),
                karte(Farbe.KARO, Kartenwert.NEUN, 1),
                karte(Farbe.KARO, Kartenwert.NEUN, 2)
            )),
            Parteien.ausSolo(SpielerPosition.OST),  // WEST = KONTRA
            Ansagen.leer(),
            List.of(),
            Stich.neu(SpielerPosition.WEST),
            null,
            null,
            List.of(karte(Farbe.PIK, Kartenwert.BUBE, 1)),
            List.of(Ansage.KONTRA),
            List.of()
        );

        assertTrue(strategie.waehleAnsage(zustand).isPresent(),
            "Die schwere KI soll mit Handstaerke 24 bereits KONTRA ansagen (Schwelle 22), " +
            "damit der Schwierigkeitsunterschied zur Standard-KI (Schwelle 26) auch bei KONTRA spuerbar ist.");
        assertEquals(Ansage.KONTRA, strategie.waehleAnsage(zustand).orElseThrow());

        assertTrue(standardStrategie.waehleAnsage(zustand).isEmpty(),
            "Die Standard-KI darf mit Handstaerke 24 kein KONTRA ansagen (Schwelle 26), " +
            "um den Unterschied zwischen STANDARD und SCHWER bei der KONTRA-Partei klar abzugrenzen.");
    }

    /**
     * KEINE_90-Ansage bei starker Hand: Die schwere KI sagt an (Schwelle 32),
     * die Standard-KI nicht (Schwelle 36).
     *
     * Handstaerke: 11 Truempfe (keine Dullen, keine Kreuz-Damen, keine Asse) = 11*3 = 33.
     * Schwer-Schwelle KEINE_90: 32 → KEINE_90!
     * Standard-Schwelle KEINE_90: 36 → keine KEINE_90.
     *
     * Wichtig: Verschaerfungen (KEINE_90 ff.) sind die haeufigste Form aggressiver
     * Spielfuehrung. Ohne diesen Test wäre unbewiesen, ob die schwere KI tatsaechlich
     * haeufiger Verschaerfungen ansagt als die Standard-KI.
     */
    @Test
    void sagtKeine90BeiStarkerHandAn() {
        // Handstaerke: 11 Truempfe × 3 = 33 (keine Dullen/Kreuz-Damen/Asse → saubere Berechnung)
        KiSpielzustand zustand = new KiSpielzustand(
            SpielerPosition.WEST,
            Spieltyp.NORMALSPIEL,
            Spielphase.STICHPHASE,
            spielregeln,
            trumpfOrdnung,
            new Hand(List.of(
                karte(Farbe.PIK, Kartenwert.DAME, 1),
                karte(Farbe.PIK, Kartenwert.DAME, 2),
                karte(Farbe.HERZ, Kartenwert.DAME, 1),
                karte(Farbe.HERZ, Kartenwert.DAME, 2),
                karte(Farbe.KARO, Kartenwert.DAME, 1),
                karte(Farbe.KARO, Kartenwert.DAME, 2),
                karte(Farbe.KREUZ, Kartenwert.BUBE, 1),
                karte(Farbe.KREUZ, Kartenwert.BUBE, 2),
                karte(Farbe.PIK, Kartenwert.BUBE, 1),
                karte(Farbe.HERZ, Kartenwert.BUBE, 1),
                karte(Farbe.KARO, Kartenwert.BUBE, 1)
            )),
            Parteien.ausSolo(SpielerPosition.WEST),  // WEST = RE
            Ansagen.leer(),
            List.of(),
            Stich.neu(SpielerPosition.WEST),
            null,
            null,
            List.of(karte(Farbe.PIK, Kartenwert.DAME, 1)),
            List.of(Ansage.KEINE_90),
            List.of()
        );

        assertTrue(strategie.waehleAnsage(zustand).isPresent(),
            "Die schwere KI soll mit Handstaerke 33 bereits KEINE_90 ansagen (Schwelle 32), " +
            "damit Verschaerfungen haeufiger als bei der Standard-KI (Schwelle 36) ausgerufen werden.");
        assertEquals(Ansage.KEINE_90, strategie.waehleAnsage(zustand).orElseThrow());

        assertTrue(standardStrategie.waehleAnsage(zustand).isEmpty(),
            "Die Standard-KI darf mit Handstaerke 33 keine KEINE_90 ansagen (Schwelle 36), " +
            "um den Unterschied zwischen STANDARD und SCHWER bei Verschaerfungen klar zu belegen.");
    }

    /**
     * Hochzeit-Anmeldung bei zwei Kreuz-Damen: SchwerKiStrategie erbt waehleVorbehalt()
     * von StandardKiStrategie und muss Hochzeit korrekt anmelden.
     *
     * Wichtig: Prueft dass die Vererbungskette intakt ist — SchwerKiStrategie darf
     * die Hochzeit-Logik nicht durch einen Override unterbrechen.
     */
    @Test
    void meldetHochzeitBeiZweiKreuzDamen() {
        KiSpielzustand zustand = new KiSpielzustand(
            SpielerPosition.SUED,
            Spieltyp.NORMALSPIEL,
            Spielphase.VORBEHALT_ANSAGE,
            spielregeln,
            trumpfOrdnung,
            new Hand(List.of(
                karte(Farbe.KREUZ, Kartenwert.DAME, 1),
                karte(Farbe.KREUZ, Kartenwert.DAME, 2),
                karte(Farbe.KREUZ, Kartenwert.AS, 1),
                karte(Farbe.PIK, Kartenwert.AS, 1),
                karte(Farbe.HERZ, Kartenwert.AS, 1),
                karte(Farbe.KREUZ, Kartenwert.KOENIG, 1),
                karte(Farbe.PIK, Kartenwert.KOENIG, 1),
                karte(Farbe.HERZ, Kartenwert.KOENIG, 1),
                karte(Farbe.KREUZ, Kartenwert.NEUN, 1),
                karte(Farbe.PIK, Kartenwert.NEUN, 1),
                karte(Farbe.HERZ, Kartenwert.NEUN, 1),
                karte(Farbe.HERZ, Kartenwert.NEUN, 2)
            )),
            null,
            Ansagen.leer(),
            List.of(),
            null,
            null,
            null,
            List.of(),
            List.of(),
            List.of(VorbehaltAnsage.GESUND, VorbehaltAnsage.HOCHZEIT)
        );

        assertEquals(VorbehaltAnsage.HOCHZEIT, strategie.waehleVorbehalt(zustand),
            "SchwerKiStrategie erbt waehleVorbehalt() und muss bei zwei Kreuz-Damen und " +
            "schwacher Hand Hochzeit anmelden — Vererbungskette darf nicht unterbrochen sein.");
    }

    private Karte karte(Farbe farbe, Kartenwert wert, int exemplarIndex) {
        return new Karte(farbe, wert, exemplarIndex);
    }
}
