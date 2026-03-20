package de.locodoko.spiel.partie;

import de.locodoko.spiel.karten.Karte;
import de.locodoko.spiel.karten.Kartendeck;
import de.locodoko.spiel.karten.Kartenwert;
import de.locodoko.spiel.karten.SpielerPosition;
import de.locodoko.spiel.karten.Spielregeln;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

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

    @Test
    void laesstAnsagenNurFuerDenAktuellenSpielerUndNurImRegelkonformenFensterZu() {
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, spielregeln, kartendeckMitKontrolliertenHaenden())
            .teileKartenAus()
            .meldeGesund(SpielerPosition.WEST)
            .meldeGesund(SpielerPosition.NORD)
            .meldeGesund(SpielerPosition.OST)
            .meldeGesund(SpielerPosition.SUED)
            .loeseVorbehalteAuf();

        assertTrue(spiel.kannAnsagen(SpielerPosition.WEST, Ansage.RE),
            "Vor dem ersten Ausspiel muss der aktuelle Re-Spieler seine Partei ansagen koennen, sonst fehlen die Kernereignisse der Stichphase.");
        assertFalse(spiel.kannAnsagen(SpielerPosition.NORD, Ansage.KONTRA),
            "Nur der aktuelle Spieler darf ansagen, damit Reihenfolge und Zeitfenster an den echten Spielzug gekoppelt bleiben.");

        spiel = spiel.sageAn(SpielerPosition.WEST, Ansage.RE);
        assertTrue(spiel.ansagen().offenbartParteiVon(SpielerPosition.WEST),
            "Die Grundansage muss im Spielzustand festgehalten werden, damit UIs und Auswertung dieselbe Wahrheit sehen.");

        Spiel spielMitGespielterKarte = spiel.spieleKarte(SpielerPosition.WEST, spiel.gueltigeKartenFuer(SpielerPosition.WEST).getFirst());
        assertTrue(spielMitGespielterKarte.kannAnsagen(SpielerPosition.NORD, Ansage.KONTRA),
            "Nach dem Ausspiel muss der naechste aktuelle Spieler regelkonform eigene Ansagen taetigen koennen.");
    }

    private Kartendeck kartendeckMitKontrolliertenHaenden() {
        List<Karte> karten = new ArrayList<>();
        for (int index = 1; index <= 12; index++) {
            karten.add(karteFuerSpieler(index, SpielerPosition.SUED));
            karten.add(karteFuerSpieler(index, SpielerPosition.WEST));
            karten.add(karteFuerSpieler(index, SpielerPosition.NORD));
            karten.add(karteFuerSpieler(index, SpielerPosition.OST));
        }
        return kartendeckAus(karten);
    }

    private Karte karteFuerSpieler(int index, SpielerPosition spielerPosition) {
        return switch (spielerPosition) {
            case SUED -> index == 1 ? new Karte(de.locodoko.spiel.karten.Farbe.KREUZ, Kartenwert.DAME, 1)
                : neueKontrollkarte(index, spielerPosition, 1);
            case WEST -> index == 1 ? new Karte(de.locodoko.spiel.karten.Farbe.KREUZ, Kartenwert.DAME, 2)
                : neueKontrollkarte(index, spielerPosition, 2);
            case NORD -> index == 1 ? new Karte(de.locodoko.spiel.karten.Farbe.HERZ, Kartenwert.AS, 1)
                : neueKontrollkarte(index, spielerPosition, 1);
            case OST -> index == 1 ? new Karte(de.locodoko.spiel.karten.Farbe.PIK, Kartenwert.AS, 1)
                : neueKontrollkarte(index, spielerPosition, 2);
        };
    }

    private Karte neueKontrollkarte(int index, SpielerPosition spielerPosition, int exemplarIndex) {
        de.locodoko.spiel.karten.Farbe[] farben = de.locodoko.spiel.karten.Farbe.values();
        Kartenwert[] werte = Kartenwert.values();
        de.locodoko.spiel.karten.Farbe farbe = farben[(index + spielerPosition.ordinal()) % farben.length];
        Kartenwert wert = werte[(index + spielerPosition.ordinal()) % werte.length];
        if (farbe == de.locodoko.spiel.karten.Farbe.KREUZ && wert == Kartenwert.DAME) {
            wert = Kartenwert.AS;
        }
        return new Karte(
            farbe,
            wert,
            exemplarIndex
        );
    }

    private Kartendeck kartendeckAus(List<Karte> karten) {
        try {
            java.lang.reflect.Constructor<Kartendeck> konstruktor = Kartendeck.class.getDeclaredConstructor(java.util.Collection.class);
            konstruktor.setAccessible(true);
            return konstruktor.newInstance(karten);
        } catch (ReflectiveOperationException ausnahme) {
            throw new IllegalStateException("Kontrolliertes Kartendeck konnte nicht erzeugt werden", ausnahme);
        }
    }
}
