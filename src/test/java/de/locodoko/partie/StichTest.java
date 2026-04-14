package de.locodoko.partie;

import de.locodoko.karten.Farbe;
import de.locodoko.karten.Hand;
import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartenwert;
import de.locodoko.karten.NormaleTrumpfOrdnung;
import de.locodoko.karten.Spielregeln;
import de.locodoko.karten.TrumpfOrdnung;
import de.locodoko.karten.UngueltigerSpielzugException;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class StichTest {

    private final TrumpfOrdnung trumpfOrdnung = new NormaleTrumpfOrdnung(Spielregeln.standardRegeln());

    @Test
    void erzwingtBedienpflichtWennDieAngefragteFehlfarbeVorhandenIst() {
        Stich stich = Stich.neu(SpielerPosition.SUED)
            .spieleKarte(SpielerPosition.SUED, herzKoenig(1), new Hand(List.of(herzKoenig(1))), trumpfOrdnung);
        Hand hand = new Hand(List.of(herzAs(1), karoAs(1)));

        assertEquals(List.of(herzAs(1)), stich.gueltigeKarten(hand, trumpfOrdnung),
            "Die gueltigen Karten muessen die Bedienpflicht abbilden, damit Frontend und KI spaeter dieselbe Regelbasis nutzen.");
        assertThrows(UngueltigerSpielzugException.class,
            () -> stich.spieleKarte(SpielerPosition.WEST, karoAs(1), hand, trumpfOrdnung),
            "Ein Spieler mit Herz auf der Hand darf im Herzstich nicht auf Trumpf ausweichen.");
    }

    @Test
    void erlaubtBeliebigeKarteWennDieAngefragteFarbeNichtBedientWerdenKann() {
        Stich stich = Stich.neu(SpielerPosition.SUED)
            .spieleKarte(SpielerPosition.SUED, herzKoenig(1), new Hand(List.of(herzKoenig(1))), trumpfOrdnung);
        Hand hand = new Hand(List.of(karoAs(1), kreuzDame(1)));

        assertEquals(hand.karten(), stich.gueltigeKarten(hand, trumpfOrdnung),
            "Kann ein Spieler nicht bedienen, muss die Regelbasis jede Karte zulassen, sonst blockieren legale Stiche.");
    }

    @Test
    void ermitteltDenHoechstenTrumpfAlsGewinnerUndSummiertDieAugen() {
        Stich stich = Stich.neu(SpielerPosition.SUED)
            .spieleKarte(SpielerPosition.SUED, kreuzAs(1), new Hand(List.of(kreuzAs(1))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.WEST, karoKoenig(1), new Hand(List.of(karoKoenig(1))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.NORD, dulle(1), new Hand(List.of(dulle(1))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.OST, karoAs(1), new Hand(List.of(karoAs(1))), trumpfOrdnung);

        assertEquals(SpielerPosition.NORD, stich.gewinner(trumpfOrdnung).spieler(),
            "Trumpf muss Fehlkarten jederzeit ueberstechen koennen; darauf basiert die komplette Stichauswertung.");
        assertEquals(36, stich.augen().wert(),
            "Die Summe der Augen ist Grundlage fuer Sieg, Absagen und Sonderpunkte am Spielende.");
        assertEquals(SpielerPosition.NORD, stich.naechsterAufspieler(trumpfOrdnung),
            "Der Stichgewinner muss den naechsten Stich eroeffnen, damit die Spielreihenfolge stabil bleibt.");
    }

    @Test
    void laesstBeiGleichenTrumpfkartenDieFruehereKarteGewinnenWennEsKeineDulleIst() {
        Stich stich = Stich.neu(SpielerPosition.SUED)
            .spieleKarte(SpielerPosition.SUED, karoKoenig(1), new Hand(List.of(karoKoenig(1))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.WEST, karoKoenig(2), new Hand(List.of(karoKoenig(2))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.NORD, kreuzAs(1), new Hand(List.of(kreuzAs(1))), trumpfOrdnung)
            .spieleKarte(SpielerPosition.OST, herzAs(1), new Hand(List.of(herzAs(1))), trumpfOrdnung);

        assertEquals(SpielerPosition.SUED, stich.gewinner(trumpfOrdnung).spieler(),
            "Bei gleichen Karten soll grundsaetzlich die zuerst gespielte gewinnen, damit der Stich deterministisch bleibt.");
    }

    @Test
    void laesstDieZweiteDulleStechenWennDieRegelAktivIst() {
        TrumpfOrdnung mitDullenRegel = new NormaleTrumpfOrdnung(Spielregeln.standardRegeln());
        Stich stich = Stich.neu(SpielerPosition.SUED)
            .spieleKarte(SpielerPosition.SUED, dulle(1), new Hand(List.of(dulle(1))), mitDullenRegel)
            .spieleKarte(SpielerPosition.WEST, dulle(2), new Hand(List.of(dulle(2))), mitDullenRegel)
            .spieleKarte(SpielerPosition.NORD, karoAs(1), new Hand(List.of(karoAs(1))), mitDullenRegel)
            .spieleKarte(SpielerPosition.OST, kreuzAs(1), new Hand(List.of(kreuzAs(1))), mitDullenRegel);

        assertEquals(SpielerPosition.WEST, stich.gewinner(mitDullenRegel).spieler(),
            "Die konfigurierbare Zweite-Dulle-Regel ist ein zentraler Sonderfall der Trumpfhierarchie.");
    }

    @Test
    void erzwingtSpielreihenfolgeImUhrzeigersinn() {
        Stich stich = Stich.neu(SpielerPosition.SUED);

        assertThrows(UngueltigerSpielzugException.class,
            () -> stich.spieleKarte(SpielerPosition.WEST, herzAs(1), new Hand(List.of(herzAs(1))), trumpfOrdnung),
            "Nur der aktuelle Spieler im Uhrzeigersinn darf eine Karte legen, damit serverseitige Validierung robust bleibt.");
    }

    private Karte dulle(int exemplar) {
        return new Karte(Farbe.HERZ, Kartenwert.ZEHN, exemplar);
    }

    private Karte kreuzDame(int exemplar) {
        return new Karte(Farbe.KREUZ, Kartenwert.DAME, exemplar);
    }

    private Karte kreuzAs(int exemplar) {
        return new Karte(Farbe.KREUZ, Kartenwert.AS, exemplar);
    }

    private Karte herzAs(int exemplar) {
        return new Karte(Farbe.HERZ, Kartenwert.AS, exemplar);
    }

    private Karte herzKoenig(int exemplar) {
        return new Karte(Farbe.HERZ, Kartenwert.KOENIG, exemplar);
    }

    private Karte karoAs(int exemplar) {
        return new Karte(Farbe.KARO, Kartenwert.AS, exemplar);
    }

    private Karte karoKoenig(int exemplar) {
        return new Karte(Farbe.KARO, Kartenwert.KOENIG, exemplar);
    }
}
