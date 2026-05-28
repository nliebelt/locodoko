package de.locodoko.partie;

import de.locodoko.karten.Hand;
import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartenwert;
import de.locodoko.karten.Farbe;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests fuer {@link Haende} — Konstruktion, Zugriff, Mutation.
 *
 * <p>Warum: Haende ist der erste Wrapper-VO in REFACTOR-DOMAIN-1.
 * Diese Tests sichern die Immutabilitaet und korrekte Methoden-Semantik ab,
 * damit spaetere Schritte (Spiel.java-Migration) auf gruener Basis aufsetzen.</p>
 */
class HaendeTest {

    private static final Karte KARO_AS = new Karte(Farbe.KARO, Kartenwert.AS, 1);
    private static final Karte KREUZ_DAME = new Karte(Farbe.KREUZ, Kartenwert.DAME, 1);

    private static Hand handMit(Karte... karten) {
        return new Hand(List.of(karten));
    }

    @Test
    void leer_gibtLeereHaendeZurueck() {
        Haende haende = Haende.leer();

        assertFalse(haende.enthaelt(SpielerPosition.NORD));
        assertTrue(haende.alsMap().isEmpty());
    }

    @Test
    void aus_kopiertzwingendDieMap() {
        Map<SpielerPosition, Hand> original = new java.util.EnumMap<>(SpielerPosition.class);
        original.put(SpielerPosition.SUED, handMit(KARO_AS));
        Haende haende = Haende.aus(original);

        // Nachtraegliche Aenderung an der Quell-Map darf Haende nicht beeinflussen
        original.put(SpielerPosition.NORD, handMit(KREUZ_DAME));

        assertFalse(haende.enthaelt(SpielerPosition.NORD),
            "Haende muss eine unveraenderliche Kopie sein");
    }

    @Test
    void handVon_liefertKorrekteHand() {
        Hand hand = handMit(KARO_AS, KREUZ_DAME);
        Haende haende = Haende.aus(Map.of(SpielerPosition.WEST, hand));

        assertEquals(hand, haende.handVon(SpielerPosition.WEST));
    }

    @Test
    void handVon_wirftFehlerBeiUnbekannterPosition() {
        Haende haende = Haende.leer();

        assertThrows(IllegalArgumentException.class,
            () -> haende.handVon(SpielerPosition.NORD),
            "handVon soll IllegalArgumentException werfen wenn Position fehlt");
    }

    @Test
    void mitErsetzterHand_gibtNeueInstanzZurueck() {
        Hand altHand = handMit(KARO_AS);
        Hand neueHand = handMit(KREUZ_DAME);
        Haende original = Haende.aus(Map.of(SpielerPosition.OST, altHand));

        Haende aktualisiert = original.mitErsetzterHand(SpielerPosition.OST, neueHand);

        // Original unveraendert
        assertEquals(altHand, original.handVon(SpielerPosition.OST),
            "Original-Haende darf nicht veraendert werden");
        // Neue Instanz hat neue Hand
        assertEquals(neueHand, aktualisiert.handVon(SpielerPosition.OST));
    }

    @Test
    void mitErsetzterHand_fuegtNeuePositionHinzu() {
        Haende haende = Haende.aus(Map.of(SpielerPosition.SUED, handMit(KARO_AS)));

        Haende erweitert = haende.mitErsetzterHand(SpielerPosition.NORD, handMit(KREUZ_DAME));

        assertTrue(erweitert.enthaelt(SpielerPosition.SUED));
        assertTrue(erweitert.enthaelt(SpielerPosition.NORD));
        assertEquals(2, erweitert.alsMap().size());
    }

    @Test
    void equality_gleicheInhalteGleich() {
        Hand hand = handMit(KARO_AS);
        Haende h1 = Haende.aus(Map.of(SpielerPosition.SUED, hand));
        Haende h2 = Haende.aus(Map.of(SpielerPosition.SUED, hand));

        assertEquals(h1, h2);
        assertEquals(h1.hashCode(), h2.hashCode());
    }
}
