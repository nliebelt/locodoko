package de.locodoko.partie;

import de.locodoko.karten.Farbe;
import de.locodoko.karten.Hand;
import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartendeck;
import de.locodoko.karten.Kartenwert;
import de.locodoko.karten.SpielerPosition;
import de.locodoko.karten.Spielregeln;
import de.locodoko.karten.Spieltyp;
import org.junit.jupiter.api.Test;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Unit-Tests fuer die Armut-Sonderregel.
 *
 * <p>Prueft Erkennung (T2.1, T2.5), Trumpfkarten-Angebot (T2.2),
 * bidirektionalen Kartentausch bei Annahme (T2.3) sowie
 * Einwurf bei Ablehnung aller Spieler (T2.4).</p>
 */
class ArmutTest {

    private final Spielregeln spielregeln = Spielregeln.standardRegeln();

    // Karo-Buben als sichere Trumpfkarten (in NormaleTrumpfOrdnung immer Trumpf)
    private final Karte karoBube1 = new Karte(Farbe.KARO, Kartenwert.BUBE, 1);
    private final Karte karoBube2 = new Karte(Farbe.KARO, Kartenwert.BUBE, 2);

    // Nicht-Trumpf: KREUZ und PIK ohne Dame/Bube
    private final Karte kreuzAs1   = new Karte(Farbe.KREUZ, Kartenwert.AS,     1);
    private final Karte kreuzAs2   = new Karte(Farbe.KREUZ, Kartenwert.AS,     2);
    private final Karte kreuzZehn1 = new Karte(Farbe.KREUZ, Kartenwert.ZEHN,   1);
    private final Karte kreuzZehn2 = new Karte(Farbe.KREUZ, Kartenwert.ZEHN,   2);
    private final Karte kreuzKoen1 = new Karte(Farbe.KREUZ, Kartenwert.KOENIG, 1);
    private final Karte kreuzKoen2 = new Karte(Farbe.KREUZ, Kartenwert.KOENIG, 2);
    private final Karte kreuzNeun1 = new Karte(Farbe.KREUZ, Kartenwert.NEUN,   1);
    private final Karte kreuzNeun2 = new Karte(Farbe.KREUZ, Kartenwert.NEUN,   2);
    private final Karte pikAs1     = new Karte(Farbe.PIK,   Kartenwert.AS,     1);
    private final Karte pikAs2     = new Karte(Farbe.PIK,   Kartenwert.AS,     2);

    // --- T2.1: Erkennung ---

    @Test
    void armutErkannt_BeiZweiTruempfen() {
        // Warum wichtig: Spieler mit hoechstens drei Truempfen darf Armut anmelden.
        // Dieser Test sichert die Eingangspruefung von VorbehaltAnsage.ARMUT ab —
        // ohne ihn koennte ein Spieler mit zu vielen Truempfen faelschlich Armut
        // anmelden und die Parteiverteilung korrumpieren.
        Hand hand = new Hand(List.of(karoBube1, karoBube2));
        assertTrue(VorbehaltAnsage.ARMUT.istZulaessig(hand, spielregeln),
            "Zwei Truempfe muss Armut als Vorbehalt zulassen.");
    }

    @Test
    void armutErkannt_BeiGenauDreiTruempfen() {
        // Warum wichtig: Drei Truempfe ist die exakte Grenze — "hoechstens drei".
        // Der Grenzfall muss explizit getestet sein, da ein Off-by-One (<3 statt <=3)
        // den haeufigsten Fall — genau drei Truempfe — faelschlich sperren wuerde.
        Hand hand = new Hand(List.of(
            karoBube1,
            karoBube2,
            new Karte(Farbe.HERZ, Kartenwert.BUBE, 1)
        ));
        assertTrue(VorbehaltAnsage.ARMUT.istZulaessig(hand, spielregeln),
            "Genau drei Truempfe muss Armut als Vorbehalt zulassen (Grenzwert <=3).");
    }

