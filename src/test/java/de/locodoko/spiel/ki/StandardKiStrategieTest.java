package de.locodoko.spiel.ki;

import de.locodoko.spiel.karten.Farbe;
import de.locodoko.spiel.karten.Hand;
import de.locodoko.spiel.karten.Karte;
import de.locodoko.spiel.karten.Kartenwert;
import de.locodoko.spiel.karten.NormaleTrumpfOrdnung;
import de.locodoko.spiel.karten.SpielerPosition;
import de.locodoko.spiel.karten.Spielregeln;
import de.locodoko.spiel.karten.Spieltyp;
import de.locodoko.spiel.karten.Stich;
import de.locodoko.spiel.partie.Ansage;
import de.locodoko.spiel.partie.Ansagen;
import de.locodoko.spiel.partie.Partei;
import de.locodoko.spiel.partie.Parteien;
import de.locodoko.spiel.partie.Spielphase;
import de.locodoko.spiel.partie.VorbehaltAnsage;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertIterableEquals;

class StandardKiStrategieTest {

    private final Spielregeln spielregeln = Spielregeln.standardRegeln();
    private final NormaleTrumpfOrdnung trumpfOrdnung = new NormaleTrumpfOrdnung(spielregeln);
    private final StandardKiStrategie strategie = new StandardKiStrategie();

    @Test
    void meldetTrumpfsoloBeiSehrStarkerTrumpfhandAn() {
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
            List.of(),
            List.of(),
            List.of(VorbehaltAnsage.GESUND, VorbehaltAnsage.SOLO_TRUMPF)
        );

        assertEquals(VorbehaltAnsage.SOLO_TRUMPF, strategie.waehleVorbehalt(zustand),
            "Eine klar ueberdurchschnittliche Trumpfhand soll von der KI als Trumpfsolo erkannt werden, damit der Einzelspielermodus nicht auf stumpfes Gesund-Melden verfaellt.");
    }

    @Test
    void bietetBeiArmutExaktAlleTruepfeAn() {
        KiSpielzustand zustand = new KiSpielzustand(
            SpielerPosition.WEST,
            Spieltyp.ARMUT,
            Spielphase.ARMUT_TAUSCH,
            spielregeln,
            trumpfOrdnung,
            new Hand(List.of(
                karte(Farbe.KREUZ, Kartenwert.DAME, 1),
                karte(Farbe.KARO, Kartenwert.AS, 1),
                karte(Farbe.KARO, Kartenwert.NEUN, 1),
                karte(Farbe.KREUZ, Kartenwert.AS, 1),
                karte(Farbe.PIK, Kartenwert.AS, 1)
            )),
            Parteien.ausArmut(SpielerPosition.WEST),
            Ansagen.leer(),
            List.of(),
            null,
            null,
            List.of(),
            List.of(),
            List.of()
        );

        assertIterableEquals(List.of(
            karte(Farbe.KARO, Kartenwert.NEUN, 1),
            karte(Farbe.KARO, Kartenwert.AS, 1),
            karte(Farbe.KREUZ, Kartenwert.DAME, 1)
        ), strategie.waehleArmutAngebot(zustand),
            "Die KI muss in der Armut genau alle eigenen Truempfe anbieten, damit der serverseitige Tauschfluss ohne manuelle Sonderbehandlung weiterlaufen kann.");
    }

    @Test
    void schmiertHoheAugenWennDerPartnerDenStichSichtbarHaelt() {
        Stich stich = Stich.neu(SpielerPosition.OST)
            .spieleKarte(SpielerPosition.OST, karte(Farbe.KREUZ, Kartenwert.KOENIG, 1), new Hand(List.of(karte(Farbe.KREUZ, Kartenwert.KOENIG, 1))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.SUED, karte(Farbe.KREUZ, Kartenwert.AS, 1), new Hand(List.of(karte(Farbe.KREUZ, Kartenwert.AS, 1))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.WEST, karte(Farbe.KREUZ, Kartenwert.AS, 2), new Hand(List.of(karte(Farbe.KREUZ, Kartenwert.AS, 2))), trumpfOrdnung);
        KiSpielzustand zustand = new KiSpielzustand(
            SpielerPosition.NORD,
            Spieltyp.SOLO_TRUMPF,
            Spielphase.STICHPHASE,
            spielregeln,
            trumpfOrdnung,
            new Hand(List.of(
                karte(Farbe.KREUZ, Kartenwert.ZEHN, 1),
                karte(Farbe.KREUZ, Kartenwert.NEUN, 1)
            )),
            Parteien.ausSolo(SpielerPosition.OST),
            Ansagen.leer(),
            List.of(),
            stich,
            null,
            List.of(
                karte(Farbe.KREUZ, Kartenwert.ZEHN, 1),
                karte(Farbe.KREUZ, Kartenwert.NEUN, 1)
            ),
            List.of(),
            List.of()
        );

        assertEquals(karte(Farbe.KREUZ, Kartenwert.ZEHN, 1), strategie.waehleKarte(zustand),
            "Wenn ein sichtbarer Partner den Stich bereits sicher hat, soll die KI Augen schmieren statt blind die kleinste Karte wegzuwerfen.");
    }

    @Test
    void sagtReMitEinerSehrStarkenHandAn() {
        KiSpielzustand zustand = new KiSpielzustand(
            SpielerPosition.WEST,
            Spieltyp.NORMALSPIEL,
            Spielphase.STICHPHASE,
            spielregeln,
            trumpfOrdnung,
            new Hand(List.of(
                karte(Farbe.HERZ, Kartenwert.ZEHN, 1),
                karte(Farbe.HERZ, Kartenwert.ZEHN, 2),
                karte(Farbe.KREUZ, Kartenwert.DAME, 1),
                karte(Farbe.KREUZ, Kartenwert.BUBE, 1),
                karte(Farbe.KARO, Kartenwert.AS, 1),
                karte(Farbe.KARO, Kartenwert.ZEHN, 1),
                karte(Farbe.KREUZ, Kartenwert.AS, 1),
                karte(Farbe.PIK, Kartenwert.AS, 1)
            )),
            Parteien.ausSolo(SpielerPosition.WEST),
            Ansagen.leer(),
            List.of(),
            Stich.neu(SpielerPosition.WEST),
            null,
            List.of(
                karte(Farbe.HERZ, Kartenwert.ZEHN, 1),
                karte(Farbe.HERZ, Kartenwert.ZEHN, 2)
            ),
            List.of(Ansage.RE),
            List.of()
        );

        assertEquals(Ansage.RE, strategie.waehleAnsage(zustand).orElseThrow(),
            "Die KI soll mit einer sehr starken Hand eine Grundansage taetigen, damit Einzelspieler-Partien nicht ohne nachvollziehbare Ansageentscheidungen bleiben.");
    }

    private Karte karte(Farbe farbe, Kartenwert wert, int exemplarIndex) {
        return new Karte(farbe, wert, exemplarIndex);
    }
}
