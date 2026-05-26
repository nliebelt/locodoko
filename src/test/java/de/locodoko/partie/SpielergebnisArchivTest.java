package de.locodoko.partie;

import de.locodoko.karten.Farbe;
import de.locodoko.karten.Hand;
import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartenwert;
import de.locodoko.karten.NormaleTrumpfOrdnung;
import de.locodoko.karten.Spielregeln;
import de.locodoko.karten.Spieltyp;
import de.locodoko.karten.TrumpfOrdnung;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SpielergebnisArchivTest {

    private final Spielregeln spielregeln = Spielregeln.standardRegeln();
    private final TrumpfOrdnung trumpfOrdnung = new NormaleTrumpfOrdnung(spielregeln);

    private final Parteien parteien = Parteien.ausNormalspielHaenden(Map.of(
        SpielerPosition.SUED, new Hand(List.of(new Karte(Farbe.KREUZ, Kartenwert.DAME, 1))),
        SpielerPosition.NORD, new Hand(List.of(new Karte(Farbe.KREUZ, Kartenwert.DAME, 2))),
        SpielerPosition.WEST, new Hand(List.of(new Karte(Farbe.HERZ, Kartenwert.NEUN, 1))),
        SpielerPosition.OST,  new Hand(List.of(new Karte(Farbe.PIK,  Kartenwert.NEUN, 1)))
    ));

    @Test
    void wirdAusSpielergenbisKorrektErstellt() {
        UUID partieId = UUID.randomUUID();
        Spielergebnis ergebnis = erstelleNormalspiel();

        SpielergebnisArchiv archiv = SpielergebnisArchiv.aus(ergebnis, partieId, 3, SpielerPosition.WEST, Spieltyp.NORMALSPIEL);

        assertEquals(partieId, archiv.partieId());
        assertEquals(3, archiv.spielNummer());
        assertEquals(SpielerPosition.WEST, archiv.geberPosition());
        assertEquals(Spieltyp.NORMALSPIEL, archiv.spieltyp());
        assertNotNull(archiv.abgeschlossenAm());
        assertNotNull(archiv.id());
    }

    @Test
    void normalspielIstKeinSolo() {
        SpielergebnisArchiv archiv = SpielergebnisArchiv.aus(
            erstelleNormalspiel(), UUID.randomUUID(), 1, SpielerPosition.SUED, Spieltyp.NORMALSPIEL);

        assertFalse(archiv.istSolo());
        assertNull(archiv.soloTyp());
    }

    @Test
    void soloTypWirdErkannt() {
        SpielergebnisArchiv archiv = SpielergebnisArchiv.aus(
            erstelleNormalspiel(), UUID.randomUUID(), 1, SpielerPosition.SUED, Spieltyp.SOLO_BUBE);

        assertTrue(archiv.istSolo());
        assertEquals(Spieltyp.SOLO_BUBE, archiv.soloTyp());
    }

    @Test
    void spielpunkteWerdenProPositionGespeichert() {
        Spielergebnis ergebnis = erstelleNormalspiel();
        SpielergebnisArchiv archiv = SpielergebnisArchiv.aus(
            ergebnis, UUID.randomUUID(), 1, SpielerPosition.SUED, Spieltyp.NORMALSPIEL);

        for (SpielerPosition position : SpielerPosition.values()) {
            assertEquals(
                ergebnis.spielpunkteVon(position).wert(),
                archiv.spielpunkteVon(position),
                "Spielpunkte fuer " + position + " stimmen nicht ueberein."
            );
        }
    }

    @Test
    void sonderpunkteWerdenAlsEintraegeGespeichert() {
        // doppelkopfMitFuchs(42) + 9×reStich20(180) + reStich16(16) + karlchenStich0(2) = 240 Augen
        List<Stich> stiche = new ArrayList<>();
        stiche.add(doppelkopfMitFuchs());
        stiche.addAll(Collections.nCopies(9, reStich20()));
        stiche.add(reStich16());
        stiche.add(karlchenStich0());

        Spielergebnis ergebnis = new PunkteRechner().berechneNormalspielErgebnis(
            stiche, parteien, trumpfOrdnung, Ansagen.leer(), spielregeln
        );

        SpielergebnisArchiv archiv = SpielergebnisArchiv.aus(
            ergebnis, UUID.randomUUID(), 1, SpielerPosition.SUED, Spieltyp.NORMALSPIEL);

        assertFalse(archiv.sonderpunkte().isEmpty(),
            "Fuchs und Karlchen sollen als SonderpunktEintrag-Zeilen erscheinen.");
    }

    // ── Hilfsmethoden ────────────────────────────────────────────────────────

    private Spielergebnis erstelleNormalspiel() {
        List<Stich> stiche = new ArrayList<>();
        stiche.addAll(Collections.nCopies(7, reStich20()));
        stiche.addAll(Collections.nCopies(5, kontraStich20()));
        return new PunkteRechner().berechneNormalspielErgebnis(
            stiche, parteien, trumpfOrdnung, Ansagen.leer(), spielregeln
        );
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

    private Stich karlchenStich0() {
        return Stich.neu(SpielerPosition.WEST)
            .spieleKarte(SpielerPosition.WEST, kreuzBube(1), new Hand(List.of(kreuzBube(1))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.NORD, pikNeun(1), new Hand(List.of(pikNeun(1))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.OST, herzNeun(1), new Hand(List.of(herzNeun(1))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.SUED, kreuzNeun(1), new Hand(List.of(kreuzNeun(1))), trumpfOrdnung);
    }

    private Stich reStich16() {
        return Stich.neu(SpielerPosition.SUED)
            .spieleKarte(SpielerPosition.SUED, dulle(1), new Hand(List.of(dulle(1))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.WEST, karoKoenig(1), new Hand(List.of(karoKoenig(1))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.NORD, kreuzBube(2), new Hand(List.of(kreuzBube(2))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.OST, herzNeun(1), new Hand(List.of(herzNeun(1))), trumpfOrdnung);
    }

    private Karte dulle(int exemplar) { return new Karte(Farbe.HERZ, Kartenwert.ZEHN, exemplar); }
    private Karte karoAs(int exemplar) { return new Karte(Farbe.KARO, Kartenwert.AS, exemplar); }
    private Karte karoKoenig(int exemplar) { return new Karte(Farbe.KARO, Kartenwert.KOENIG, exemplar); }
    private Karte kreuzAs(int exemplar) { return new Karte(Farbe.KREUZ, Kartenwert.AS, exemplar); }
    private Karte kreuzBube(int exemplar) { return new Karte(Farbe.KREUZ, Kartenwert.BUBE, exemplar); }
    private Karte kreuzDame(int exemplar) { return new Karte(Farbe.KREUZ, Kartenwert.DAME, exemplar); }
    private Karte kreuzNeun(int exemplar) { return new Karte(Farbe.KREUZ, Kartenwert.NEUN, exemplar); }
    private Karte kreuzZehn(int exemplar) { return new Karte(Farbe.KREUZ, Kartenwert.ZEHN, exemplar); }
    private Karte herzNeun(int exemplar) { return new Karte(Farbe.HERZ, Kartenwert.NEUN, exemplar); }
    private Karte pikNeun(int exemplar) { return new Karte(Farbe.PIK, Kartenwert.NEUN, exemplar); }
}
