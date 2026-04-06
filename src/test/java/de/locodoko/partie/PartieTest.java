package de.locodoko.partie;

import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartendeck;
import de.locodoko.karten.SpielerPosition;
import de.locodoko.karten.Spielregeln;
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

    @Test
    void geberBleibtNachSolo() {
        // Wichtig: Nach einem Solo darf der Geber NICHT rotieren — sichert Fairness der Geberkette.
        Partie partie = Partie.neu(2, SpielerPosition.SUED, spielregeln);
        partie = partie.starteNaechstesSpiel(Kartendeck.neu(spielregeln));
        partie = partie.mitAktuellemSpiel(spieleSoloZuEnde(partie.aktuellesSpiel(), SpielerPosition.WEST));
        partie = partie.schliesseAktuellesSpielAb();

        assertEquals(SpielerPosition.SUED, partie.naechsterGeber(),
            "Nach einem Solo muss der Geber gleich bleiben — kein Vorwaertsrotieren.");
    }

    @Test
    void solistSpieltNachSoloZuerstAuf() {
        // Wichtig: Der Solist muss nach dem Solo das Anspielrecht erhalten — sonst stimmt die Reihenfolge nicht.
        Partie partie = Partie.neu(2, SpielerPosition.SUED, spielregeln);
        SpielerPosition solist = SpielerPosition.OST;
        partie = partie.starteNaechstesSpiel(Kartendeck.neu(spielregeln));
        partie = partie.mitAktuellemSpiel(spieleSoloZuEnde(partie.aktuellesSpiel(), solist));
        partie = partie.schliesseAktuellesSpielAb();

        partie = partie.starteNaechstesSpiel(Kartendeck.neu(spielregeln));
        Spiel naechstesSpiel = partie.aktuellesSpiel().teileKartenAus();
        while (naechstesSpiel.naechsterVorbehaltSpieler().isPresent()) {
            naechstesSpiel = naechstesSpiel.meldeGesund(naechstesSpiel.naechsterVorbehaltSpieler().orElseThrow());
        }
        naechstesSpiel = naechstesSpiel.loeseVorbehalteAuf();

        assertEquals(solist, naechstesSpiel.aktuellerSpieler().orElseThrow(),
            "Der Solist muss im Folge-Spiel als erster Aufspieler fungieren.");
    }

    @Test
    void geberRotiertNachNormalspiel() {
        // Wichtig: Nach einem Normalspiel muss der Geber planmaessig rotieren — Regression gegen Solo-Logik.
        Partie partie = Partie.neu(2, SpielerPosition.SUED, spielregeln);
        partie = partie.starteNaechstesSpiel(Kartendeck.neu(spielregeln));
        partie = partie.mitAktuellemSpiel(spieleAutomatischZuEnde(partie.aktuellesSpiel()));
        partie = partie.schliesseAktuellesSpielAb();

        assertEquals(SpielerPosition.WEST, partie.naechsterGeber(),
            "Nach einem Normalspiel muss der Geber im Uhrzeigersinn rotieren.");
    }

    private Spiel spieleSoloZuEnde(Spiel spiel, SpielerPosition solist) {
        Spiel aktuellesSpiel = spiel.teileKartenAus();
        // Solist meldet SOLO_TRUMPF, alle anderen GESUND
        while (aktuellesSpiel.naechsterVorbehaltSpieler().isPresent()) {
            SpielerPosition naechster = aktuellesSpiel.naechsterVorbehaltSpieler().orElseThrow();
            aktuellesSpiel = naechster.equals(solist)
                ? aktuellesSpiel.meldeVorbehalt(naechster, VorbehaltAnsage.SOLO_TRUMPF)
                : aktuellesSpiel.meldeGesund(naechster);
        }
        aktuellesSpiel = aktuellesSpiel.loeseVorbehalteAuf();
        while (aktuellesSpiel.phase() == Spielphase.STICHPHASE) {
            SpielerPosition spieler = aktuellesSpiel.aktuellerSpieler().orElseThrow();
            Karte karte = aktuellesSpiel.gueltigeKartenFuer(spieler).getFirst();
            aktuellesSpiel = aktuellesSpiel.spieleKarte(spieler, karte);
        }
        return aktuellesSpiel.werteAus(punkteRechner);
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
