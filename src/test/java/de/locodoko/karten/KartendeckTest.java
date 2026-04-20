package de.locodoko.karten;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class KartendeckTest {

    @Test
    void erzeugtVollstaendigesDeckMitDoppeltenKartenUnd240Augen() {
        Kartendeck kartendeck = Kartendeck.neu(Spielregeln.standardRegeln());

        assertEquals(48, kartendeck.karten().size(), "Das Doppelkopf-Standarddeck (mit Neunen) hat 48 Karten als Grundlage fuer 12 Stiche.");
        assertEquals(240, kartendeck.gesamtaugen(), "Die 240 Gesamtaugen sind die fachliche Konstante fuer spaetere Wertungslogik.");

        Map<String, Long> haeufigkeiten = kartendeck.karten().stream()
            .collect(Collectors.groupingBy(karte -> karte.farbe() + "-" + karte.wert(), Collectors.counting()));
        assertEquals(24, haeufigkeiten.size(), "Es muss 24 unterschiedliche Kartenkombinationen geben (mit Neunen).");
        assertTrue(haeufigkeiten.values().stream().allMatch(anzahl -> anzahl == 2),
            "Jede Kartenkombination muss exakt doppelt existieren, damit gleiche Karten und Dullen-Regeln korrekt pruefbar sind.");

        List<Karte> herzZehnen = kartendeck.karten().stream()
            .filter(karte -> karte.farbe() == Farbe.HERZ && karte.wert() == Kartenwert.ZEHN)
            .toList();
        assertEquals(2, herzZehnen.size());
        assertNotEquals(herzZehnen.getFirst().exemplarIndex(), herzZehnen.getLast().exemplarIndex(),
            "Gleiche Karten muessen serverseitig unterscheidbar bleiben, damit Stichreihenfolge und Gewinner korrekt ermittelt werden koennen.");
    }

    @Test
    void erzeugtDeckOhneNeunenMitVierzigKartenUndWeiterhin240Augen() {
        Kartendeck kartendeck = Kartendeck.neu(Spielregeln.ohneNeunenRegeln());

        assertEquals(40, kartendeck.karten().size(), "Ohne Neunen reduziert sich das Deck auf 40 Karten und damit 10 Stiche.");
        assertEquals(240, kartendeck.gesamtaugen(), "Neunen tragen keine Augen; die Konstante 240 bleibt daher auch ohne Neunen erhalten.");
        assertTrue(kartendeck.karten().stream().noneMatch(karte -> karte.wert() == Kartenwert.NEUN),
            "Die Regelvariante ohne Neunen darf keine Neunen mehr erzeugen.");
    }

    @Test
    void mischtUndTeiltDasDeckGleichmaessigAufVierSpielerAuf() {
        Kartendeck ungemischt = Kartendeck.neu(Spielregeln.standardRegeln());
        Kartendeck gemischt = ungemischt.gemischt(new Random(42));

        assertNotEquals(ungemischt.karten(), gemischt.karten(),
            "Mischen ist wichtig, damit keine deterministische Kartenverteilung den Spielstart verzerrt.");

        List<Hand> haende = gemischt.anVierSpielerAusteilen();

        assertEquals(4, haende.size());
        assertTrue(haende.stream().allMatch(hand -> hand.karten().size() == 12),
            "Im Standardspiel brauchen alle vier Spieler jeweils 12 Karten fuer eine vollstaendige Runde.");
        assertEquals(48, haende.stream().flatMap(hand -> hand.karten().stream()).distinct().count(),
            "Beim Austeilen darf keine Karte verloren gehen oder doppelt bei verschiedenen Spielern landen.");
    }
}