    @Test
    void armutAbgelehnt_BeiVierTruempfen() {
        // Warum wichtig: Vier Truempfe ueberschreiten die Armut-Grenze — kein Vorbehalt
        // erlaubt. Falsch-positiv wuerde den Einzel-RE-Partner-Mechanismus korrumpieren.
        Hand hand = new Hand(List.of(
            karoBube1,
            karoBube2,
            new Karte(Farbe.HERZ, Kartenwert.BUBE, 1),
            new Karte(Farbe.PIK,  Kartenwert.BUBE, 1)
        ));
        assertFalse(VorbehaltAnsage.ARMUT.istZulaessig(hand, spielregeln),
            "Vier Truempfe duerfen Armut nicht ausloesen.");
    }

    @Test
    void armutAbgelehnt_BeiDeaktivierterRegel() {
        // Warum wichtig: Tischkonfiguration muss Armut serverseitig sperren koennen,
        // damit Frontend und Backend dieselbe Regelbasis teilen.
        Spielregeln ohneArmut = spielregeln.mitArmutAktiv(false);
        Hand hand = new Hand(List.of(karoBube1));
        assertFalse(VorbehaltAnsage.ARMUT.istZulaessig(hand, ohneArmut),
            "Deaktivierte Armut-Regel muss Vorbehalt auch bei nur einem Trumpf sperren.");
    }

    // --- T2.5: Armut-Spieler hat 0 Trumpfkarten ---

    @Test
    void armutErkannt_BeiNullTruempfen() {
        // Warum wichtig: Ein Spieler ohne jeden Trumpf ist der extremste Armut-Fall —
        // er erhaelt nach dem Tausch Truempfe vom Partner. Ohne diesen Test koennte
        // ein ">0"-Check die 0-Truempfe-Situation faelschlich sperren.
        Hand hand = new Hand(List.of(kreuzAs1));
        assertTrue(VorbehaltAnsage.ARMUT.istZulaessig(hand, spielregeln),
            "Null Truempfe muss Armut als Vorbehalt zulassen (0 <= 3).");
    }

    // --- T2.2: Angebot ---

    @Test
    void legeArmutTrumpfkarten_ReduzierenHandDesArmutSpielers() {
        // Warum wichtig: Das Anbieten der Trumpfkarten muss die Hand des Armut-Spielers
        // genau um diese Karten reduzieren. Ohne diesen Test koennte ein Bug die Karten
        // "doppelt" behalten oder gar nicht entfernen — beide Faelle korrumpieren den Tausch.
        Spiel spiel = armutSpiel_VorAngebot();

        Spiel nachAngebot = spiel.legeArmutTrumpfkarten(SpielerPosition.WEST, List.of(karoBube1, karoBube2));

        assertFalse(nachAngebot.handVon(SpielerPosition.WEST).enthaelt(karoBube1),
            "Karo-Bube 1 muss nach dem Angebot von der Hand des Armut-Spielers verschwunden sein.");
        assertFalse(nachAngebot.handVon(SpielerPosition.WEST).enthaelt(karoBube2),
            "Karo-Bube 2 muss nach dem Angebot von der Hand des Armut-Spielers verschwunden sein.");
        assertEquals(10, nachAngebot.handVon(SpielerPosition.WEST).karten().size(),
            "Die Hand des Armut-Spielers muss nach dem Angebot genau 10 Karten haben (12 - 2 Truempfe).");
        assertTrue(nachAngebot.armutStatus().orElseThrow().angebotLiegtVor(),
            "Nach dem Anbieten der Trumpfkarten muss der ArmutStatus das Angebot als abgegeben markieren.");
    }

    // --- T2.3: Annahme ---

