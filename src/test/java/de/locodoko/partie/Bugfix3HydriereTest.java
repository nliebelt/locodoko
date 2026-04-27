package de.locodoko.partie;

import de.locodoko.karten.*;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class Bugfix3HydriereTest {

    @Test
    void testHydriereSchweinchen() {
        Spielregeln regeln = Spielregeln.standardRegeln().mitSchweinchenAktiv(true);
        Karte karoAs1 = new Karte(Farbe.KARO, Kartenwert.AS, 1);
        Karte karoAs2 = new Karte(Farbe.KARO, Kartenwert.AS, 2);
        Karte dulle1 = new Karte(Farbe.HERZ, Kartenwert.ZEHN, 1);
        Karte dulle2 = new Karte(Farbe.HERZ, Kartenwert.ZEHN, 2);

        Map<SpielerPosition, List<Karte>> kartenMap = new HashMap<>();
        kartenMap.put(SpielerPosition.WEST, new ArrayList<>(List.of(karoAs1, karoAs2)));
        kartenMap.put(SpielerPosition.NORD, new ArrayList<>(List.of(dulle1)));
        kartenMap.put(SpielerPosition.OST, new ArrayList<>(List.of(dulle2)));
        kartenMap.put(SpielerPosition.SUED, new ArrayList<>());

        List<Karte> alleRest = new ArrayList<>(Kartendeck.neu(regeln).karten());
        for (List<Karte> h : kartenMap.values()) alleRest.removeAll(h);
        for (SpielerPosition pos : SpielerPosition.standardReihenfolge()) {
            while (kartenMap.get(pos).size() < 12) kartenMap.get(pos).add(alleRest.remove(0));
        }
        List<Karte> deckKarten = new ArrayList<>();
        for (int i = 0; i < 12; i++) {
            for (SpielerPosition pos : SpielerPosition.standardReihenfolge()) deckKarten.add(kartenMap.get(pos).get(i));
        }
        Kartendeck deck = null;
        try {
            var ctor = Kartendeck.class.getDeclaredConstructor(java.util.Collection.class);
            ctor.setAccessible(true);
            deck = ctor.newInstance(deckKarten);
        } catch (Exception e) {}

        Spiel spiel = Spiel.neu(SpielerPosition.SUED, regeln, deck)
            .teileKartenAus()
            .meldeGesund(SpielerPosition.WEST)
            .meldeGesund(SpielerPosition.NORD)
            .meldeGesund(SpielerPosition.OST)
            .meldeGesund(SpielerPosition.SUED)
            .loeseVorbehalteAuf();
            
        // Now simulate DB load
        spiel.syncZuPersistenz();
        
        System.out.println("schweinchenAktivFlag=" + spiel.schweinchenAktivFlag());
        
        spiel.hydriere(regeln, null);

        // WEST spielt karoAs1
        SpielAktion a1 = spiel.spieleKarte(SpielerPosition.WEST, karoAs1);
        // NORD spielt Dulle 1
        SpielAktion a2 = a1.neuerStand().spieleKarte(SpielerPosition.NORD, dulle1);
        
        Stich stich = a2.neuerStand().aktuellerStich().get();
        GespielteKarte gewinner = stich.gewinner(a2.neuerStand().trumpfOrdnung());
        
        assertEquals(SpielerPosition.WEST, gewinner.spieler(), "Karo Ass muss die Dulle schlagen");
    }
}
