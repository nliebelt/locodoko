package de.locodoko.ki;

import de.locodoko.karten.Farbe;
import de.locodoko.karten.Hand;
import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartenwert;
import de.locodoko.karten.NormaleTrumpfOrdnung;
import de.locodoko.partie.SpielerPosition;
import de.locodoko.karten.Spielregeln;
import de.locodoko.karten.Spieltyp;
import de.locodoko.partie.ArmutStatus;
import de.locodoko.partie.Ansagen;
import de.locodoko.partie.Parteien;
import de.locodoko.partie.Spielphase;
import de.locodoko.partie.Stich;
import de.locodoko.partie.VorbehaltAnsage;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Tests fuer {@link LeichteKiStrategie}.
 *
 * Die leichte KI ist bewusst schwach: keine Solos, keine Ansagen, erste gueltige Karte.
 * Die Tests bestaetigen dieses Verhalten, damit sichergestellt ist, dass die einfache
 * Strategie tatsaechlich schlechter spielt als die Standardstrategie — und Spieler
 * dadurch realistische Erfolgserlebnisse haben.
 */
class LeichteKiStrategieTest {

    private final Spielregeln spielregeln = Spielregeln.standardRegeln();
    private final NormaleTrumpfOrdnung trumpfOrdnung = new NormaleTrumpfOrdnung(spielregeln);
    private final LeichteKiStrategie strategie = new LeichteKiStrategie();

    /**
     * Immer GESUND — auch mit einer sehr starken Solo-Hand.
     * Damit unterscheidet sich die leichte KI deutlich von der Standard-KI,
     * die bei starker Hand Solos anmeldet.
     */
    @Test
    void meldetImmerGesundAuchMitStarkerHand() {
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

        assertEquals(VorbehaltAnsage.GESUND, strategie.waehleVorbehalt(zustand),
            "Die leichte KI darf kein Solo anmelden — sie soll immer Gesund waehlen, " +
            "damit unerfahrene Spieler gegen eine einfach zu schlagende KI antreten.");
    }

    /**
     * Keine Ansagen, auch mit sehr starker Hand.
     * Ohne Re/Kontra verliert die KI den Bonuswert — menschliche Spieler profitieren.
     */
    @Test
    void sagt_niemals_an() {
        KiSpielzustand zustand = new KiSpielzustand(
            SpielerPosition.WEST,
            Spieltyp.NORMALSPIEL,
            new Spielphase.Stichphase(Stich.neu(SpielerPosition.NORD), Set.of(), null),
            spielregeln,
            trumpfOrdnung,
            new Hand(List.of(
                karte(Farbe.HERZ, Kartenwert.ZEHN, 1),
                karte(Farbe.HERZ, Kartenwert.ZEHN, 2),
                karte(Farbe.KREUZ, Kartenwert.DAME, 1),
                karte(Farbe.KREUZ, Kartenwert.BUBE, 1)
            )),
            Parteien.ausSolo(SpielerPosition.WEST),
            Ansagen.leer(),
            List.of(),
            null,
            null,
            null,
            List.of(karte(Farbe.HERZ, Kartenwert.ZEHN, 1)),
            List.of(de.locodoko.partie.Ansage.RE),
            List.of()
        );

        Optional<de.locodoko.partie.Ansage> ansage = strategie.waehleAnsage(zustand);
        assertFalse(ansage.isPresent(),
            "Die leichte KI soll niemals Re/Kontra ansagen — kein Bonusdruck auf menschliche Gegner.");
    }

    /**
     * Erste gueltige Karte spielen, unabhaengig vom strategischen Wert.
     * Das fuehrt zu suboptimalen Zuegen im Vergleich zur Standard-KI.
     */
    @Test
    void spieltErsteGueltigeKarte() {
        Karte ersteKarte = karte(Farbe.KREUZ, Kartenwert.DAME, 1);
        Karte zweiteKarte = karte(Farbe.KARO, Kartenwert.NEUN, 1);
        KiSpielzustand zustand = new KiSpielzustand(
            SpielerPosition.WEST,
            Spieltyp.NORMALSPIEL,
            new Spielphase.Stichphase(Stich.neu(SpielerPosition.NORD), Set.of(), null),
            spielregeln,
            trumpfOrdnung,
            new Hand(List.of(ersteKarte, zweiteKarte)),
            null,
            Ansagen.leer(),
            List.of(),
            null,
            null,
            null,
            List.of(ersteKarte, zweiteKarte),
            List.of(),
            List.of()
        );

        assertEquals(ersteKarte, strategie.waehleKarte(zustand),
            "Die leichte KI muss immer die erste gueltige Karte spielen — " +
            "keine strategische Auswahl, um menschlichen Spielern einen Vorteil zu geben.");
    }

    /**
     * Armut-Angebote werden immer abgelehnt, keine Wertberechnung.
     * Der ArmutStatus ist null — die LeichteKiStrategie prueft ihn nicht, sie lehnt immer ab.
     */
    @Test
    void lehntArmutImmerAb() {
        KiSpielzustand zustand = new KiSpielzustand(
            SpielerPosition.WEST,
            Spieltyp.ARMUT,
            new Spielphase.ArmutTausch(ArmutStatus.gestartet(SpielerPosition.NORD)),
            spielregeln,
            trumpfOrdnung,
            new Hand(List.of(
                karte(Farbe.KREUZ, Kartenwert.DAME, 1),
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
            List.of()
        );

        KiArmutAntwort antwort = strategie.waehleArmutAntwort(zustand);
        assertFalse(antwort.angenommen(),
            "Die leichte KI lehnt jedes Armut-Angebot ab — keine Auswertung des Angebotswerts.");
    }

    /**
     * Armut-Angebot: Alle Truempfe werden korrekt angeboten (Regelkonformitaet).
     * Auch die schwache KI muss gueltige Armut-Angebote machen.
     */
    @Test
    void bietetBeiArmutAlleTruepfeAn() {
        Karte trumpf = karte(Farbe.KREUZ, Kartenwert.DAME, 1);
        Karte fehlkarte = karte(Farbe.PIK, Kartenwert.AS, 1);
        KiSpielzustand zustand = new KiSpielzustand(
            SpielerPosition.WEST,
            Spieltyp.ARMUT,
            new Spielphase.ArmutTausch(ArmutStatus.gestartet(SpielerPosition.NORD)),
            spielregeln,
            trumpfOrdnung,
            new Hand(List.of(trumpf, fehlkarte)),
            Parteien.ausArmut(SpielerPosition.WEST),
            Ansagen.leer(),
            List.of(),
            null,
            null,
            null,
            List.of(),
            List.of(),
            List.of()
        );

        List<Karte> angebot = strategie.waehleArmutAngebot(zustand);
        assertTrue(angebot.contains(trumpf),
            "Die leichte KI muss in der Armut alle eigenen Truempfe anbieten, " +
            "damit der Spielfluss regelkonform weiterlaeuft.");
        assertFalse(angebot.contains(fehlkarte),
            "Fehlkarten duerfen im Armut-Angebot nicht enthalten sein.");
    }

    private Karte karte(Farbe farbe, Kartenwert wert, int exemplarIndex) {
        return new Karte(farbe, wert, exemplarIndex);
    }
}
