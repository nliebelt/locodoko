package de.locodoko.partie;

import de.locodoko.karten.Farbe;
import de.locodoko.karten.Hand;
import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartenwert;
import de.locodoko.karten.NormaleTrumpfOrdnung;
import de.locodoko.karten.SpielerPosition;
import de.locodoko.karten.Spielregeln;
import de.locodoko.karten.Stich;
import de.locodoko.karten.TrumpfOrdnung;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class PunkteRechnerTest {

    private final Spielregeln spielregeln = Spielregeln.standardRegeln();
    private final TrumpfOrdnung trumpfOrdnung = new NormaleTrumpfOrdnung(spielregeln);
    private final PunkteRechner punkteRechner = new PunkteRechner();
    private final Parteien parteien = Parteien.ausNormalspielHaenden(Map.of(
        SpielerPosition.SUED, new Hand(List.of(kreuzDame(1))),
        SpielerPosition.WEST, new Hand(List.of(kreuzDame(2))),
        SpielerPosition.NORD, new Hand(List.of(herzAs(1))),
        SpielerPosition.OST, new Hand(List.of(pikAs(1)))
    ));

    @Test
    void bewertetGrundansagenAbsagenUndGegenDieAltenNullsummig() {
        Ansagen ansagen = Ansagen.leer()
            .fuegeHinzu(SpielerPosition.SUED, Ansage.RE, parteien, spielregeln, 11)
            .fuegeHinzu(SpielerPosition.WEST, Ansage.KEINE_90, parteien, spielregeln, 10);

        Spielergebnis ergebnis = punkteRechner.berechneNormalspielErgebnis(
            kombiniere(wiederhole(reStich20(), 7), wiederhole(kontraStich20(), 5)),
            parteien,
            trumpfOrdnung,
            ansagen,
            spielregeln
        );

        assertEquals(140, ergebnis.augenVon(Partei.RE));
        assertEquals(100, ergebnis.augenVon(Partei.KONTRA));
        assertEquals(1, ergebnis.spielwert(),
            "Eine gewonnene Re-Ansage zaehlt doppelt, eine verfehlte Absage gibt den Punkt aber an die Gegenpartei zurueck.");
        assertEquals(1, ergebnis.spielpunkteVon(SpielerPosition.SUED));
        assertEquals(-1, ergebnis.spielpunkteVon(SpielerPosition.NORD));
        assertEquals(0, ergebnis.spielpunkteProSpieler().values().stream().mapToInt(Integer::intValue).sum(),
            "Die Nullsumme der Spielerpunkte ist entscheidend, damit Partiestand und Serienwertung nicht auseinanderlaufen.");
    }

    @Test
    void addiertSonderpunkteUndGrundansagenZumSpielwert() {
        Ansagen ansagen = Ansagen.leer()
            .fuegeHinzu(SpielerPosition.SUED, Ansage.RE, parteien, spielregeln, 11)
            .fuegeHinzu(SpielerPosition.NORD, Ansage.KONTRA, parteien, spielregeln, 11)
            .fuegeHinzu(SpielerPosition.WEST, Ansage.KEINE_90, parteien, spielregeln, 10)
            .fuegeHinzu(SpielerPosition.WEST, Ansage.KEINE_60, parteien, spielregeln, 9)
            .fuegeHinzu(SpielerPosition.WEST, Ansage.KEINE_30, parteien, spielregeln, 8)
            .fuegeHinzu(SpielerPosition.WEST, Ansage.SCHWARZ, parteien, spielregeln, 7);

        List<Stich> stiche = new ArrayList<>();
        stiche.add(doppelkopfMitFuchs());
        stiche.addAll(wiederhole(reStich20(), 9));
        stiche.add(reStich16());
        stiche.add(karlchenStich0());

        Spielergebnis ergebnis = punkteRechner.berechneNormalspielErgebnis(
            stiche,
            parteien,
            trumpfOrdnung,
            ansagen,
            spielregeln
        );

        assertEquals(240, ergebnis.augenVon(Partei.RE));
        assertEquals(0, ergebnis.augenVon(Partei.KONTRA));
        assertEquals(11, ergebnis.spielwert(),
            "Grundansagen, erreichte Absagen und Sonderpunkte muessen gemeinsam den finalen Spielwert bilden, weil genau das die Endwertung traegt.");
        assertEquals(List.of(Sonderpunkt.DOPPELKOPF, Sonderpunkt.FUCHS_GEFANGEN, Sonderpunkt.KARLCHEN), ergebnis.sonderpunkteVon(Partei.RE));
        assertEquals(11, ergebnis.spielpunkteVon(SpielerPosition.SUED));
        assertEquals(-11, ergebnis.spielpunkteVon(SpielerPosition.NORD));
    }

    @Test
    void gibtKontraBeimSiegGegenReAnsageDenZusatzpunkt() {
        Ansagen ansagen = Ansagen.leer()
            .fuegeHinzu(SpielerPosition.SUED, Ansage.RE, parteien, spielregeln, 11);

        Spielergebnis ergebnis = punkteRechner.berechneNormalspielErgebnis(
            kombiniere(wiederhole(reStich20(), 5), wiederhole(kontraStich20(), 7)),
            parteien,
            trumpfOrdnung,
            ansagen,
            spielregeln
        );

        assertEquals(100, ergebnis.augenVon(Partei.RE));
        assertEquals(140, ergebnis.augenVon(Partei.KONTRA));
        assertEquals(3, ergebnis.spielwert(),
            "Gewinnt Kontra gegen eine Re-Ansage, braucht die Wertung zusaetzlich den Punkt gegen die Alten.");
        assertEquals(3, ergebnis.spielpunkteVon(SpielerPosition.NORD));
        assertEquals(-3, ergebnis.spielpunkteVon(SpielerPosition.SUED));
    }

    private List<Stich> wiederhole(Stich stich, int anzahl) {
        return java.util.Collections.nCopies(anzahl, stich);
    }

    private List<Stich> kombiniere(List<Stich> erste, List<Stich> zweite) {
        List<Stich> stiche = new ArrayList<>(erste);
        stiche.addAll(zweite);
        return stiche;
    }

    private Stich reStich20() {
        return Stich.neu(SpielerPosition.SUED)
            .spieleKarte(SpielerPosition.SUED, dulle(1), new Hand(List.of(dulle(1))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.WEST, herzNeun(1), new Hand(List.of(herzNeun(1))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.NORD, kreuzZehn(1), new Hand(List.of(kreuzZehn(1))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.OST, pikNeun(1), new Hand(List.of(pikNeun(1))), trumpfOrdnung);
    }

    private Stich kontraStich20() {
        return Stich.neu(SpielerPosition.NORD)
            .spieleKarte(SpielerPosition.NORD, dulle(2), new Hand(List.of(dulle(2))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.OST, pikNeun(2), new Hand(List.of(pikNeun(2))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.SUED, kreuzZehn(2), new Hand(List.of(kreuzZehn(2))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.WEST, herzNeun(2), new Hand(List.of(herzNeun(2))), trumpfOrdnung);
    }

    private Stich doppelkopfMitFuchs() {
        return Stich.neu(SpielerPosition.SUED)
            .spieleKarte(SpielerPosition.SUED, dulle(1), new Hand(List.of(dulle(1))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.WEST, dulle(2), new Hand(List.of(dulle(2))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.NORD, karoAs(1), new Hand(List.of(karoAs(1))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.OST, kreuzAs(1), new Hand(List.of(kreuzAs(1))), trumpfOrdnung);
    }

    private Stich reStich16() {
        return Stich.neu(SpielerPosition.SUED)
            .spieleKarte(SpielerPosition.SUED, dulle(1), new Hand(List.of(dulle(1))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.WEST, karoKoenig(1), new Hand(List.of(karoKoenig(1))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.NORD, kreuzBube(2), new Hand(List.of(kreuzBube(2))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.OST, herzNeun(1), new Hand(List.of(herzNeun(1))), trumpfOrdnung);
    }

    private Stich karlchenStich0() {
        return Stich.neu(SpielerPosition.WEST)
            .spieleKarte(SpielerPosition.WEST, kreuzBube(1), new Hand(List.of(kreuzBube(1))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.NORD, pikNeun(1), new Hand(List.of(pikNeun(1))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.OST, herzNeun(1), new Hand(List.of(herzNeun(1))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.SUED, kreuzNeun(1), new Hand(List.of(kreuzNeun(1))), trumpfOrdnung);
    }

    private Karte dulle(int exemplar) {
        return new Karte(Farbe.HERZ, Kartenwert.ZEHN, exemplar);
    }

    private Karte karoAs(int exemplar) {
        return new Karte(Farbe.KARO, Kartenwert.AS, exemplar);
    }

    private Karte karoKoenig(int exemplar) {
        return new Karte(Farbe.KARO, Kartenwert.KOENIG, exemplar);
    }

    private Karte kreuzAs(int exemplar) {
        return new Karte(Farbe.KREUZ, Kartenwert.AS, exemplar);
    }

    private Karte kreuzBube(int exemplar) {
        return new Karte(Farbe.KREUZ, Kartenwert.BUBE, exemplar);
    }

    private Karte kreuzDame(int exemplar) {
        return new Karte(Farbe.KREUZ, Kartenwert.DAME, exemplar);
    }

    private Karte kreuzNeun(int exemplar) {
        return new Karte(Farbe.KREUZ, Kartenwert.NEUN, exemplar);
    }

    private Karte kreuzZehn(int exemplar) {
        return new Karte(Farbe.KREUZ, Kartenwert.ZEHN, exemplar);
    }

    private Karte herzNeun(int exemplar) {
        return new Karte(Farbe.HERZ, Kartenwert.NEUN, exemplar);
    }

    private Karte herzAs(int exemplar) {
        return new Karte(Farbe.HERZ, Kartenwert.AS, exemplar);
    }

    private Karte pikNeun(int exemplar) {
        return new Karte(Farbe.PIK, Kartenwert.NEUN, exemplar);
    }

    private Karte pikAs(int exemplar) {
        return new Karte(Farbe.PIK, Kartenwert.AS, exemplar);
    }
}
