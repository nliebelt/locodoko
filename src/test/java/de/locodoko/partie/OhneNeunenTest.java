package de.locodoko.partie;

import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartendeck;
import de.locodoko.karten.Spielregeln;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertTrue;

class OhneNeunenTest {

    @Test
    void partieMitOhneNeunenSchliesstNachZehnStichenAb() {
        Spielregeln ohneNeunen = Spielregeln.ohneNeunenRegeln();
        Partie partie = Partie.neu(1, SpielerPosition.SUED, ohneNeunen);

        Kartendeck deck = Kartendeck.neu(ohneNeunen).gemischt(new java.util.Random(123));
        partie = partie.starteNaechstesSpiel(deck);
        Spiel spiel = partie.aktuellesSpiel();
        spiel.teileKartenAus();

        // 1. Vorbehalte klären
        while (spiel.naechsterVorbehaltSpieler().isPresent()) {
            spiel.meldeGesund(spiel.naechsterVorbehaltSpieler().orElseThrow());
        }
        spiel.loeseVorbehalteAuf();

        // 2. Stiche spielen bis keine Stichphase mehr
        while (spiel.phase() instanceof Spielphase.Stichphase) {
            SpielerPosition spieler = spiel.aktuellerSpieler().orElseThrow();
            Karte karte = spiel.gueltigeKartenFuer(spieler).getFirst();
            spiel.spieleKarte(spieler, karte);
        }

        assertTrue(spiel.phase() instanceof Spielphase.Auswertung,
            "Nach 10 Stichen (ohne Neunen) sollte das Spiel in der Auswertungsphase sein.");
    }
}
