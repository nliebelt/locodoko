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
import de.locodoko.partie.ArmutStatus;
import de.locodoko.partie.HochzeitStatus;
import de.locodoko.partie.Partei;
import de.locodoko.partie.Parteien;
import de.locodoko.partie.Spielphase;
import de.locodoko.partie.VorbehaltAnsage;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertIterableEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

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

    @Test
    void hochzeitSpielerSpieltStaerkstenTrumpfAlsAnspielKarteBeimPartnerSuchen() {
        // Der Hochzeit-Spieler (WEST) sucht noch einen Partner — kein Klärungsstich bisher.
        // Er soll den stärksten Trumpf ausspielen, um den Klärungsstich sicher zu gewinnen
        // und die Partnerfindung aktiv zu steuern.
        // Ohne diesen Test könnte die KI schwache Trümpfe spielen und die Klärung dem Zufall überlassen.
        HochzeitStatus hochzeitStatus = HochzeitStatus.gestartet(SpielerPosition.WEST);
        Karte kreuzDame = karte(Farbe.KREUZ, Kartenwert.DAME, 1);
        Karte karoNeun = karte(Farbe.KARO, Kartenwert.NEUN, 1);
        KiSpielzustand zustand = new KiSpielzustand(
            SpielerPosition.WEST,
            Spieltyp.HOCHZEIT,
            Spielphase.STICHPHASE,
            spielregeln,
            trumpfOrdnung,
            new Hand(List.of(kreuzDame, karoNeun)),
            Parteien.ausHochzeit(SpielerPosition.WEST),
            Ansagen.leer(),
            List.of(),
            null,
            null,
            hochzeitStatus,
            List.of(kreuzDame, karoNeun),
            List.of(),
            List.of()
        );

        Karte gewaehlteKarte = strategie.waehleKarte(zustand);
        assertEquals(kreuzDame, gewaehlteKarte,
            "Der Hochzeit-Spieler beim Anspiel soll den staerksten Trumpf spielen, um Klaerungsstiche aktiv zu gewinnen und die Partnerfindung zu steuern.");
    }

    @Test
    void nichtHochzeitSpielerVersuchtKlaerungsStichZuGewinnenUmPartnerZuWerden() {
        // NORD ist NICHT der Hochzeit-Spieler (Hochzeit liegt bei WEST).
        // WEST führt gerade den Stich — NORD soll versuchen, den Stich zu übernehmen,
        // um Re-Partner zu werden.
        // Ohne diesen Test würde die KI ggf. passiv abwerfen statt die Partnerrolle zu übernehmen.
        HochzeitStatus hochzeitStatus = HochzeitStatus.gestartet(SpielerPosition.WEST);
        Karte westKreuzDame = karte(Farbe.KREUZ, Kartenwert.DAME, 1);
        Stich stich = Stich.neu(SpielerPosition.WEST)
            .spieleKarte(SpielerPosition.WEST, westKreuzDame, new Hand(List.of(westKreuzDame)), trumpfOrdnung);
        // NORD hat eine Herz-10 (höchste Karte im Normalspiel) und eine Karo-9 (schwächer)
        Karte herzZehn = karte(Farbe.HERZ, Kartenwert.ZEHN, 1);
        Karte karoNeun = karte(Farbe.KARO, Kartenwert.NEUN, 1);
        KiSpielzustand zustand = new KiSpielzustand(
            SpielerPosition.NORD,
            Spieltyp.HOCHZEIT,
            Spielphase.STICHPHASE,
            spielregeln,
            trumpfOrdnung,
            new Hand(List.of(herzZehn, karoNeun)),
            Parteien.ausHochzeit(SpielerPosition.WEST),
            Ansagen.leer(),
            List.of(),
            stich,
            null,
            hochzeitStatus,
            List.of(herzZehn, karoNeun),
            List.of(),
            List.of()
        );

        Karte gewaehlteKarte = strategie.waehleKarte(zustand);
        assertEquals(herzZehn, gewaehlteKarte,
            "Ein Nicht-Hochzeit-Spieler soll den Klaerungsstich gewinnen wollen, wenn der Hochzeit-Spieler fuehrt, um die Re-Partnerrolle zu uebernehmen.");
    }

    @Test
    void nimmt_Armut_an_und_gibt_Fehlkarten_zurueck_nicht_eigene_Truempfe() {
        // KI hat nur 2 Trümpfe → nimmt an (Bedingung eigeneTruepfe > 5 nicht erfüllt).
        // Fehlkarten haben abwurfKosten = augen + fehlRang (max ~17 für ein As).
        // Trümpfe haben abwurfKosten = augen + 30 + trumpfRang (min 31 für Karo-Neun).
        // Der +30-Offset sichert, dass JEDE Fehlkarte günstiger zurückzugeben ist als JEDER Trumpf —
        // daher gibt die KI korrekt ihre Fehlkarten zurück und behält die Trümpfe für die Re-Partei.
        Karte kreuzDame = karte(Farbe.KREUZ, Kartenwert.DAME, 1);   // Trumpf, abwurfKosten = 3+30+12 = 45
        Karte herzZehn  = karte(Farbe.HERZ,  Kartenwert.ZEHN,  1);  // Dulle,  abwurfKosten = 10+30+13 = 53
        Karte kreuzNeun = karte(Farbe.KREUZ, Kartenwert.NEUN,  1);  // Fehlkarte, abwurfKosten = 0+1 = 1
        Karte pikKoenig = karte(Farbe.PIK,   Kartenwert.KOENIG, 1); // Fehlkarte, abwurfKosten = 4+4 = 8

        ArmutStatus armutStatus = ArmutStatus.gestartet(SpielerPosition.SUED)
            .mitAngebot(List.of(
                karte(Farbe.KARO, Kartenwert.NEUN,   1),  // angebotWert += 8+1 = 9
                karte(Farbe.KARO, Kartenwert.KOENIG, 1)   // angebotWert += 8+2 = 10 → gesamt 19 < 55
            ));

        KiSpielzustand zustand = new KiSpielzustand(
            SpielerPosition.WEST, Spieltyp.ARMUT, Spielphase.ARMUT_TAUSCH,
            spielregeln, trumpfOrdnung,
            new Hand(List.of(kreuzDame, herzZehn, kreuzNeun, pikKoenig)),
            null, Ansagen.leer(), List.of(), null, armutStatus, null,
            List.of(), List.of(), List.of()
        );

        KiArmutAntwort antwort = strategie.waehleArmutAntwort(zustand);

        assertTrue(antwort.angenommen(),
            "KI soll bei ≤5 eigenen Trümpfen die Armut annehmen, um Re-Partner zu werden.");
        assertIterableEquals(List.of(kreuzNeun, pikKoenig), antwort.rueckgabekarten(),
            "KI soll Fehlkarten zurückgeben, nicht eigene Trümpfe — der +30-Offset in abwurfKosten() " +
            "garantiert, dass jeder Trumpf teurer ist als jede Fehlkarte, unabhängig vom Augenwert.");
    }

    @Test
    void lehnt_Armut_ab_bei_starker_Hand_und_schwachem_Angebot() {
        // Ablehnen wenn eigeneTruepfe > 5 UND angebotWert < 55.
        // 6 Trumpfkarten > 5, ein Karo-Neun-Angebot ergibt Wert 9 < 55 → ablehnen.
        // Dieser Test schützt vor einer Regression, bei der die KI trotz eigener Trumpfstärke
        // eine nutzlose Armut annimmt und ihren Trumpfvorteil weggibt.
        ArmutStatus armutStatus = ArmutStatus.gestartet(SpielerPosition.SUED)
            .mitAngebot(List.of(karte(Farbe.KARO, Kartenwert.NEUN, 1)));  // angebotWert = 9

        KiSpielzustand zustand = new KiSpielzustand(
            SpielerPosition.WEST, Spieltyp.ARMUT, Spielphase.ARMUT_TAUSCH,
            spielregeln, trumpfOrdnung,
            new Hand(List.of(
                karte(Farbe.KARO, Kartenwert.NEUN,   1),
                karte(Farbe.KARO, Kartenwert.NEUN,   2),
                karte(Farbe.KARO, Kartenwert.KOENIG, 1),
                karte(Farbe.KARO, Kartenwert.KOENIG, 2),
                karte(Farbe.KARO, Kartenwert.ZEHN,   1),
                karte(Farbe.KARO, Kartenwert.ZEHN,   2),  // 6 Trümpfe → eigeneTruepfe > 5
                karte(Farbe.PIK,  Kartenwert.AS,     1)
            )),
            null, Ansagen.leer(), List.of(), null, armutStatus, null,
            List.of(), List.of(), List.of()
        );

        KiArmutAntwort antwort = strategie.waehleArmutAntwort(zustand);

        assertFalse(antwort.angenommen(),
            "KI soll bei eigener Trumpfstärke (>5 Trümpfe) und schwachem Angebot (<55 Punkte) ablehnen.");
    }

    @Test
    void lehnt_Armut_ab_wenn_kein_Angebot_vorliegt() {
        // Schutz gegen vorzeitigen Aufruf — vor dem Einwurf liegt kein Angebot vor.
        KiSpielzustand zustand = new KiSpielzustand(
            SpielerPosition.WEST, Spieltyp.ARMUT, Spielphase.ARMUT_TAUSCH,
            spielregeln, trumpfOrdnung,
            new Hand(List.of(karte(Farbe.KREUZ, Kartenwert.DAME, 1))),
            null, Ansagen.leer(), List.of(), null,
            ArmutStatus.gestartet(SpielerPosition.SUED),  // angebotAbgegeben = false
            null, List.of(), List.of(), List.of()
        );

        assertEquals(KiArmutAntwort.ablehnen(), strategie.waehleArmutAntwort(zustand),
            "KI soll ablehnen solange kein Angebot vorliegt — Guards gegen illegale Aufrufreihenfolge.");
    }

    private Karte karte(Farbe farbe, Kartenwert wert, int exemplarIndex) {
        return new Karte(farbe, wert, exemplarIndex);
    }
}
