package de.locodoko.spiel.partie;

import de.locodoko.spiel.karten.Karte;
import de.locodoko.spiel.karten.Kartendeck;
import de.locodoko.spiel.karten.SpielerPosition;
import de.locodoko.spiel.karten.Spielregeln;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SpielTest {

    private final Spielregeln spielregeln = Spielregeln.standardRegeln();
    private final PunkteRechner punkteRechner = new PunkteRechner();

    @Test
    void durchlaeuftEinNormalspielVonDerAusteilungBisZurAuswertung() {
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, spielregeln, Kartendeck.neu(spielregeln));

        assertEquals(Spielphase.KARTEN_AUSTEILEN, spiel.phase(),
            "Ein neues Spiel muss mit dem Austeilen beginnen, damit spaetere Schnittstellen die Phasen stabil orchestrieren koennen.");

        spiel = spiel.teileKartenAus();
        assertEquals(Spielphase.VORBEHALT_ANSAGE, spiel.phase());
        assertEquals(12, spiel.handVon(SpielerPosition.SUED).karten().size(),
            "Jeder Spieler braucht im Normalspiel 12 Karten, weil darauf die komplette Stichfolge basiert.");

        for (SpielerPosition position : SpielerPosition.imUhrzeigersinnAb(SpielerPosition.WEST)) {
            assertEquals(position, spiel.naechsterVorbehaltSpieler().orElseThrow(),
                "Die Vorbehaltsrunde muss links vom Geber starten und im Uhrzeigersinn laufen.");
            spiel = spiel.meldeGesund(position);
        }
        assertEquals(Spielphase.VORBEHALT_AUFLOESUNG, spiel.phase());

        spiel = spiel.loeseVorbehalteAuf();
        assertEquals(Spielphase.STICHPHASE, spiel.phase());
        assertEquals(Partei.RE, spiel.parteien().parteiVon(SpielerPosition.SUED));
        assertEquals(Partei.RE, spiel.parteien().parteiVon(SpielerPosition.WEST));
        assertEquals(Partei.KONTRA, spiel.parteien().parteiVon(SpielerPosition.NORD));
        assertEquals(Partei.KONTRA, spiel.parteien().parteiVon(SpielerPosition.OST));
        assertTrue(spiel.parteien().sichtAufPartei(SpielerPosition.SUED, SpielerPosition.SUED).isPresent(),
            "Jeder Spieler muss seine eigene Partei kennen, damit Ansagen spaeter regelkonform moeglich sind.");
        assertTrue(spiel.parteien().sichtAufPartei(SpielerPosition.SUED, SpielerPosition.WEST).isEmpty(),
            "Andere Parteien bleiben zu Beginn verdeckt, damit das Normalspiel fachlich korrekt startet.");

        while (spiel.phase() == Spielphase.STICHPHASE) {
            SpielerPosition aktuellerSpieler = spiel.aktuellerSpieler().orElseThrow();
            Karte karte = spiel.gueltigeKartenFuer(aktuellerSpieler).getFirst();
            spiel = spiel.spieleKarte(aktuellerSpieler, karte);
        }

        assertEquals(12, spiel.abgeschlosseneStiche().size(),
            "Ein vollstaendiges Normalspiel braucht 12 Stiche, sonst kann keine belastbare Endauswertung stattfinden.");
        assertEquals(Spielphase.AUSWERTUNG, spiel.phase());

        spiel = spiel.werteAus(punkteRechner);

        assertEquals(Spielphase.GESAMTSTAND_AKTUALISIEREN, spiel.phase());
        Spielergebnis ergebnis = spiel.ergebnis().orElseThrow();
        assertEquals(240, ergebnis.augenVon(Partei.RE) + ergebnis.augenVon(Partei.KONTRA));
        assertEquals(0, ergebnis.spielpunkteVon(SpielerPosition.SUED)
            + ergebnis.spielpunkteVon(SpielerPosition.WEST)
            + ergebnis.spielpunkteVon(SpielerPosition.NORD)
            + ergebnis.spielpunkteVon(SpielerPosition.OST),
            "Die Nullsumme macht den Partiestand robust und verhindert schleichende Bewertungsfehler.");
        assertFalse(spiel.aktuellerStich().isPresent());
    }

    @Test
    void lehntUngueltigeZustandsuebergaengeAb() {
        Spiel spiel = Spiel.neu(SpielerPosition.OST, spielregeln, Kartendeck.neu(spielregeln));
        Spiel neuesSpiel = spiel;

        assertThrows(IllegalStateException.class, () -> neuesSpiel.meldeGesund(SpielerPosition.SUED),
            "Ohne ausgeteilte Karten darf kein Spieler Vorbehalte melden, sonst verliert die Zustandsmaschine ihre Autoritaet.");

        spiel = spiel.teileKartenAus();
        Spiel spielMitAusgeteiltenKarten = spiel;
        assertThrows(IllegalStateException.class, spielMitAusgeteiltenKarten::loeseVorbehalteAuf,
            "Vorbehalte duerfen erst nach vier Meldungen aufgeloest werden, damit kein Spieler uebersprungen wird.");

        spiel = spiel.meldeGesund(SpielerPosition.SUED)
            .meldeGesund(SpielerPosition.WEST)
            .meldeGesund(SpielerPosition.NORD)
            .meldeGesund(SpielerPosition.OST)
            .loeseVorbehalteAuf();

        Spiel laufendesStichspiel = spiel;
        assertThrows(IllegalStateException.class, () -> laufendesStichspiel.werteAus(punkteRechner),
            "Eine Auswertung vor dem letzten Stich wuerde unvollstaendige Augenstaende in den Gesamtstand schleusen.");
    }
}
