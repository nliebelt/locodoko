package de.locodoko.partie;

import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartendeck;
import de.locodoko.karten.Spielregeln;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PartieTest {

    private final Spielregeln spielregeln = Spielregeln.standardRegeln();

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

    @Test
    void schliesseAktuellesSpielAbUndStarteNaechstesStartetNaechstesSpiel() {
        // Wichtig: Die kombinierte Methode muss in einem Aufruf auswerten, abschliessen UND das naechste Spiel starten —
        // sonst muss der Service diese drei Schritte koordinieren und kann Bockrunden-/Solo-Logik doppeln.
        Partie partie = Partie.neu(2, SpielerPosition.SUED, spielregeln);
        partie = partie.starteNaechstesSpiel(Kartendeck.neu(spielregeln));
        Spiel spielInAuswertung = spieleAutomatischZuEnde(partie.aktuellesSpiel());
        partie = partie.mitAktuellemSpiel(spielInAuswertung);

        Partie neuePartie = partie.schliesseAktuellesSpielAbUndStarteNaechstes();

        assertEquals(1, neuePartie.abgeschlosseneSpiele().size(),
            "Nach einem Spiel muss genau ein abgeschlossenes Spiel in der Partie vorliegen.");
        assertTrue(neuePartie.aktuellesSpielOptional().isPresent(),
            "Die Partie muss nach dem Abschluss ein neues laufendes Spiel besitzen.");
        assertEquals(SpielerPosition.WEST, neuePartie.naechsterGeber(),
            "Der Geber muss nach einem Normalspiel im Uhrzeigersinn rotieren.");
    }

    @Test
    void schliesseAktuellesSpielAbUndStarteNaechstesMarkiertPartieAlsBeendet() {
        // Wichtig: Die Partie muss nach dem letzten Spiel korrekt als beendet markiert werden —
        // ein Folgespiel darf nicht gestartet werden.
        Partie partie = Partie.neu(1, SpielerPosition.SUED, spielregeln);
        partie = partie.starteNaechstesSpiel(Kartendeck.neu(spielregeln));
        Spiel letztesspiel = spieleAutomatischZuEnde(partie.aktuellesSpiel());
        partie = partie.mitAktuellemSpiel(letztesspiel);

        Partie abgeschlossenePartie = partie.schliesseAktuellesSpielAbUndStarteNaechstes();

        assertTrue(abgeschlossenePartie.istBeendet(),
            "Nach dem letzten Spiel muss die Partie als beendet markiert sein.");
        assertTrue(abgeschlossenePartie.aktuellesSpielOptional().isEmpty(),
            "Nach einer beendeten Partie darf kein aktives Spiel mehr vorhanden sein.");
    }

    @Test
    void schliesseAktuellesSpielAbUndStarteNaechstesAkzeptiertGesamtstandPhase() {
        // Wichtig: Die Methode muss auch in GESAMTSTAND_AKTUALISIEREN Phase funktionieren —
        // damit bei einem Neustart nach einem abgewerteten Spiel kein Fehler auftritt.
        Partie partie = Partie.neu(2, SpielerPosition.SUED, spielregeln);
        partie = partie.starteNaechstesSpiel(Kartendeck.neu(spielregeln));
        Spiel spielNachWertung = spieleAutomatischZuEnde(partie.aktuellesSpiel());
        // spieleAutomatischZuEnde liefert bereits GESAMTSTAND_AKTUALISIEREN
        assertEquals(Spielphase.GESAMTSTAND_AKTUALISIEREN, spielNachWertung.phase(),
            "Hilfsmethode muss Spiel in GESAMTSTAND_AKTUALISIEREN liefern.");
        partie = partie.mitAktuellemSpiel(spielNachWertung);

        Partie neuePartie = partie.schliesseAktuellesSpielAbUndStarteNaechstes();

        assertEquals(1, neuePartie.abgeschlosseneSpiele().size());
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
        while (aktuellesSpiel.phase() instanceof Spielphase.Stichphase) {
            SpielerPosition spieler = aktuellesSpiel.aktuellerSpieler().orElseThrow();
            Karte karte = aktuellesSpiel.gueltigeKartenFuer(spieler).getFirst();
            aktuellesSpiel = aktuellesSpiel.spieleKarte(spieler, karte);
        }
        return aktuellesSpiel.werteAus();
    }

    private Spiel spieleAutomatischZuEnde(Spiel spiel) {
        Spiel aktuellesSpiel = spiel.teileKartenAus();
        while (aktuellesSpiel.naechsterVorbehaltSpieler().isPresent()) {
            aktuellesSpiel = aktuellesSpiel.meldeGesund(aktuellesSpiel.naechsterVorbehaltSpieler().orElseThrow());
        }
        aktuellesSpiel = aktuellesSpiel.loeseVorbehalteAuf();
        while (aktuellesSpiel.phase() instanceof Spielphase.Stichphase) {
            SpielerPosition spieler = aktuellesSpiel.aktuellerSpieler().orElseThrow();
            Karte karte = aktuellesSpiel.gueltigeKartenFuer(spieler).getFirst();
            aktuellesSpiel = aktuellesSpiel.spieleKarte(spieler, karte);
        }
        return aktuellesSpiel.werteAus();
    }
}