    @Test
    void nimmArmutAn_TauschIstBidirektionalKorrekt_UndParteienGesetzt() {
        // Warum wichtig: Der Kartentausch muss bidirektional sein — Partner bekommt
        // die angebotenen Truempfe, Armut-Spieler bekommt die Rueckgabekarten.
        // Zusaetzlich muss der annehmende Spieler als zweiter RE-Partner eingetragen werden.
        // Ohne diesen Test koennte ein einseitiger Tausch den Gesamtkartenbestand veraendern
        // oder die Parteiverteilung (RE/KONTRA) falsch setzen.
        Spiel nachAngebot = armutSpiel_VorAngebot()
            .legeArmutTrumpfkarten(SpielerPosition.WEST, List.of(karoBube1, karoBube2));

        // NORD gibt seine ersten 2 Karten zurueck (PIK_ZEHN 1+2, beides Non-Trumpf)
        List<Karte> rueckgabekarten = List.of(
            new Karte(Farbe.PIK, Kartenwert.ZEHN, 1),
            new Karte(Farbe.PIK, Kartenwert.ZEHN, 2));
        Spiel nachAnnahme = nachAngebot.nimmArmutAn(SpielerPosition.NORD, rueckgabekarten);

        // Phase muss STICHPHASE sein
        assertInstanceOf(Spielphase.Stichphase.class, nachAnnahme.phase(),
            "Nach der Annahme muss das Spiel in die Stichphase wechseln.");

        // NORD hat die Trumpfkarten erhalten
        assertTrue(nachAnnahme.handVon(SpielerPosition.NORD).enthaelt(karoBube1),
            "Karo-Bube 1 muss nach der Annahme auf NORDs Hand liegen.");
        assertTrue(nachAnnahme.handVon(SpielerPosition.NORD).enthaelt(karoBube2),
            "Karo-Bube 2 muss nach der Annahme auf NORDs Hand liegen.");

        // WEST hat die Rueckgabekarten erhalten
        assertTrue(nachAnnahme.handVon(SpielerPosition.WEST).enthaelt(rueckgabekarten.get(0)),
            "Erste Rueckgabekarte muss nach dem Tausch auf WESTs Hand liegen.");
        assertTrue(nachAnnahme.handVon(SpielerPosition.WEST).enthaelt(rueckgabekarten.get(1)),
            "Zweite Rueckgabekarte muss nach dem Tausch auf WESTs Hand liegen.");

        // NORD ist jetzt RE-Partner
        assertEquals(Partei.RE, nachAnnahme.parteien().parteiVon(SpielerPosition.NORD),
            "Der annehmende Spieler NORD muss als RE-Partei eingetragen sein.");
        assertEquals(Partei.RE, nachAnnahme.parteien().parteiVon(SpielerPosition.WEST),
            "Der Armut-Spieler WEST bleibt RE.");
    }

    // --- T2.4: Ablehnung → Einwurf ---

    @Test
    void lehneArmutAb_AllerSpieler_FuehrtZuEinwurf() {
        // Warum wichtig: Lehnen alle drei potentiellen Partner ab, wird das Spiel
        // neu eingeworfen (neue Karten, neue Vorbehalt-Runde). Ohne diesen Test
        // koennte der Einwurf ausbleiben und das Spiel in einem inkonsistenten Zustand
        // haengen bleiben, in dem niemand mehr einen Zug machen kann.
        Spiel nachAngebot = armutSpiel_VorAngebot()
            .legeArmutTrumpfkarten(SpielerPosition.WEST, List.of(karoBube1, karoBube2));

        Spiel nachAllenAblehnungen = nachAngebot
            .lehneArmutAb(SpielerPosition.NORD)
            .lehneArmutAb(SpielerPosition.OST)
            .lehneArmutAb(SpielerPosition.SUED);

        assertEquals(Spielphase.VORBEHALT_ANSAGE, nachAllenAblehnungen.phase(),
            "Nach Ablehnung aller Spieler muss das Spiel neu eingeworfen werden (VORBEHALT_ANSAGE).");
        assertTrue(nachAllenAblehnungen.armutStatus().isEmpty(),
            "Nach dem Einwurf darf kein ArmutStatus mehr aktiv sein.");
    }

    // --- Hilfsmethoden ---

