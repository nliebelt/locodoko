package de.locodoko.partie;

import de.locodoko.karten.Farbe;
import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartendeck;
import de.locodoko.karten.Kartenwert;
import de.locodoko.karten.Spielregeln;
import de.locodoko.karten.Spieltyp;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SpielTest {

    private final Spielregeln spielregeln = Spielregeln.standardRegeln();

    @Test
    void loestTrumpfsoloMitSitzreihenfolgeAufUndOffenbartParteienVonBeginnAn() {
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, spielregeln, kartendeckMitKontrolliertenHaenden());
        spiel.teileKartenAus();
        spiel.meldeGesund(SpielerPosition.WEST);
        spiel.meldeVorbehalt(SpielerPosition.NORD, VorbehaltAnsage.SOLO_TRUMPF);
        spiel.meldeVorbehalt(SpielerPosition.OST, VorbehaltAnsage.SOLO_TRUMPF);
        spiel.meldeGesund(SpielerPosition.SUED);
        spiel.loeseVorbehalteAuf();

        assertEquals(Spieltyp.SOLO_TRUMPF, spiel.spieltyp(),
            "Das hoechste Solo muss in der Vorbehaltsaufloesung wirksam werden, damit Sonderspiele regelkonform vor dem ersten Stich starten.");
        assertEquals(Partei.RE, spiel.parteien().parteiVon(SpielerPosition.NORD));
        assertEquals(List.of(SpielerPosition.NORD), spiel.parteien().spielerVon(Partei.RE),
            "Im Trumpfsolo spielt genau ein Spieler alleine gegen drei Gegner; diese Parteibildung ist die Grundlage fuer Wertung und Ansagen.");
        assertTrue(spiel.parteien().sichtAufPartei(SpielerPosition.WEST, SpielerPosition.NORD).isPresent(),
            "Die Solo-Parteien muessen von Beginn an offen sein, damit UI und Ansagelogik ohne verdeckte Information arbeiten koennen.");
        assertEquals(SpielerPosition.WEST, spiel.aktuellerStich().orElseThrow().aufspieler(),
            "Auch im Solo beginnt weiterhin der Spieler links vom Geber den ersten Stich.");
    }

    @Test
    void loestDamensoloAufUndErzwingtFehlbedienungStattTrumpfAusweichen() {
        Karte ausgespieltesKaro = karte(Farbe.KARO, Kartenwert.KOENIG, 1);
        Karte karoZumBedienen = karte(Farbe.KARO, Kartenwert.AS, 1);
        Karte damenTrumpf = karte(Farbe.KREUZ, Kartenwert.DAME, 1);
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, spielregeln, kartendeckMitVerteiltenHaenden(Map.of(
                SpielerPosition.WEST, List.of(ausgespieltesKaro),
                SpielerPosition.NORD, List.of(karoZumBedienen, damenTrumpf)
            )));
        spiel.teileKartenAus();
        spiel.meldeVorbehalt(SpielerPosition.WEST, VorbehaltAnsage.SOLO_DAME);
        spiel.meldeGesund(SpielerPosition.NORD);
        spiel.meldeGesund(SpielerPosition.OST);
        spiel.meldeGesund(SpielerPosition.SUED);
        spiel.loeseVorbehalteAuf();
        spiel.spieleKarte(SpielerPosition.WEST, ausgespieltesKaro);

        assertEquals(Spieltyp.SOLO_DAME, spiel.spieltyp(),
            "Damensolo muss als eigener Spieltyp aufgeloest werden, damit Stichlogik und Parteibildung dasselbe Regelprofil sehen.");
        assertEquals(List.of(SpielerPosition.WEST), spiel.parteien().spielerVon(Partei.RE));
        assertEquals(List.of(karoZumBedienen), spiel.gueltigeKartenFuer(SpielerPosition.NORD),
            "Im Damensolo bleibt Karo eine Fehlfarbe; vorhandenes Karo muss deshalb bedient werden, auch wenn eine Dame als Trumpf bereitliegt.");
        assertTrue(spiel.parteien().sichtAufPartei(SpielerPosition.NORD, SpielerPosition.WEST).isPresent());
    }

    @Test
    void loestDamensoloAufUndBubeVerliert_WeilBubeFehlfarbe() {
        // Warum wichtig: Im Normalspiel wuerde Kreuz-Bube als Trump die Kreuz-As stechen.
        // Wird DamensoloTrumpfOrdnung faelschlich als Trump behandelt, gewinnt NORD statt WEST —
        // dieser Test sichert die Stich-Gewinner-Logik ab, nicht nur das istTrumpf-Flag.
        Karte kreuzAs    = karte(Farbe.KREUZ, Kartenwert.AS,     1);
        Karte kreuzBube  = karte(Farbe.KREUZ, Kartenwert.BUBE,   1);
        Karte kreuzKoenig = karte(Farbe.KREUZ, Kartenwert.KOENIG, 1);
        Karte kreuzNeun  = karte(Farbe.KREUZ, Kartenwert.NEUN,   1);
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, spielregeln, kartendeckMitVerteiltenHaenden(Map.of(
                SpielerPosition.WEST, List.of(kreuzAs),
                SpielerPosition.NORD, List.of(kreuzBube),
                SpielerPosition.OST,  List.of(kreuzKoenig),
                SpielerPosition.SUED, List.of(kreuzNeun)
            )));
        spiel.teileKartenAus();
        spiel.meldeVorbehalt(SpielerPosition.WEST, VorbehaltAnsage.SOLO_DAME);
        spiel.meldeGesund(SpielerPosition.NORD);
        spiel.meldeGesund(SpielerPosition.OST);
        spiel.meldeGesund(SpielerPosition.SUED);
        spiel.loeseVorbehalteAuf();

        spieleStich(spiel, kreuzAs, kreuzBube, kreuzKoenig, kreuzNeun);

        assertEquals(SpielerPosition.WEST, spiel.abgeschlosseneStiche().getFirst().gewinner(spiel.trumpfOrdnung()).spieler(),
            "Im Damensolo ist Kreuz-Bube Fehlfarbe Kreuz (fehlRang 2), kein Trump; Kreuz-As (fehlRang 6) muss den Stich gewinnen, nicht der Bube.");
    }

    @Test
    void loestBubensoloAufUndDameVerliert_WeilDameFehlfarbe() {
        // Warum wichtig: Im Normalspiel wuerde Herz-Dame als Trump die Herz-As stechen.
        // Wird BubensoloTrumpfOrdnung faelschlich als Trump behandelt, gewinnt NORD statt WEST —
        // dieser Test sichert die Stich-Gewinner-Logik fuer Bubensolo ab.
        Karte herzAs    = karte(Farbe.HERZ, Kartenwert.AS,     1);
        Karte herzDame  = karte(Farbe.HERZ, Kartenwert.DAME,   1);
        Karte herzKoenig = karte(Farbe.HERZ, Kartenwert.KOENIG, 1);
        Karte herzNeun  = karte(Farbe.HERZ, Kartenwert.NEUN,   1);
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, spielregeln, kartendeckMitVerteiltenHaenden(Map.of(
                SpielerPosition.WEST, List.of(herzAs),
                SpielerPosition.NORD, List.of(herzDame),
                SpielerPosition.OST,  List.of(herzKoenig),
                SpielerPosition.SUED, List.of(herzNeun)
            )));
        spiel.teileKartenAus();
        spiel.meldeVorbehalt(SpielerPosition.WEST, VorbehaltAnsage.SOLO_BUBE);
        spiel.meldeGesund(SpielerPosition.NORD);
        spiel.meldeGesund(SpielerPosition.OST);
        spiel.meldeGesund(SpielerPosition.SUED);
        spiel.loeseVorbehalteAuf();

        spieleStich(spiel, herzAs, herzDame, herzKoenig, herzNeun);

        assertEquals(SpielerPosition.WEST, spiel.abgeschlosseneStiche().getFirst().gewinner(spiel.trumpfOrdnung()).spieler(),
            "Im Bubensolo ist Herz-Dame Fehlfarbe Herz (fehlRang 3), kein Trump; Herz-As (fehlRang 6) muss den Stich gewinnen, nicht die Dame.");
    }

    @Test
    void entscheidetBeiVerschiedenenSoloTypenNachSitzreihenfolge() {
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, spielregeln, kartendeckMitKontrolliertenHaenden());
        spiel.teileKartenAus();
        spiel.meldeVorbehalt(SpielerPosition.WEST, VorbehaltAnsage.SOLO_BUBE);
        spiel.meldeVorbehalt(SpielerPosition.NORD, VorbehaltAnsage.SOLO_DAME);
        spiel.meldeVorbehalt(SpielerPosition.OST, VorbehaltAnsage.SOLO_FLEISCHLOS);
        spiel.meldeGesund(SpielerPosition.SUED);
        spiel.loeseVorbehalteAuf();

        assertEquals(Spieltyp.SOLO_BUBE, spiel.spieltyp(),
            "Zwischen verschiedenen Soli gibt es keine Zusatzrangfolge; bei gleicher Prioritaet muss die fruehere Sitzposition gewinnen.");
        assertEquals(List.of(SpielerPosition.WEST), spiel.parteien().spielerVon(Partei.RE));
    }

    @Test
    void loestFleischlosAufUndLaesstAbwerfenNichtStechen() {
        Karte ersterHerzstich = karte(Farbe.HERZ, Kartenwert.KOENIG, 1);
        Karte hoehereHerzkarte = karte(Farbe.HERZ, Kartenwert.AS, 1);
        Karte karoAbwurf = karte(Farbe.KARO, Kartenwert.AS, 1);
        Karte kreuzAbwurf = karte(Farbe.KREUZ, Kartenwert.AS, 1);
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, spielregeln, kartendeckMitVerteiltenHaenden(Map.of(
                SpielerPosition.WEST, List.of(ersterHerzstich),
                SpielerPosition.NORD, List.of(hoehereHerzkarte),
                SpielerPosition.OST, List.of(karoAbwurf),
                SpielerPosition.SUED, List.of(kreuzAbwurf)
            )));
        spiel.teileKartenAus();
        spiel.meldeVorbehalt(SpielerPosition.WEST, VorbehaltAnsage.SOLO_FLEISCHLOS);
        spiel.meldeGesund(SpielerPosition.NORD);
        spiel.meldeGesund(SpielerPosition.OST);
        spiel.meldeGesund(SpielerPosition.SUED);
        spiel.loeseVorbehalteAuf();

        spieleStich(spiel, ersterHerzstich, hoehereHerzkarte, karoAbwurf, kreuzAbwurf);

        assertEquals(Spieltyp.SOLO_FLEISCHLOS, spiel.spieltyp(),
            "Fleischlos braucht einen eigenen Spieltyp, damit die Stichlogik vollstaendig ohne Trumpf arbeitet.");
        assertEquals(SpielerPosition.NORD, spiel.abgeschlosseneStiche().getFirst().gewinner(spiel.trumpfOrdnung()).spieler(),
            "Im Fleischlos darf ein Abwurf niemals stechen; der Stich bleibt immer bei der hoechsten Karte der angefragten Farbe.");
        assertEquals(SpielerPosition.NORD, spiel.aktuellerStich().orElseThrow().aufspieler());
    }

    @Test
    void loestHochzeitAufUndStartetMitOffenemHochzeitsSpieler() {
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, spielregeln, kartendeckMitVerteiltenHaenden(Map.of(
                SpielerPosition.WEST, List.of(
                    karte(Farbe.KREUZ, Kartenwert.DAME, 1),
                    karte(Farbe.KREUZ, Kartenwert.DAME, 2)
                )
            )));
        spiel.teileKartenAus();
        spiel.meldeVorbehalt(SpielerPosition.WEST, VorbehaltAnsage.HOCHZEIT);
        spiel.meldeGesund(SpielerPosition.NORD);
        spiel.meldeGesund(SpielerPosition.OST);
        spiel.meldeGesund(SpielerPosition.SUED);
        spiel.loeseVorbehalteAuf();

        assertEquals(Spieltyp.HOCHZEIT, spiel.spieltyp(),
            "Die Hochzeit muss als eigener Spieltyp aufloesbar sein, damit Vorbehalt-Phase und Stichphase denselben Fachzustand sehen.");
        assertEquals(List.of(SpielerPosition.WEST), spiel.parteien().spielerVon(Partei.RE),
            "Zu Beginn der Hochzeit spielt der Melder allein, bis ein fremder Stichgewinner als Partner feststeht.");
        assertTrue(spiel.parteien().sichtAufPartei(SpielerPosition.NORD, SpielerPosition.WEST).isPresent(),
            "Die Hochzeit ist ein offener Vorbehalt; der Hochzeits-Spieler muss daher fuer alle sichtbar sein.");
        assertTrue(spiel.parteien().sichtAufPartei(SpielerPosition.NORD, SpielerPosition.OST).isEmpty(),
            "Die uebrigen Parteien bleiben bis zur Klaerung verdeckt, damit die Partnersuche fachlich korrekt startet.");
        assertTrue(spiel.hochzeitStatus().orElseThrow().suchtPartner());
    }

    @Test
    void findetBeimErstenFremdenStichDenPartnerUndOffenbartDanachAlleParteien() {
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, spielregeln, kartendeckMitVerteiltenHaenden(Map.of(
                SpielerPosition.WEST, List.of(
                    karte(Farbe.KREUZ, Kartenwert.DAME, 1),
                    karte(Farbe.KREUZ, Kartenwert.DAME, 2),
                    karte(Farbe.KREUZ, Kartenwert.KOENIG, 1)
                ),
                SpielerPosition.NORD, List.of(karte(Farbe.KREUZ, Kartenwert.AS, 1)),
                SpielerPosition.OST, List.of(karte(Farbe.KREUZ, Kartenwert.ZEHN, 1)),
                SpielerPosition.SUED, List.of(karte(Farbe.KREUZ, Kartenwert.NEUN, 1))
            )));
        spiel.teileKartenAus();
        spiel.meldeVorbehalt(SpielerPosition.WEST, VorbehaltAnsage.HOCHZEIT);
        spiel.meldeGesund(SpielerPosition.NORD);
        spiel.meldeGesund(SpielerPosition.OST);
        spiel.meldeGesund(SpielerPosition.SUED);
        spiel.loeseVorbehalteAuf();
        spiel.spieleKarte(SpielerPosition.WEST, karte(Farbe.KREUZ, Kartenwert.KOENIG, 1));
        spiel.spieleKarte(SpielerPosition.NORD, karte(Farbe.KREUZ, Kartenwert.AS, 1));
        spiel.spieleKarte(SpielerPosition.OST, karte(Farbe.KREUZ, Kartenwert.ZEHN, 1));
        spiel.spieleKarte(SpielerPosition.SUED, karte(Farbe.KREUZ, Kartenwert.NEUN, 1));

        assertEquals(List.of(SpielerPosition.WEST, SpielerPosition.NORD), spiel.parteien().spielerVon(Partei.RE),
            "Der erste fremde Stichgewinner muss sofort Partner werden, damit Augen und Sonderpunkte der richtigen Partei zufallen.");
        assertEquals(SpielerPosition.NORD, spiel.hochzeitStatus().orElseThrow().partner().orElseThrow());
        for (SpielerPosition beobachter : SpielerPosition.standardReihenfolge()) {
            for (SpielerPosition ziel : SpielerPosition.standardReihenfolge()) {
                assertTrue(spiel.parteien().sichtAufPartei(beobachter, ziel).isPresent(),
                    "Nach der Partnerfindung muessen alle Parteien offen liegen, damit keine verdeckte Restinformation zurueckbleibt.");
            }
        }
        assertEquals(SpielerPosition.NORD, spiel.aktuellerStich().orElseThrow().aufspieler());
    }

    @Test
    void wechseltNachDreiEigenenStichenInsStilleSoloUndOffenbartAlleParteien() {
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, spielregeln, kartendeckMitVerteiltenHaenden(Map.of(
                SpielerPosition.WEST, List.of(
                    karte(Farbe.KREUZ, Kartenwert.DAME, 1),
                    karte(Farbe.KREUZ, Kartenwert.DAME, 2),
                    karte(Farbe.KREUZ, Kartenwert.AS, 1),
                    karte(Farbe.PIK, Kartenwert.AS, 1)
                ),
                SpielerPosition.NORD, List.of(
                    karte(Farbe.KREUZ, Kartenwert.KOENIG, 1),
                    karte(Farbe.PIK, Kartenwert.KOENIG, 1),
                    karte(Farbe.KARO, Kartenwert.KOENIG, 1)
                ),
                SpielerPosition.OST, List.of(
                    karte(Farbe.KREUZ, Kartenwert.ZEHN, 1),
                    karte(Farbe.PIK, Kartenwert.ZEHN, 1),
                    karte(Farbe.KARO, Kartenwert.ZEHN, 1)
                ),
                SpielerPosition.SUED, List.of(
                    karte(Farbe.KREUZ, Kartenwert.NEUN, 1),
                    karte(Farbe.PIK, Kartenwert.NEUN, 1),
                    karte(Farbe.KARO, Kartenwert.NEUN, 1)
                )
            )));
        spiel.teileKartenAus();
        spiel.meldeVorbehalt(SpielerPosition.WEST, VorbehaltAnsage.HOCHZEIT);
        spiel.meldeGesund(SpielerPosition.NORD);
        spiel.meldeGesund(SpielerPosition.OST);
        spiel.meldeGesund(SpielerPosition.SUED);
        spiel.loeseVorbehalteAuf();

        spieleStich(spiel,
            karte(Farbe.KREUZ, Kartenwert.AS, 1),
            karte(Farbe.KREUZ, Kartenwert.KOENIG, 1),
            karte(Farbe.KREUZ, Kartenwert.ZEHN, 1),
            karte(Farbe.KREUZ, Kartenwert.NEUN, 1));
        spieleStich(spiel,
            karte(Farbe.PIK, Kartenwert.AS, 1),
            karte(Farbe.PIK, Kartenwert.KOENIG, 1),
            karte(Farbe.PIK, Kartenwert.ZEHN, 1),
            karte(Farbe.PIK, Kartenwert.NEUN, 1));
        spieleStich(spiel,
            karte(Farbe.KREUZ, Kartenwert.DAME, 1),
            karte(Farbe.KARO, Kartenwert.KOENIG, 1),
            karte(Farbe.KARO, Kartenwert.ZEHN, 1),
            karte(Farbe.KARO, Kartenwert.NEUN, 1));

        HochzeitStatus status = spiel.hochzeitStatus().orElseThrow();
        assertTrue(status.stillesSolo(),
            "Wenn drei Klaerungsstiche lang kein Partner gefunden wird, muss die Hochzeit in ein stilles Solo kippen.");
        assertEquals(List.of(SpielerPosition.WEST), spiel.parteien().spielerVon(Partei.RE));
        for (SpielerPosition ziel : SpielerPosition.standardReihenfolge()) {
            assertTrue(spiel.parteien().sichtAufPartei(SpielerPosition.NORD, ziel).isPresent(),
                "Nach dem stillen Solo muessen alle Parteien offen sein, weil die Partnerfrage endgueltig geklaert ist.");
        }
    }

    @Test
    void vollendetHochzeitAlsStillesSoloBisZurAuswertungMitKorrektemErgebnis() {
        // Warum wichtig: Der vorhandene Unit-Test prueft nur den Zustand nach den 3 Klaerungsstichen.
        // Dieser Integrationstest stellt sicher, dass nach dem Umschlag ins stille Solo
        // (1) die restlichen 9 Stiche regelkonform spielbar bleiben,
        // (2) AUSWERTUNG erreicht wird,
        // (3) WEST als einziger RE-Spieler im Ergebnis ausgewiesen ist und
        // (4) die 240-Augen-Invariante und die Nullsumme gelten —
        // diese Kausalitaetskette von stillesSolo-Trigger bis Endauswertung war bisher ungeprueft.
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, spielregeln, kartendeckMitVerteiltenHaenden(Map.of(
                SpielerPosition.WEST, List.of(
                    karte(Farbe.KREUZ, Kartenwert.DAME, 1),
                    karte(Farbe.KREUZ, Kartenwert.DAME, 2),
                    karte(Farbe.KREUZ, Kartenwert.AS, 1),
                    karte(Farbe.PIK, Kartenwert.AS, 1)
                ),
                SpielerPosition.NORD, List.of(
                    karte(Farbe.KREUZ, Kartenwert.KOENIG, 1),
                    karte(Farbe.PIK, Kartenwert.KOENIG, 1),
                    karte(Farbe.KARO, Kartenwert.KOENIG, 1)
                ),
                SpielerPosition.OST, List.of(
                    karte(Farbe.KREUZ, Kartenwert.ZEHN, 1),
                    karte(Farbe.PIK, Kartenwert.ZEHN, 1),
                    karte(Farbe.KARO, Kartenwert.ZEHN, 1)
                ),
                SpielerPosition.SUED, List.of(
                    karte(Farbe.KREUZ, Kartenwert.NEUN, 1),
                    karte(Farbe.PIK, Kartenwert.NEUN, 1),
                    karte(Farbe.KARO, Kartenwert.NEUN, 1)
                )
            )));
        spiel.teileKartenAus();
        spiel.meldeVorbehalt(SpielerPosition.WEST, VorbehaltAnsage.HOCHZEIT);
        spiel.meldeGesund(SpielerPosition.NORD);
        spiel.meldeGesund(SpielerPosition.OST);
        spiel.meldeGesund(SpielerPosition.SUED);
        spiel.loeseVorbehalteAuf();

        // Stich 1: WEST gewinnt mit Kreuz-AS (hoechste Kreuz-Fehlfarbe)
        spieleStich(spiel,
            karte(Farbe.KREUZ, Kartenwert.AS, 1),
            karte(Farbe.KREUZ, Kartenwert.KOENIG, 1),
            karte(Farbe.KREUZ, Kartenwert.ZEHN, 1),
            karte(Farbe.KREUZ, Kartenwert.NEUN, 1));
        // Stich 2: WEST gewinnt mit Pik-AS
        spieleStich(spiel,
            karte(Farbe.PIK, Kartenwert.AS, 1),
            karte(Farbe.PIK, Kartenwert.KOENIG, 1),
            karte(Farbe.PIK, Kartenwert.ZEHN, 1),
            karte(Farbe.PIK, Kartenwert.NEUN, 1));
        // Stich 3: WEST gewinnt mit Kreuz-DAME (Trump) — loest stilles Solo aus
        spieleStich(spiel,
            karte(Farbe.KREUZ, Kartenwert.DAME, 1),
            karte(Farbe.KARO, Kartenwert.KOENIG, 1),
            karte(Farbe.KARO, Kartenwert.ZEHN, 1),
            karte(Farbe.KARO, Kartenwert.NEUN, 1));

        assertTrue(spiel.hochzeitStatus().orElseThrow().stillesSolo(),
            "Stilles Solo muss nach 3 eigenen Klaerungsstichen aktiv sein, bevor das restliche Spiel korrekt ausgewertet werden kann.");
        assertEquals(List.of(SpielerPosition.WEST), spiel.parteien().spielerVon(Partei.RE),
            "Im stillen Solo spielt WEST als einziger RE-Spieler; Parteikonsistenz ist Voraussetzung fuer korrekte Auswertung.");
        assertInstanceOf(Spielphase.Stichphase.class, spiel.phase(),
            "Das Spiel muss trotz stillem Solo in der Stichphase bleiben, bis alle 12 Stiche gespielt sind.");

        // Restliche 9 Stiche automatisch zu Ende spielen
        while (spiel.phase() instanceof Spielphase.Stichphase) {
            SpielerPosition aktuellerSpieler = spiel.aktuellerSpieler().orElseThrow();
            Karte naechsteKarte = spiel.gueltigeKartenFuer(aktuellerSpieler).getFirst();
            spiel.spieleKarte(aktuellerSpieler, naechsteKarte);
        }

        assertEquals(12, spiel.abgeschlosseneStiche().size(),
            "Ein vollstaendiges Hochzeit-Stilles-Solo braucht dieselben 12 Stiche wie jedes andere Normalspiel.");
        assertEquals(Spielphase.AUSWERTUNG, spiel.phase(),
            "Nach 12 Stichen muss AUSWERTUNG erreicht sein, auch wenn stillesSolo mitten in der Stichphase getriggert wurde.");
        assertEquals(List.of(SpielerPosition.WEST), spiel.parteien().spielerVon(Partei.RE),
            "Die RE-Partei muss am Ende des stillen Solos unveraendert nur WEST enthalten, damit die Punkteberechnung korrekt arbeitet.");

        // Auswertung ausfuehren und Invarianten pruefen
        spiel.werteAus();

        assertEquals(Spielphase.GESAMTSTAND_AKTUALISIEREN, spiel.phase());
        Spielergebnis ergebnis = spiel.ergebnis().orElseThrow();
        assertEquals(240, ergebnis.augenVon(Partei.RE).wert() + ergebnis.augenVon(Partei.KONTRA).wert(),
            "Die 240-Augen-Invariante muss auch im stillen Solo gelten, weil immer alle Karten gespielt werden.");
        assertEquals(0,
            ergebnis.spielpunkteVon(SpielerPosition.WEST).wert()
                + ergebnis.spielpunkteVon(SpielerPosition.NORD).wert()
                + ergebnis.spielpunkteVon(SpielerPosition.OST).wert()
                + ergebnis.spielpunkteVon(SpielerPosition.SUED).wert(),
            "Die Nullsumme muss auch nach dem stillen Solo gelten, damit der Gesamtstand konsistent bleibt.");
    }

    @Test
    void lehntHochzeitOhneBeideKreuzDamenOderBeiDeaktivierterRegelAb() {
        Spiel spielMitNurEinerKreuzDame = Spiel.neu(SpielerPosition.SUED, spielregeln, kartendeckMitVerteiltenHaenden(Map.of(
                SpielerPosition.WEST, List.of(karte(Farbe.KREUZ, Kartenwert.DAME, 1))
            )));
        spielMitNurEinerKreuzDame.teileKartenAus();

        assertThrows(IllegalStateException.class,
            () -> spielMitNurEinerKreuzDame.meldeVorbehalt(SpielerPosition.WEST, VorbehaltAnsage.HOCHZEIT),
            "Nur beide Kreuz-Damen rechtfertigen die Hochzeit; sonst wuerde ein normales Re/Kontra-Spiel faelschlich umetikettiert.");

        Spielregeln hochzeitDeaktiviert = spielregeln.mitHochzeitAktiv(false);
        Spiel deaktiviertesSpiel = Spiel.neu(SpielerPosition.SUED, hochzeitDeaktiviert, kartendeckMitVerteiltenHaenden(Map.of(
                SpielerPosition.WEST, List.of(
                    karte(Farbe.KREUZ, Kartenwert.DAME, 1),
                    karte(Farbe.KREUZ, Kartenwert.DAME, 2)
                )
            )));
        deaktiviertesSpiel.teileKartenAus();

        assertThrows(IllegalStateException.class,
            () -> deaktiviertesSpiel.meldeVorbehalt(SpielerPosition.WEST, VorbehaltAnsage.HOCHZEIT),
            "Die Tischkonfiguration muss Hochzeit serverseitig sperren koennen, damit Frontend und Backend dieselbe Regelbasis teilen.");
    }

    @Test
    void priorisiertTrumpfsoloVorHochzeit() {
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, spielregeln, kartendeckMitVerteiltenHaenden(Map.of(
                SpielerPosition.WEST, List.of(
                    karte(Farbe.KREUZ, Kartenwert.DAME, 1),
                    karte(Farbe.KREUZ, Kartenwert.DAME, 2)
                )
            )));
        spiel.teileKartenAus();
        spiel.meldeVorbehalt(SpielerPosition.WEST, VorbehaltAnsage.HOCHZEIT);
        spiel.meldeVorbehalt(SpielerPosition.NORD, VorbehaltAnsage.SOLO_TRUMPF);
        spiel.meldeGesund(SpielerPosition.OST);
        spiel.meldeGesund(SpielerPosition.SUED);
        spiel.loeseVorbehalteAuf();

        assertEquals(Spieltyp.SOLO_TRUMPF, spiel.spieltyp(),
            "Soli muessen in der Vorbehaltsaufloesung ueber der Hochzeit liegen, sonst stimmt die Prioritaetsregel nicht.");
        assertEquals(List.of(SpielerPosition.NORD), spiel.parteien().spielerVon(Partei.RE));
    }

    @Test
    void loestArmutMitKartentauschAufUndMachtDenAnnehmendenSpielerZumRePartner() {
        Karte ersteArmutskarte = karte(Farbe.KREUZ, Kartenwert.DAME, 1);
        Karte zweiteArmutskarte = karte(Farbe.KREUZ, Kartenwert.BUBE, 1);
        Karte dritteArmutskarte = karte(Farbe.KARO, Kartenwert.AS, 1);
        Karte rueckgabeEins = karte(Farbe.KREUZ, Kartenwert.AS, 2);
        Karte rueckgabeZwei = karte(Farbe.PIK, Kartenwert.AS, 2);
        Karte rueckgabeDrei = karte(Farbe.HERZ, Kartenwert.AS, 1);
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, spielregeln, kartendeckMitVerteiltenHaenden(Map.of(
                SpielerPosition.WEST, handMitDreiTruepfen(ersteArmutskarte, zweiteArmutskarte, dritteArmutskarte),
                SpielerPosition.OST, gegenhandFuerArmutAnnahme(rueckgabeEins, rueckgabeZwei, rueckgabeDrei)
            )));
        spiel.teileKartenAus();
        spiel.meldeVorbehalt(SpielerPosition.WEST, VorbehaltAnsage.ARMUT);
        spiel.meldeGesund(SpielerPosition.NORD);
        spiel.meldeGesund(SpielerPosition.OST);
        spiel.meldeGesund(SpielerPosition.SUED);
        spiel.loeseVorbehalteAuf();

        assertInstanceOf(Spielphase.ArmutTausch.class, spiel.phase(),
            "Armut braucht eine eigene Tauschphase vor dem ersten Stich, damit Angebot und Annahme serverseitig validiert werden.");
        assertEquals(Spieltyp.ARMUT, spiel.spieltyp());

        spiel.legeArmutTrumpfkarten(SpielerPosition.WEST, List.of(ersteArmutskarte, zweiteArmutskarte, dritteArmutskarte));
        assertEquals(SpielerPosition.NORD, spiel.armutStatus().orElseThrow().aktuellerAntwortspieler().orElseThrow(),
            "Nach dem verdeckten Angebot muss die Annahme links vom Armut-Spieler beginnen und im Uhrzeigersinn weiterlaufen.");

        spiel.lehneArmutAb(SpielerPosition.NORD);
        spiel.nimmArmutAn(SpielerPosition.OST, List.of(rueckgabeEins, rueckgabeZwei, rueckgabeDrei));

        assertInstanceOf(Spielphase.Stichphase.class, spiel.phase());
        assertEquals(List.of(SpielerPosition.WEST, SpielerPosition.OST), spiel.parteien().spielerVon(Partei.RE),
            "Armut-Spieler und annehmender Spieler muessen danach gemeinsam Re bilden, sonst stimmen Ansagen und Wertung nicht.");
        assertEquals(12, spiel.handVon(SpielerPosition.WEST).karten().size());
        assertEquals(12, spiel.handVon(SpielerPosition.OST).karten().size(),
            "Nach dem Tausch muessen beide beteiligten Haende wieder die normale Kartenzahl haben, damit die Stichphase korrekt startet.");
        assertTrue(spiel.handVon(SpielerPosition.WEST).enthaelt(rueckgabeEins));
        assertTrue(spiel.handVon(SpielerPosition.WEST).enthaelt(rueckgabeZwei));
        assertTrue(spiel.handVon(SpielerPosition.WEST).enthaelt(rueckgabeDrei));
        assertTrue(spiel.handVon(SpielerPosition.OST).enthaelt(ersteArmutskarte));
        assertTrue(spiel.handVon(SpielerPosition.OST).enthaelt(zweiteArmutskarte));
        assertTrue(spiel.handVon(SpielerPosition.OST).enthaelt(dritteArmutskarte));
        assertFalse(spiel.handVon(SpielerPosition.WEST).enthaelt(ersteArmutskarte));
        assertFalse(spiel.handVon(SpielerPosition.OST).enthaelt(rueckgabeEins));
        assertEquals(SpielerPosition.WEST, spiel.aktuellerStich().orElseThrow().aufspieler());
        for (SpielerPosition ziel : SpielerPosition.standardReihenfolge()) {
            assertTrue(spiel.parteien().sichtAufPartei(SpielerPosition.NORD, ziel).isPresent(),
                "Nach einem angenommenen Armut-Tausch muessen die festen Parteien offenliegen, damit keine verdeckte Partnerinformation uebrig bleibt.");
        }
    }

    @Test
    void lehntArmutMitMehrAlsDreiTrumpfenOderBeiDeaktivierterRegelAb() {
        Spiel spielMitVierTruepfen = Spiel.neu(SpielerPosition.SUED, spielregeln, kartendeckMitVerteiltenHaenden(Map.of(
                SpielerPosition.WEST, List.of(
                    karte(Farbe.KREUZ, Kartenwert.DAME, 1),
                    karte(Farbe.KREUZ, Kartenwert.BUBE, 1),
                    karte(Farbe.KARO, Kartenwert.AS, 1),
                    karte(Farbe.KARO, Kartenwert.KOENIG, 1),
                    karte(Farbe.KREUZ, Kartenwert.AS, 1),
                    karte(Farbe.KREUZ, Kartenwert.KOENIG, 1),
                    karte(Farbe.KREUZ, Kartenwert.ZEHN, 1),
                    karte(Farbe.KREUZ, Kartenwert.NEUN, 1),
                    karte(Farbe.PIK, Kartenwert.AS, 1),
                    karte(Farbe.PIK, Kartenwert.KOENIG, 1),
                    karte(Farbe.PIK, Kartenwert.ZEHN, 1),
                    karte(Farbe.PIK, Kartenwert.NEUN, 1)
                )
            )));
        spielMitVierTruepfen.teileKartenAus();

        assertThrows(IllegalStateException.class,
            () -> spielMitVierTruepfen.meldeVorbehalt(SpielerPosition.WEST, VorbehaltAnsage.ARMUT),
            "Armut darf nur mit hoechstens drei Truepfen angemeldet werden, damit das Sonderspiel auf echte Mangellagen beschraenkt bleibt.");

        Spielregeln armutDeaktiviert = spielregeln.mitArmutAktiv(false);
        Spiel deaktiviertesSpiel = Spiel.neu(SpielerPosition.SUED, armutDeaktiviert, kartendeckMitVerteiltenHaenden(Map.of(
                SpielerPosition.WEST, handMitDreiTruepfen(
                    karte(Farbe.KREUZ, Kartenwert.DAME, 1),
                    karte(Farbe.KREUZ, Kartenwert.BUBE, 1),
                    karte(Farbe.KARO, Kartenwert.AS, 1)
                )
            )));
        deaktiviertesSpiel.teileKartenAus();

        assertThrows(IllegalStateException.class,
            () -> deaktiviertesSpiel.meldeVorbehalt(SpielerPosition.WEST, VorbehaltAnsage.ARMUT),
            "Die Tischkonfiguration muss Armut serverseitig sperren koennen, damit Frontend und Backend dieselben Sonderspiel-Regeln teilen.");
    }

    @Test
    void wirftNeuEinWennNiemandDieArmutAnnimmt() {
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, spielregeln, kartendeckMitVerteiltenHaenden(Map.of(
                SpielerPosition.WEST, handMitDreiTruepfen(
                    karte(Farbe.KREUZ, Kartenwert.DAME, 1),
                    karte(Farbe.KREUZ, Kartenwert.BUBE, 1),
                    karte(Farbe.KARO, Kartenwert.AS, 1)
                )
            )));
        spiel.teileKartenAus();
        spiel.meldeVorbehalt(SpielerPosition.WEST, VorbehaltAnsage.ARMUT);
        spiel.meldeGesund(SpielerPosition.NORD);
        spiel.meldeGesund(SpielerPosition.OST);
        spiel.meldeGesund(SpielerPosition.SUED);
        spiel.loeseVorbehalteAuf();
        spiel.legeArmutTrumpfkarten(SpielerPosition.WEST, List.of(
            karte(Farbe.KREUZ, Kartenwert.DAME, 1),
            karte(Farbe.KREUZ, Kartenwert.BUBE, 1),
            karte(Farbe.KARO, Kartenwert.AS, 1)
        ));
        spiel.lehneArmutAb(SpielerPosition.NORD);
        spiel.lehneArmutAb(SpielerPosition.OST);
        spiel.lehneArmutAb(SpielerPosition.SUED);

        assertEquals(Spielphase.VORBEHALT_ANSAGE, spiel.phase(),
            "Wenn niemand die Armut annimmt, muss sofort neu gemischt und wieder mit einer frischen Vorbehaltsrunde gestartet werden.");
        assertEquals(Spieltyp.NORMALSPIEL, spiel.spieltyp());
        assertTrue(spiel.armutStatus().isEmpty());
        assertTrue(spiel.vorbehalte().isEmpty());
        assertEquals(SpielerPosition.WEST, spiel.naechsterVorbehaltSpieler().orElseThrow());
        for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
            assertEquals(12, spiel.handVon(position).karten().size(),
                "Auch nach einem Einwurf muessen alle Spieler wieder vollstaendige Haende erhalten, damit die neue Runde sauber beginnt.");
        }
    }

    @Test
    void lehntTrumpfsoloAbWennEsPerRegelnDeaktiviertIst() {
        Spielregeln soloDeaktiviert = spielregeln.mitSoloTrumpfAktiv(false);
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, soloDeaktiviert, kartendeckMitKontrolliertenHaenden());
        spiel.teileKartenAus();

        assertThrows(IllegalStateException.class,
            () -> spiel.meldeVorbehalt(SpielerPosition.WEST, VorbehaltAnsage.SOLO_TRUMPF),
            "Deaktivierte Sonderspiele muessen serverseitig geblockt werden, damit Tischkonfigurationen spaeter verbindlich bleiben.");
    }

    @Test
    void lehntDamensoloBubensoloUndFleischlosBeiDeaktivierterRegelAb() {
        Spiel damensoloDeaktiviert = Spiel.neu(SpielerPosition.SUED, spielregeln.mitSoloDameAktiv(false), kartendeckMitKontrolliertenHaenden());
        damensoloDeaktiviert.teileKartenAus();
        Spiel bubensoloDeaktiviert = Spiel.neu(SpielerPosition.SUED, spielregeln.mitSoloBubeAktiv(false), kartendeckMitKontrolliertenHaenden());
        bubensoloDeaktiviert.teileKartenAus();
        Spiel fleischlosDeaktiviert = Spiel.neu(SpielerPosition.SUED, spielregeln.mitSoloFleischlosAktiv(false), kartendeckMitKontrolliertenHaenden());
        fleischlosDeaktiviert.teileKartenAus();

        assertThrows(IllegalStateException.class,
            () -> damensoloDeaktiviert.meldeVorbehalt(SpielerPosition.WEST, VorbehaltAnsage.SOLO_DAME),
            "Die Tischkonfiguration muss auch Damensoli serverseitig sperren koennen, damit keine UI einen verbotenen Vorbehalt durchdrueckt.");
        assertThrows(IllegalStateException.class,
            () -> bubensoloDeaktiviert.meldeVorbehalt(SpielerPosition.WEST, VorbehaltAnsage.SOLO_BUBE),
            "Bubensoli brauchen dieselbe serverseitige Regelhoheit wie andere Vorbehalte, damit Vorbehalt-Phase und Konfiguration konsistent bleiben.");
        assertThrows(IllegalStateException.class,
            () -> fleischlosDeaktiviert.meldeVorbehalt(SpielerPosition.WEST, VorbehaltAnsage.SOLO_FLEISCHLOS),
            "Fleischlos muss ebenfalls deaktivierbar sein, sonst waere die Tischkonfiguration fuer Soli nicht vollstaendig.");
    }

    @Test
    void schmeissenBei5KoenigenFuehrtZuNeuausteilen() {
        // 5 Koenige auf der Hand von WEST muss Schmeissen ermoeglichen — sofortiges Neu-Austeilen
        Spielregeln regelnMitSchmeissen = Spielregeln.locoBlatRegeln();
        Kartendeck deck = kartendeckMitFuenfKoenigenAufWest();
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, regelnMitSchmeissen, deck);
        spiel.teileKartenAus();
        spiel.meldeVorbehalt(SpielerPosition.WEST, VorbehaltAnsage.SCHMEISSEN);
        spiel.meldeGesund(SpielerPosition.NORD);
        spiel.meldeGesund(SpielerPosition.OST);
        spiel.meldeGesund(SpielerPosition.SUED);
        spiel.loeseVorbehalteAuf();

        assertInstanceOf(Spielphase.VorbehaltAnsage.class, spiel.phase(),
            "Nach Schmeissen muss neu ausgeteilt werden — das Spiel muss zurueck in die Vorbehalt-Ansage-Phase wechseln.");
        assertTrue(spiel.vorbehalte().isEmpty(),
            "Nach dem Einwurf muessen alle Vorbehalte zurueckgesetzt sein.");
    }

    @Test
    void schmeissenHatHoechstePrioritaetVorSolo() {
        // Auch wenn ein anderer Spieler ein Solo anmeldet, hat Schmeissen Vorrang
        Spielregeln regelnMitSchmeissen = Spielregeln.locoBlatRegeln();
        Kartendeck deck = kartendeckMitFuenfKoenigenAufWest();
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, regelnMitSchmeissen, deck);
        spiel.teileKartenAus();
        spiel.meldeVorbehalt(SpielerPosition.WEST, VorbehaltAnsage.SCHMEISSEN);
        spiel.meldeVorbehalt(SpielerPosition.NORD, VorbehaltAnsage.SOLO_TRUMPF);
        spiel.meldeGesund(SpielerPosition.OST);
        spiel.meldeGesund(SpielerPosition.SUED);
        spiel.loeseVorbehalteAuf();

        assertInstanceOf(Spielphase.VorbehaltAnsage.class, spiel.phase(),
            "Schmeissen muss hoehere Prioritaet als ein Solo haben — das Spiel muss neu ausgeteilt werden.");
    }

    @Test
    void schmeissenNichtMoeglichMitNur4Koenigen() {
        // 4 Koenige reichen nicht zum Schmeissen
        Spielregeln regelnMitSchmeissen = Spielregeln.locoBlatRegeln();
        Kartendeck deck = kartendeckMitVierKoenigenAufWest();
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, regelnMitSchmeissen, deck);
        spiel.teileKartenAus();

        assertFalse(VorbehaltAnsage.SCHMEISSEN.istZulaessig(spiel.handVon(SpielerPosition.WEST), regelnMitSchmeissen),
            "Vier Koenige genuegen nicht zum Schmeissen — die Schwelle liegt bei fuenf.");
    }

    @Test
    void schmeissenDeaktiviertBeiDkvRegeln() {
        // DKV-Turnier-Regeln deaktivieren Schmeissen
        Spielregeln dkvRegeln = Spielregeln.dkvRegeln();
        Kartendeck deck = kartendeckMitFuenfKoenigenAufWest();
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, dkvRegeln, deck);
        spiel.teileKartenAus();

        assertFalse(VorbehaltAnsage.SCHMEISSEN.istZulaessig(spiel.handVon(SpielerPosition.WEST), dkvRegeln),
            "Im DKV-Turnier-Modus darf Schmeissen nicht moeglich sein, auch wenn ein Spieler fuenf Koenige hat.");
        assertThrows(IllegalStateException.class,
            () -> spiel.meldeVorbehalt(SpielerPosition.WEST, VorbehaltAnsage.SCHMEISSEN),
            "Deaktiviertes Schmeissen muss serverseitig geblockt werden.");
    }

    @Test
    void schmeissenMitDeaktivierterRegelWirdAbgelehnt() {
        // schmeissenAktiv explizit deaktiviert
        Spielregeln regelnOhneSchmeissen = Spielregeln.locoBlatRegeln().mitSchmeissenAktiv(false);
        Kartendeck deck = kartendeckMitFuenfKoenigenAufWest();
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, regelnOhneSchmeissen, deck);
        spiel.teileKartenAus();

        assertFalse(VorbehaltAnsage.SCHMEISSEN.istZulaessig(spiel.handVon(SpielerPosition.WEST), regelnOhneSchmeissen),
            "Wenn schmeissenAktiv=false, darf Schmeissen nicht zulaessig sein.");
    }

    @Test
    void schmeissenNachNeuausteilen_ZweitesSchmeissenWirdAbgelehnt() {
        // Nach erstem Schmeissen und Neuausteilen darf WEST kein zweites Mal schmeissen,
        // auch wenn die neue Hand wieder 5+ Koenige enthaelt.
        // Wichtig: Schutzmechanismus gegen endlose Neuausteile-Schleifen und
        // Missbrauch des Schmeiss-Rechts durch unguenstige Karten.
        Spielregeln regeln = Spielregeln.locoBlatRegeln();
        Kartendeck deck = kartendeckMitFuenfKoenigenAufWest();
        // Erster Schmeiss-Zyklus
        Spiel nachErstemSchmeissen = Spiel.neu(SpielerPosition.SUED, regeln, deck);
        nachErstemSchmeissen.teileKartenAus();
        nachErstemSchmeissen.meldeVorbehalt(SpielerPosition.WEST, VorbehaltAnsage.SCHMEISSEN);
        nachErstemSchmeissen.meldeGesund(SpielerPosition.NORD);
        nachErstemSchmeissen.meldeGesund(SpielerPosition.OST);
        nachErstemSchmeissen.meldeGesund(SpielerPosition.SUED);
        nachErstemSchmeissen.loeseVorbehalteAuf();

        // Spiel ist jetzt wieder in VORBEHALT_ANSAGE mit neuen Karten
        assertInstanceOf(Spielphase.VorbehaltAnsage.class, nachErstemSchmeissen.phase(),
            "Nach erstem Schmeissen muss Neudeal stattgefunden haben.");

        // Zweites Schmeissen desselben Spielers muss abgelehnt werden
        assertThrows(IllegalStateException.class,
            () -> nachErstemSchmeissen.meldeVorbehalt(SpielerPosition.WEST, VorbehaltAnsage.SCHMEISSEN),
            "Ein Spieler darf das Schmeiss-Recht pro Spiel nur einmal nutzen — "
            + "sonst koennte ein Spieler mit schlechter Hand beliebig oft neu austeilen.");
    }

    @Test
    void durchlaeuftEinNormalspielVonDerAusteilungBisZurAuswertung() {
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, spielregeln, Kartendeck.neu(spielregeln));

        assertEquals(Spielphase.KARTEN_AUSTEILEN, spiel.phase(),
            "Ein neues Spiel muss mit dem Austeilen beginnen, damit spaetere Schnittstellen die Phasen stabil orchestrieren koennen.");

        spiel.teileKartenAus();
        assertEquals(Spielphase.VORBEHALT_ANSAGE, spiel.phase());
        assertEquals(12, spiel.handVon(SpielerPosition.SUED).karten().size(),
            "Jeder Spieler braucht im Normalspiel 12 Karten, weil darauf die komplette Stichfolge basiert.");

        for (SpielerPosition position : SpielerPosition.imUhrzeigersinnAb(SpielerPosition.WEST)) {
            assertEquals(position, spiel.naechsterVorbehaltSpieler().orElseThrow(),
                "Die Vorbehaltsrunde muss links vom Geber starten und im Uhrzeigersinn laufen.");
            spiel.meldeGesund(position);
        }
        assertEquals(Spielphase.VORBEHALT_AUFLOESUNG, spiel.phase());

        spiel.loeseVorbehalteAuf();
        assertInstanceOf(Spielphase.Stichphase.class, spiel.phase());
        assertEquals(Partei.RE, spiel.parteien().parteiVon(SpielerPosition.SUED));
        assertEquals(Partei.RE, spiel.parteien().parteiVon(SpielerPosition.WEST));
        assertEquals(Partei.KONTRA, spiel.parteien().parteiVon(SpielerPosition.NORD));
        assertEquals(Partei.KONTRA, spiel.parteien().parteiVon(SpielerPosition.OST));
        assertTrue(spiel.parteien().sichtAufPartei(SpielerPosition.SUED, SpielerPosition.SUED).isPresent(),
            "Jeder Spieler muss seine eigene Partei kennen, damit Ansagen spaeter regelkonform moeglich sind.");
        assertTrue(spiel.parteien().sichtAufPartei(SpielerPosition.SUED, SpielerPosition.WEST).isEmpty(),
            "Andere Parteien bleiben zu Beginn verdeckt, damit das Normalspiel fachlich korrekt startet.");

        while (spiel.phase() instanceof Spielphase.Stichphase) {
            SpielerPosition aktuellerSpieler = spiel.aktuellerSpieler().orElseThrow();
            Karte karte = spiel.gueltigeKartenFuer(aktuellerSpieler).getFirst();
            spiel.spieleKarte(aktuellerSpieler, karte);
        }

        assertEquals(12, spiel.abgeschlosseneStiche().size(),
            "Ein vollstaendiges Normalspiel braucht 12 Stiche, sonst kann keine belastbare Endauswertung stattfinden.");
        assertEquals(Spielphase.AUSWERTUNG, spiel.phase());

        spiel.werteAus();

        assertEquals(Spielphase.GESAMTSTAND_AKTUALISIEREN, spiel.phase());
        Spielergebnis ergebnis = spiel.ergebnis().orElseThrow();
        assertEquals(240, ergebnis.augenVon(Partei.RE).wert() + ergebnis.augenVon(Partei.KONTRA).wert());
        assertEquals(0, ergebnis.spielpunkteVon(SpielerPosition.SUED).wert()
            + ergebnis.spielpunkteVon(SpielerPosition.WEST).wert()
            + ergebnis.spielpunkteVon(SpielerPosition.NORD).wert()
            + ergebnis.spielpunkteVon(SpielerPosition.OST).wert(),
            "Die Nullsumme macht den Partiestand robust und verhindert schleichende Bewertungsfehler.");
        assertFalse(spiel.aktuellerStich().isPresent());
    }

    @Test
    void lehntUngueltigeZustandsuebergaengeAb() {
        Spiel spiel = Spiel.neu(SpielerPosition.OST, spielregeln, Kartendeck.neu(spielregeln));

        assertThrows(IllegalStateException.class, () -> spiel.meldeGesund(SpielerPosition.SUED),
            "Ohne ausgeteilte Karten darf kein Spieler Vorbehalte melden, sonst verliert die Zustandsmaschine ihre Autoritaet.");

        spiel.teileKartenAus();
        assertThrows(IllegalStateException.class, spiel::loeseVorbehalteAuf,
            "Vorbehalte duerfen erst nach vier Meldungen aufgeloest werden, damit kein Spieler uebersprungen wird.");

        spiel.meldeGesund(SpielerPosition.SUED);
        spiel.meldeGesund(SpielerPosition.WEST);
        spiel.meldeGesund(SpielerPosition.NORD);
        spiel.meldeGesund(SpielerPosition.OST);
        spiel.loeseVorbehalteAuf();

        assertThrows(IllegalStateException.class, spiel::werteAus,
            "Eine Auswertung vor dem letzten Stich wuerde unvollstaendige Augenstaende in den Gesamtstand schleusen.");
    }

    @Test
    void laesstAnsagenNurFuerDenAktuellenSpielerUndNurImRegelkonformenFensterZu() {
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, spielregeln, kartendeckMitKontrolliertenHaenden());
        spiel.teileKartenAus();
        spiel.meldeGesund(SpielerPosition.WEST);
        spiel.meldeGesund(SpielerPosition.NORD);
        spiel.meldeGesund(SpielerPosition.OST);
        spiel.meldeGesund(SpielerPosition.SUED);
        spiel.loeseVorbehalteAuf();

        assertTrue(spiel.kannAnsagen(SpielerPosition.WEST, Ansage.RE),
            "Vor dem ersten Ausspiel muss der aktuelle Re-Spieler seine Partei ansagen koennen, sonst fehlen die Kernereignisse der Stichphase.");
        assertFalse(spiel.kannAnsagen(SpielerPosition.NORD, Ansage.KONTRA),
            "Nur der aktuelle Spieler darf ansagen, damit Reihenfolge und Zeitfenster an den echten Spielzug gekoppelt bleiben.");

        spiel.sageAn(SpielerPosition.WEST, Ansage.RE);
        assertTrue(spiel.ansagen().offenbartParteiVon(SpielerPosition.WEST),
            "Die Grundansage muss im Spielzustand festgehalten werden, damit UIs und Auswertung dieselbe Wahrheit sehen.");

        spiel.spieleKarte(SpielerPosition.WEST, spiel.gueltigeKartenFuer(SpielerPosition.WEST).getFirst());
        assertTrue(spiel.kannAnsagen(SpielerPosition.NORD, Ansage.KONTRA),
            "Nach dem Ausspiel muss der naechste aktuelle Spieler regelkonform eigene Ansagen taetigen koennen.");
    }

    @Test
    void grundansageAktualisiertsParteisichtbarkeitImDomainmodell() {
        // Warum wichtig: Das Backend ist einzige Wahrheitsquelle. Nach einer Re/Kontra-Ansage muss
        // die Parteizugehoerigkeit direkt in parteien.offenFuerAlle reflektiert sein, nicht nur
        // in der Ansagehistorie — sonst muss die Praesentationsschicht Domaenenlogik duplizieren.
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, spielregeln, kartendeckMitKontrolliertenHaenden());
        spiel.teileKartenAus();
        spiel.meldeGesund(SpielerPosition.WEST);
        spiel.meldeGesund(SpielerPosition.NORD);
        spiel.meldeGesund(SpielerPosition.OST);
        spiel.meldeGesund(SpielerPosition.SUED);
        spiel.loeseVorbehalteAuf();

        assertTrue(spiel.parteien().sichtAufPartei(SpielerPosition.NORD, SpielerPosition.WEST).isEmpty(),
            "Im Normalspiel sind Parteien anfangs verdeckt — nur die eigene Position ist sicher bekannt.");

        spiel.sageAn(SpielerPosition.WEST, Ansage.RE);

        assertTrue(spiel.parteien().sichtAufPartei(SpielerPosition.NORD, SpielerPosition.WEST).isPresent(),
            "Nach einer Grundansage muss die Parteizugehoerigkeit im Domainmodell sichtbar sein.");
        assertEquals(Partei.RE,
            spiel.parteien().sichtAufPartei(SpielerPosition.NORD, SpielerPosition.WEST).orElseThrow(),
            "Der ansagende Re-Spieler muss fuer alle als RE erkennbar sein.");
    }

    @Test
    void erkenntStillesSoloBeiBeideKreuzDamenOhneVorbehalt() {
        // Warum wichtig: Ein Spieler mit beiden Kreuz-Damen, der trotzdem GESUND meldet, wuerde
        // ausNormalspielHaenden mit nur einem RE-Spieler crashen. Stattdessen muss das Spiel
        // defensiv als stilles Solo (Trumpfsolo) fortgefuehrt werden.
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, spielregeln, kartendeckMitVerteiltenHaenden(Map.of(
                SpielerPosition.WEST, List.of(
                    karte(Farbe.KREUZ, Kartenwert.DAME, 1),
                    karte(Farbe.KREUZ, Kartenwert.DAME, 2)
                )
            )));
        spiel.teileKartenAus();
        spiel.meldeGesund(SpielerPosition.WEST);
        spiel.meldeGesund(SpielerPosition.NORD);
        spiel.meldeGesund(SpielerPosition.OST);
        spiel.meldeGesund(SpielerPosition.SUED);
        spiel.loeseVorbehalteAuf();

        assertEquals(Spieltyp.SOLO_TRUMPF, spiel.spieltyp(),
            "Ein Spieler mit beiden Kreuz-Damen ohne Hochzeit-Vorbehalt muss defensiv als Trumpfsolo weiterlaufen, damit kein Server-Crash entsteht.");
        assertEquals(List.of(SpielerPosition.WEST), spiel.parteien().spielerVon(Partei.RE),
            "Der Spieler mit beiden Kreuz-Damen spielt das stille Solo alleine gegen die anderen drei.");
        assertInstanceOf(Spielphase.Stichphase.class, spiel.phase());
    }

    @Test
    void loestHerzsoloMitKorrekterTrumpfOrdnungAuf() {
        // Warum wichtig: SOLO_TRUMPF_HERZ braucht eine eigene TrumpfOrdnung, bei der Herz-Karten
        // (statt Karo) die Fehltrumpfe bilden. Ohne diesen Test koennte versehentlich NormaleTrumpfOrdnung
        // aktiv bleiben und Herz-Karten als Fehlfarbe behandeln.
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, spielregeln, kartendeckMitKontrolliertenHaenden());
        spiel.teileKartenAus();
        spiel.meldeGesund(SpielerPosition.WEST);
        spiel.meldeVorbehalt(SpielerPosition.NORD, VorbehaltAnsage.SOLO_TRUMPF_HERZ);
        spiel.meldeGesund(SpielerPosition.OST);
        spiel.meldeGesund(SpielerPosition.SUED);
        spiel.loeseVorbehalteAuf();

        assertEquals(Spieltyp.SOLO_TRUMPF_HERZ, spiel.spieltyp());
        assertEquals(List.of(SpielerPosition.NORD), spiel.parteien().spielerVon(Partei.RE),
            "Im Herzsolo spielt der Solo-Spieler alleine gegen drei Gegner.");
        assertTrue(spiel.trumpfOrdnung().istTrumpf(karte(Farbe.HERZ, Kartenwert.KOENIG, 1)),
            "Im Herzsolo muessen Herz-Karten Trumpf sein.");
        assertFalse(spiel.trumpfOrdnung().istTrumpf(karte(Farbe.KARO, Kartenwert.AS, 1)),
            "Im Herzsolo sind Karo-Karten (ausser Dame/Bube) Fehlfarbe.");
        assertTrue(spiel.trumpfOrdnung().istTrumpf(karte(Farbe.HERZ, Kartenwert.ZEHN, 1)),
            "Die Herz-Zehn ist im Herzsolo als Herz-Karte Trumpf, aber ohne Dulle-Sonderstatus.");
        assertFalse(spiel.trumpfOrdnung().spaetereGleicheKarteGewinnt(karte(Farbe.HERZ, Kartenwert.ZEHN, 1)),
            "Im Herzsolo gibt es keinen Dulle-Mechanismus: zweite Herz-Zehn gewinnt nicht automatisch.");
    }

    @Test
    void loestPiksoloUndKreuzsoloMitKorrekterParteibildungAuf() {
        // Warum wichtig: Alle drei variablen Trumpfsoli muessen denselben Solo-Spieler als RE markieren.
        Spiel pikspiel = Spiel.neu(SpielerPosition.SUED, spielregeln, kartendeckMitKontrolliertenHaenden());
        pikspiel.teileKartenAus();
        pikspiel.meldeVorbehalt(SpielerPosition.WEST, VorbehaltAnsage.SOLO_TRUMPF_PIK);
        pikspiel.meldeGesund(SpielerPosition.NORD);
        pikspiel.meldeGesund(SpielerPosition.OST);
        pikspiel.meldeGesund(SpielerPosition.SUED);
        pikspiel.loeseVorbehalteAuf();

        assertEquals(Spieltyp.SOLO_TRUMPF_PIK, pikspiel.spieltyp());
        assertEquals(List.of(SpielerPosition.WEST), pikspiel.parteien().spielerVon(Partei.RE));
        assertTrue(pikspiel.trumpfOrdnung().istTrumpf(karte(Farbe.PIK, Kartenwert.KOENIG, 1)),
            "Im Piksolo sind Pik-Karten Trumpf.");
        assertFalse(pikspiel.trumpfOrdnung().istTrumpf(karte(Farbe.KARO, Kartenwert.AS, 1)),
            "Im Piksolo sind Karo-Karten (ausser Dame/Bube) Fehlfarbe.");

        Spiel kreuzspiel = Spiel.neu(SpielerPosition.SUED, spielregeln, kartendeckMitKontrolliertenHaenden());
        kreuzspiel.teileKartenAus();
        kreuzspiel.meldeVorbehalt(SpielerPosition.WEST, VorbehaltAnsage.SOLO_TRUMPF_KREUZ);
        kreuzspiel.meldeGesund(SpielerPosition.NORD);
        kreuzspiel.meldeGesund(SpielerPosition.OST);
        kreuzspiel.meldeGesund(SpielerPosition.SUED);
        kreuzspiel.loeseVorbehalteAuf();

        assertEquals(Spieltyp.SOLO_TRUMPF_KREUZ, kreuzspiel.spieltyp());
        assertEquals(List.of(SpielerPosition.WEST), kreuzspiel.parteien().spielerVon(Partei.RE));
        assertTrue(kreuzspiel.trumpfOrdnung().istTrumpf(karte(Farbe.KREUZ, Kartenwert.KOENIG, 1)),
            "Im Kreuzsolo sind Kreuz-Karten (ausser Dame/Bube) Trumpf.");
    }

    /**
     * BUG-DKV-PRESET: Regression-Test — DKV-Turnier-Preset muss nach 12 Stichen (48-Karten-Spiel)
     * korrekt in die Auswertung uebergehen und ein gueltiges Spielergebnis liefern.
     * Sichert ab dass dkvRegeln() (ohneNeunen=false) ein vollstaendiges Normalspiel ermoeglicht.
     */
    @Test
    void spielSchliesstAbMitDkvPreset() {
        Spielregeln dkvRegeln = Spielregeln.dkvRegeln();
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, dkvRegeln, Kartendeck.neu(dkvRegeln));

        spiel.teileKartenAus();
        assertEquals(12, spiel.handVon(SpielerPosition.SUED).karten().size(),
            "DKV spielt mit 48 Karten (ohneNeunen=false): jeder Spieler erhaelt 12 Karten.");

        while (spiel.naechsterVorbehaltSpieler().isPresent()) {
            spiel.meldeGesund(spiel.naechsterVorbehaltSpieler().orElseThrow());
        }
        spiel.loeseVorbehalteAuf();

        while (spiel.phase() instanceof Spielphase.Stichphase) {
            SpielerPosition spieler = spiel.aktuellerSpieler().orElseThrow();
            spiel.spieleKarte(spieler, spiel.gueltigeKartenFuer(spieler).getFirst());
        }

        assertEquals(12, spiel.abgeschlosseneStiche().size(),
            "DKV braucht exakt 12 Stiche — bei weniger Stichen ist die Auswertung fehlerhaft (BUG-DKV-PRESET).");
        assertEquals(Spielphase.AUSWERTUNG, spiel.phase(),
            "Nach dem 12. Stich muss das Spiel die AUSWERTUNG-Phase erreichen.");

        spiel.werteAus();

        assertEquals(Spielphase.GESAMTSTAND_AKTUALISIEREN, spiel.phase());
        Spielergebnis ergebnis = spiel.ergebnis().orElseThrow();
        assertEquals(240, ergebnis.augenVon(Partei.RE).wert() + ergebnis.augenVon(Partei.KONTRA).wert(),
            "48-Karten-Spiel hat 240 Augen gesamt.");
        assertEquals(0,
            ergebnis.spielpunkteVon(SpielerPosition.SUED).wert()
            + ergebnis.spielpunkteVon(SpielerPosition.WEST).wert()
            + ergebnis.spielpunkteVon(SpielerPosition.NORD).wert()
            + ergebnis.spielpunkteVon(SpielerPosition.OST).wert(),
            "Spielpunkte muessen nullsummig sein.");
    }

    private Spiel spieleStich(Spiel spiel, Karte ersteKarte, Karte zweiteKarte, Karte dritteKarte, Karte vierteKarte) {
        for (Karte karte : List.of(ersteKarte, zweiteKarte, dritteKarte, vierteKarte)) {
            SpielerPosition spieler = spiel.aktuellerSpieler().orElseThrow();
            spiel.spieleKarte(spieler, karte);
        }
        return spiel;
    }

    private Kartendeck kartendeckMitVerteiltenHaenden(Map<SpielerPosition, List<Karte>> vorgaben) {
        EnumMap<SpielerPosition, List<Karte>> haende = new EnumMap<>(SpielerPosition.class);
        for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
            haende.put(position, new ArrayList<>(vorgaben.getOrDefault(position, List.of())));
        }

        List<Karte> restkarten = new ArrayList<>(Kartendeck.neu(spielregeln).karten());
        for (List<Karte> karten : haende.values()) {
            for (Karte karte : karten) {
                if (!restkarten.remove(karte)) {
                    throw new IllegalArgumentException("Vorgegebene Karte ist nicht verfuegbar: " + karte);
                }
            }
        }

        for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
            while (haende.get(position).size() < 12) {
                haende.get(position).add(restkarten.removeFirst());
            }
        }

        List<Karte> deckkarten = new ArrayList<>();
        for (int index = 0; index < 12; index++) {
            for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
                deckkarten.add(haende.get(position).get(index));
            }
        }
        return kartendeckAus(deckkarten);
    }

    private Kartendeck kartendeckMitKontrolliertenHaenden() {
        List<Karte> karten = new ArrayList<>();
        for (int index = 1; index <= 12; index++) {
            karten.add(karteFuerSpieler(index, SpielerPosition.SUED));
            karten.add(karteFuerSpieler(index, SpielerPosition.WEST));
            karten.add(karteFuerSpieler(index, SpielerPosition.NORD));
            karten.add(karteFuerSpieler(index, SpielerPosition.OST));
        }
        return kartendeckAus(karten);
    }

    /** Kartendeck bei dem WEST genau 5 Koenige auf der Hand haelt (ohne Neunen — 10 Karten pro Spieler). */
    private Kartendeck kartendeckMitFuenfKoenigenAufWest() {
        List<Karte> westKarten = List.of(
            karte(Farbe.KREUZ, Kartenwert.KOENIG, 1),
            karte(Farbe.KREUZ, Kartenwert.KOENIG, 2),
            karte(Farbe.PIK, Kartenwert.KOENIG, 1),
            karte(Farbe.PIK, Kartenwert.KOENIG, 2),
            karte(Farbe.HERZ, Kartenwert.KOENIG, 1),
            karte(Farbe.KREUZ, Kartenwert.AS, 1),
            karte(Farbe.KREUZ, Kartenwert.ZEHN, 1),
            karte(Farbe.PIK, Kartenwert.AS, 1),
            karte(Farbe.PIK, Kartenwert.ZEHN, 1),
            karte(Farbe.HERZ, Kartenwert.AS, 1)
        );
        List<Karte> suedKarten = List.of(
            karte(Farbe.KREUZ, Kartenwert.DAME, 1),
            karte(Farbe.KREUZ, Kartenwert.DAME, 2),
            karte(Farbe.HERZ, Kartenwert.KOENIG, 2),
            karte(Farbe.KARO, Kartenwert.KOENIG, 1),
            karte(Farbe.KARO, Kartenwert.KOENIG, 2),
            karte(Farbe.KARO, Kartenwert.AS, 1),
            karte(Farbe.KARO, Kartenwert.AS, 2),
            karte(Farbe.KARO, Kartenwert.ZEHN, 1),
            karte(Farbe.KARO, Kartenwert.ZEHN, 2),
            karte(Farbe.HERZ, Kartenwert.ZEHN, 1)
        );
        List<Karte> nordKarten = List.of(
            karte(Farbe.HERZ, Kartenwert.AS, 2),
            karte(Farbe.HERZ, Kartenwert.ZEHN, 2),
            karte(Farbe.KREUZ, Kartenwert.BUBE, 1),
            karte(Farbe.PIK, Kartenwert.BUBE, 1),
            karte(Farbe.HERZ, Kartenwert.BUBE, 1),
            karte(Farbe.KARO, Kartenwert.BUBE, 1),
            karte(Farbe.KREUZ, Kartenwert.AS, 2),
            karte(Farbe.KREUZ, Kartenwert.ZEHN, 2),
            karte(Farbe.PIK, Kartenwert.AS, 2),
            karte(Farbe.PIK, Kartenwert.ZEHN, 2)
        );
        List<Karte> ostKarten = List.of(
            karte(Farbe.KREUZ, Kartenwert.BUBE, 2),
            karte(Farbe.PIK, Kartenwert.BUBE, 2),
            karte(Farbe.HERZ, Kartenwert.BUBE, 2),
            karte(Farbe.KARO, Kartenwert.BUBE, 2),
            karte(Farbe.KREUZ, Kartenwert.DAME, 1), // exemplar reuse ok — this is a controlled test deck
            karte(Farbe.PIK, Kartenwert.DAME, 1),
            karte(Farbe.PIK, Kartenwert.DAME, 2),
            karte(Farbe.HERZ, Kartenwert.DAME, 1),
            karte(Farbe.HERZ, Kartenwert.DAME, 2),
            karte(Farbe.KARO, Kartenwert.DAME, 1)
        );
        List<Karte> alleKarten = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            alleKarten.add(suedKarten.get(i));
            alleKarten.add(westKarten.get(i));
            alleKarten.add(nordKarten.get(i));
            alleKarten.add(ostKarten.get(i));
        }
        return kartendeckAus(alleKarten);
    }

    /** Kartendeck bei dem WEST genau 4 Koenige auf der Hand haelt (ohne Neunen — 10 Karten pro Spieler). */
    private Kartendeck kartendeckMitVierKoenigenAufWest() {
        List<Karte> westKarten = List.of(
            karte(Farbe.KREUZ, Kartenwert.KOENIG, 1),
            karte(Farbe.KREUZ, Kartenwert.KOENIG, 2),
            karte(Farbe.PIK, Kartenwert.KOENIG, 1),
            karte(Farbe.PIK, Kartenwert.KOENIG, 2),
            karte(Farbe.KREUZ, Kartenwert.AS, 1),
            karte(Farbe.KREUZ, Kartenwert.ZEHN, 1),
            karte(Farbe.PIK, Kartenwert.AS, 1),
            karte(Farbe.PIK, Kartenwert.ZEHN, 1),
            karte(Farbe.HERZ, Kartenwert.AS, 1),
            karte(Farbe.HERZ, Kartenwert.ZEHN, 1)
        );
        List<Karte> suedKarten = List.of(
            karte(Farbe.KREUZ, Kartenwert.DAME, 1),
            karte(Farbe.KREUZ, Kartenwert.DAME, 2),
            karte(Farbe.HERZ, Kartenwert.KOENIG, 1),
            karte(Farbe.HERZ, Kartenwert.KOENIG, 2),
            karte(Farbe.KARO, Kartenwert.KOENIG, 1),
            karte(Farbe.KARO, Kartenwert.KOENIG, 2),
            karte(Farbe.KARO, Kartenwert.AS, 1),
            karte(Farbe.KARO, Kartenwert.AS, 2),
            karte(Farbe.KARO, Kartenwert.ZEHN, 1),
            karte(Farbe.KARO, Kartenwert.ZEHN, 2)
        );
        List<Karte> nordKarten = List.of(
            karte(Farbe.HERZ, Kartenwert.AS, 2),
            karte(Farbe.HERZ, Kartenwert.ZEHN, 2),
            karte(Farbe.KREUZ, Kartenwert.BUBE, 1),
            karte(Farbe.PIK, Kartenwert.BUBE, 1),
            karte(Farbe.HERZ, Kartenwert.BUBE, 1),
            karte(Farbe.KARO, Kartenwert.BUBE, 1),
            karte(Farbe.KREUZ, Kartenwert.AS, 2),
            karte(Farbe.KREUZ, Kartenwert.ZEHN, 2),
            karte(Farbe.PIK, Kartenwert.AS, 2),
            karte(Farbe.PIK, Kartenwert.ZEHN, 2)
        );
        List<Karte> ostKarten = List.of(
            karte(Farbe.KREUZ, Kartenwert.BUBE, 2),
            karte(Farbe.PIK, Kartenwert.BUBE, 2),
            karte(Farbe.HERZ, Kartenwert.BUBE, 2),
            karte(Farbe.KARO, Kartenwert.BUBE, 2),
            karte(Farbe.PIK, Kartenwert.DAME, 1),
            karte(Farbe.PIK, Kartenwert.DAME, 2),
            karte(Farbe.HERZ, Kartenwert.DAME, 1),
            karte(Farbe.HERZ, Kartenwert.DAME, 2),
            karte(Farbe.KARO, Kartenwert.DAME, 1),
            karte(Farbe.KARO, Kartenwert.DAME, 2)
        );
        List<Karte> alleKarten = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            alleKarten.add(suedKarten.get(i));
            alleKarten.add(westKarten.get(i));
            alleKarten.add(nordKarten.get(i));
            alleKarten.add(ostKarten.get(i));
        }
        return kartendeckAus(alleKarten);
    }

    private List<Karte> handMitDreiTruepfen(Karte ersteTrumpfkarte, Karte zweiteTrumpfkarte, Karte dritteTrumpfkarte) {
        return List.of(
            ersteTrumpfkarte,
            zweiteTrumpfkarte,
            dritteTrumpfkarte,
            karte(Farbe.KREUZ, Kartenwert.AS, 1),
            karte(Farbe.KREUZ, Kartenwert.KOENIG, 1),
            karte(Farbe.KREUZ, Kartenwert.ZEHN, 1),
            karte(Farbe.KREUZ, Kartenwert.NEUN, 1),
            karte(Farbe.PIK, Kartenwert.AS, 1),
            karte(Farbe.PIK, Kartenwert.KOENIG, 1),
            karte(Farbe.PIK, Kartenwert.ZEHN, 1),
            karte(Farbe.PIK, Kartenwert.NEUN, 1),
            karte(Farbe.HERZ, Kartenwert.KOENIG, 1)
        );
    }

    private List<Karte> gegenhandFuerArmutAnnahme(Karte rueckgabeEins, Karte rueckgabeZwei, Karte rueckgabeDrei) {
        return List.of(
            rueckgabeEins,
            rueckgabeZwei,
            rueckgabeDrei,
            karte(Farbe.KREUZ, Kartenwert.KOENIG, 2),
            karte(Farbe.KREUZ, Kartenwert.ZEHN, 2),
            karte(Farbe.KREUZ, Kartenwert.NEUN, 2),
            karte(Farbe.PIK, Kartenwert.KOENIG, 2),
            karte(Farbe.PIK, Kartenwert.ZEHN, 2),
            karte(Farbe.PIK, Kartenwert.NEUN, 2),
            karte(Farbe.HERZ, Kartenwert.KOENIG, 2),
            karte(Farbe.HERZ, Kartenwert.NEUN, 1),
            karte(Farbe.HERZ, Kartenwert.NEUN, 2)
        );
    }

    private Karte karteFuerSpieler(int index, SpielerPosition spielerPosition) {
        return switch (spielerPosition) {
            case SUED -> index == 1 ? new Karte(Farbe.KREUZ, Kartenwert.DAME, 1)
                : neueKontrollkarte(index, spielerPosition, 1);
            case WEST -> index == 1 ? new Karte(Farbe.KREUZ, Kartenwert.DAME, 2)
                : neueKontrollkarte(index, spielerPosition, 2);
            case NORD -> index == 1 ? new Karte(Farbe.HERZ, Kartenwert.AS, 1)
                : neueKontrollkarte(index, spielerPosition, 1);
            case OST -> index == 1 ? new Karte(Farbe.PIK, Kartenwert.AS, 1)
                : neueKontrollkarte(index, spielerPosition, 2);
        };
    }

    private Karte neueKontrollkarte(int index, SpielerPosition spielerPosition, int exemplarIndex) {
        Farbe[] farben = Farbe.values();
        Kartenwert[] werte = Kartenwert.values();
        Farbe farbe = farben[(index + spielerPosition.ordinal()) % farben.length];
        Kartenwert wert = werte[(index + spielerPosition.ordinal()) % werte.length];
        if (farbe == Farbe.KREUZ && wert == Kartenwert.DAME) {
            wert = Kartenwert.AS;
        }
        return new Karte(farbe, wert, exemplarIndex);
    }

    private Karte karte(Farbe farbe, Kartenwert wert, int exemplarIndex) {
        return new Karte(farbe, wert, exemplarIndex);
    }

    private Kartendeck kartendeckAus(List<Karte> karten) {
        try {
            java.lang.reflect.Constructor<Kartendeck> konstruktor = Kartendeck.class.getDeclaredConstructor(java.util.Collection.class);
            konstruktor.setAccessible(true);
            return konstruktor.newInstance(karten);
        } catch (ReflectiveOperationException ausnahme) {
            throw new IllegalStateException("Kontrolliertes Kartendeck konnte nicht erzeugt werden", ausnahme);
        }
    }
}
