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
        Spiel spiel = partie.aktuellesSpiel().teileKartenAus();

        // 1. Vorbehalte klären
        while (spiel.naechsterVorbehaltSpieler().isPresent()) {
            spiel = spiel.meldeGesund(spiel.naechsterVorbehaltSpieler().orElseThrow());
        }
        spiel = spiel.loeseVorbehalteAuf();

        // 2. 10 Stiche spielen
        while (spiel.abgeschlosseneStiche().size() < spiel.kartenProSpieler()) {
            while (spiel.phase() instanceof Spielphase.Stichphase) {
                SpielerPosition spieler = spiel.aktuellerSpieler().orElseThrow();
                Karte karte = spiel.gueltigeKartenFuer(spieler).getFirst();
                spiel = spiel.spieleKarte(spieler, karte).neuerStand();
            }
            if (spiel.abgeschlosseneStiche().size() < spiel.kartenProSpieler()) {
                // Spielphase.Stichphase erlaubt den Zugriff auf den nächsten Aufspieler indirekt
                if (spiel.phase() instanceof Spielphase.Stichphase sp) {
                    SpielerPosition naechsterAufspieler = sp.aktuellerStich().naechsterAufspieler(spiel.trumpfOrdnung());
                    spiel = spiel.neuesSpielMitStichfortschritt(spiel.haende(), spiel.abgeschlosseneStiche(), new Spielphase.Stichphase(Stich.neu(naechsterAufspieler), spiel.pflichtansageAusstehend(), spiel.hochzeitStatus().orElse(null)), spiel.parteien());
                }
            }
        }

        assertTrue(spiel.phase() instanceof Spielphase.Auswertung, 
            "Nach 10 Stichen (ohne Neunen) sollte das Spiel in der Auswertungsphase sein.");
    }
}