    /**
     * Erstellt ein Armut-Spiel in Phase ARMUT_TAUSCH. WEST ist der Armut-Spieler
     * mit genau 2 Trumpfkarten (Karo-Buben). Das Angebot wurde noch nicht abgegeben.
     */
    private Spiel armutSpiel_VorAngebot() {
        Map<SpielerPosition, Hand> haende = new EnumMap<>(SpielerPosition.class);

        // WEST: 2 Karo-Buben (Trumpf) + 10 Nicht-Trumpf-Karten
        haende.put(SpielerPosition.WEST, new Hand(List.of(
            karoBube1, karoBube2,
            kreuzAs1, kreuzAs2, kreuzZehn1, kreuzZehn2,
            kreuzKoen1, kreuzKoen2, kreuzNeun1, kreuzNeun2,
            pikAs1, pikAs2
        )));

        // NORD: 12 Nicht-Trumpf-Karten (PIK ohne Dame/Bube, HERZ ohne Dame/Bube/Zehn)
        haende.put(SpielerPosition.NORD, new Hand(List.of(
            new Karte(Farbe.PIK,  Kartenwert.ZEHN,   1),
            new Karte(Farbe.PIK,  Kartenwert.ZEHN,   2),
            new Karte(Farbe.PIK,  Kartenwert.KOENIG, 1),
            new Karte(Farbe.PIK,  Kartenwert.KOENIG, 2),
            new Karte(Farbe.PIK,  Kartenwert.NEUN,   1),
            new Karte(Farbe.PIK,  Kartenwert.NEUN,   2),
            new Karte(Farbe.HERZ, Kartenwert.AS,     1),
            new Karte(Farbe.HERZ, Kartenwert.AS,     2),
            new Karte(Farbe.HERZ, Kartenwert.KOENIG, 1),
            new Karte(Farbe.HERZ, Kartenwert.KOENIG, 2),
            new Karte(Farbe.HERZ, Kartenwert.NEUN,   1),
            new Karte(Farbe.HERZ, Kartenwert.NEUN,   2)
        )));

        // OST: 12 Trumpf-Karten
        haende.put(SpielerPosition.OST, new Hand(List.of(
            new Karte(Farbe.KREUZ, Kartenwert.DAME,  1),
            new Karte(Farbe.KREUZ, Kartenwert.DAME,  2),
            new Karte(Farbe.PIK,   Kartenwert.DAME,  1),
            new Karte(Farbe.PIK,   Kartenwert.DAME,  2),
            new Karte(Farbe.HERZ,  Kartenwert.DAME,  1),
            new Karte(Farbe.HERZ,  Kartenwert.DAME,  2),
            new Karte(Farbe.KARO,  Kartenwert.DAME,  1),
            new Karte(Farbe.KARO,  Kartenwert.DAME,  2),
            new Karte(Farbe.KREUZ, Kartenwert.BUBE,  1),
            new Karte(Farbe.KREUZ, Kartenwert.BUBE,  2),
            new Karte(Farbe.PIK,   Kartenwert.BUBE,  1),
            new Karte(Farbe.PIK,   Kartenwert.BUBE,  2)
        )));

        // SUED: 12 Trumpf-Karten
        haende.put(SpielerPosition.SUED, new Hand(List.of(
            new Karte(Farbe.HERZ, Kartenwert.BUBE,   1),
            new Karte(Farbe.HERZ, Kartenwert.BUBE,   2),
            new Karte(Farbe.KARO, Kartenwert.AS,     1),
            new Karte(Farbe.KARO, Kartenwert.AS,     2),
            new Karte(Farbe.KARO, Kartenwert.ZEHN,   1),
            new Karte(Farbe.KARO, Kartenwert.ZEHN,   2),
            new Karte(Farbe.KARO, Kartenwert.KOENIG, 1),
            new Karte(Farbe.KARO, Kartenwert.KOENIG, 2),
            new Karte(Farbe.KARO, Kartenwert.NEUN,   1),
            new Karte(Farbe.KARO, Kartenwert.NEUN,   2),
            new Karte(Farbe.HERZ, Kartenwert.ZEHN,   1),
            new Karte(Farbe.HERZ, Kartenwert.ZEHN,   2)
        )));

        return Spiel.ausPersistiertemStand(
            spielregeln,
            Kartendeck.neu(spielregeln),
            Spieltyp.ARMUT,
            SpielerPosition.SUED,
            new Spielphase.ArmutTausch(ArmutStatus.gestartet(SpielerPosition.WEST)),
            haende,
            List.of(),
            Parteien.ausArmut(SpielerPosition.WEST),
            Ansagen.leer(),
            List.of(),
            null,
            false,
            null
        );
    }
}
