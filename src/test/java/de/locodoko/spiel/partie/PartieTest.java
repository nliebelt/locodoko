package de.locodoko.spiel.partie;

import de.locodoko.spiel.karten.Karte;
import de.locodoko.spiel.karten.Kartendeck;
import de.locodoko.spiel.karten.SpielerPosition;
import de.locodoko.spiel.karten.Spielregeln;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PartieTest {

    private final Spielregeln spielregeln = Spielregeln.standardRegeln();
    private final PunkteRechner punkteRechner = new PunkteRechner();

    @Test
    void rotiertDenGeberUndAkkumuliertDenGesamtstandUeberMehrereSpiele() {
        Partie partie = Partie.neu(2, SpielerPosition.SUED, spielregeln);

        partie = partie.starteNaechstesSpiel(Kartendeck.neu(spielregeln));
        partie = partie.mitAktuellemSpiel(spieleAutomatischZuEnde(partie.aktuellesSpiel()));
        partie = partie.schliesseAktuellesSpielAb();

        int ersterDurchlauf = partie.gesamtpunktestand().values().stream().mapToInt(Integer::intValue).sum();
        assertEquals(0, ersterDurchlauf,
            "Auch der Gesamtstand nach einem Spiel muss nullsummig bleiben, damit spaetere Serienwertungen stabil sind.");
        assertEquals(SpielerPosition.WEST, partie.naechsterGeber(),
            "Der Geber muss nach jedem Spiel im Uhrzeigersinn rotieren, sonst verschiebt sich die Aufspielreihenfolge dauerhaft.");

        partie = partie.starteNaechstesSpiel(Kartendeck.neu(spielregeln));
        partie = partie.mitAktuellemSpiel(spieleAutomatischZuEnde(partie.aktuellesSpiel()));
        partie = partie.schliesseAktuellesSpielAb();

        assertTrue(partie.istBeendet(), "Nach der konfigurierten Spielanzahl muss die Partie sauber enden.");
        assertEquals(2, partie.abgeschlosseneSpiele().size());
        assertEquals(0, partie.gesamtpunktestand().values().stream().mapToInt(Integer::intValue).sum());
    }

    private Spiel spieleAutomatischZuEnde(Spiel spiel) {
        Spiel aktuellesSpiel = spiel.teileKartenAus();
        while (aktuellesSpiel.naechsterVorbehaltSpieler().isPresent()) {
            aktuellesSpiel = aktuellesSpiel.meldeGesund(aktuellesSpiel.naechsterVorbehaltSpieler().orElseThrow());
        }
        aktuellesSpiel = aktuellesSpiel.loeseVorbehalteAuf();
        while (aktuellesSpiel.phase() == Spielphase.STICHPHASE) {
            SpielerPosition spieler = aktuellesSpiel.aktuellerSpieler().orElseThrow();
            Karte karte = aktuellesSpiel.gueltigeKartenFuer(spieler).getFirst();
            aktuellesSpiel = aktuellesSpiel.spieleKarte(spieler, karte);
        }
        return aktuellesSpiel.werteAus(punkteRechner);
    }
}
