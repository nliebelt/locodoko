package de.locodoko.partie;

import de.locodoko.karten.Farbe;
import de.locodoko.karten.Hand;
import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartenwert;
import de.locodoko.karten.SpielerPosition;
import de.locodoko.karten.Spielregeln;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AnsagenTest {

    private final Parteien parteien = Parteien.ausNormalspielHaenden(Map.of(
        SpielerPosition.SUED, new Hand(java.util.List.of(kreuzDame(1))),
        SpielerPosition.WEST, new Hand(java.util.List.of(kreuzDame(2))),
        SpielerPosition.NORD, new Hand(java.util.List.of(herzAs(1))),
        SpielerPosition.OST, new Hand(java.util.List.of(pikAs(1)))
    ));

    @Test
    void erlaubtNurRegelkonformeGrundansagenUndAbsagen() {
        Spielregeln spielregeln = Spielregeln.standardRegeln();
        Ansagen ansagen = Ansagen.leer();

        assertTrue(ansagen.kannAnsagen(SpielerPosition.SUED, Ansage.RE, parteien, spielregeln, 11),
            "Ein Re-Spieler muss seine Partei rechtzeitig offenbaren koennen, damit die spaetere Wertung zur Ansage passt.");
        assertFalse(ansagen.kannAnsagen(SpielerPosition.NORD, Ansage.RE, parteien, spielregeln, 11),
            "Die Gegenpartei darf keine fremde Grundansage taetigen, sonst waere die Parteilogik fachlich wertlos.");
        assertFalse(ansagen.kannAnsagen(SpielerPosition.SUED, Ansage.KEINE_90, parteien, spielregeln, 10),
            "Absagen brauchen immer zuerst eine Grundansage, damit die Verschaerfung einer Partei zuordenbar bleibt.");

        ansagen = ansagen.fuegeHinzu(SpielerPosition.SUED, Ansage.RE, parteien, spielregeln, 11);

        assertTrue(ansagen.offenbartParteiVon(SpielerPosition.SUED),
            "Eine Re-Ansage muss die Partei des ansagenden Spielers sichtbar machen, weil genau das Fachereignis transportiert wird.");
        assertTrue(ansagen.kannAnsagen(SpielerPosition.WEST, Ansage.KEINE_90, parteien, spielregeln, 10));
        assertFalse(ansagen.kannAnsagen(SpielerPosition.WEST, Ansage.KEINE_60, parteien, spielregeln, 10),
            "Die Ansagereihenfolge darf keine Stufe ueberspringen, sonst verliert die Eskalation ihre Bedeutung.");
        assertFalse(ansagen.kannAnsagen(SpielerPosition.WEST, Ansage.KEINE_90, parteien, spielregeln, 9),
            "Die Mindestkartenanzahl begrenzt Ansagen zeitlich und verhindert spaete Gratis-Informationen.");
        Ansagen finaleAnsagen = ansagen;
        assertThrows(IllegalStateException.class,
            () -> finaleAnsagen.fuegeHinzu(SpielerPosition.WEST, Ansage.KEINE_60, parteien, spielregeln, 9));
    }

    @Test
    void berücksichtigtPerTischKonfigurierteAnsagegrenzen() {
        // WARUM: Die Mindestkartenanzahlen sind Teil der Tischkonfiguration und muessen pro Tisch
        // konfigurierbar sein. Dieser Test beweist, dass Ansagen.kannAnsagen() die konkreten
        // Spielregelwerte des Tisches nutzt und nicht hartcodierte Defaults — sonst koennte eine
        // veraenderte Tischkonfiguration niemals wirksam werden.
        Spielregeln lockereSpieltregeln = Spielregeln.standardRegeln().mitAnsagegrenzen(5, 4, 3, 2, 1);
        Ansagen ansagen = Ansagen.leer();

        // Mit gelockerten Grenzen: 5 Karten genuegen fuer Re/Kontra
        assertTrue(ansagen.kannAnsagen(SpielerPosition.SUED, Ansage.RE, parteien, lockereSpieltregeln, 5),
            "Per-Tisch reduzierte Ansagegrenzen muessen tatsaechlich verwendet werden, damit die Konfiguration wirksam ist.");
        assertTrue(ansagen.kannAnsagen(SpielerPosition.NORD, Ansage.KONTRA, parteien, lockereSpieltregeln, 5),
            "Die gelockerte Kontra-Grenze muss auch fuer die Gegenpartei gelten.");
        // Mit Standardgrenzen: 5 Karten reichen nicht mehr fuer Re (11 erforderlich)
        assertFalse(ansagen.kannAnsagen(SpielerPosition.SUED, Ansage.RE, parteien, Spielregeln.standardRegeln(), 5),
            "Standardregeln erfordern 11 Karten fuer Re — dieser Kontrast beweist, dass die Tischkonfiguration den Unterschied macht.");
    }

    @Test
    void verschiebtZeitfensterOhneNeunenUmZweiKartenNachUnten() {
        Spielregeln spielregeln = Spielregeln.ohneNeunenRegeln();
        Ansagen ansagen = Ansagen.leer()
            .fuegeHinzu(SpielerPosition.NORD, Ansage.KONTRA, parteien, spielregeln, 9);

        assertTrue(ansagen.kannAnsagen(SpielerPosition.OST, Ansage.KEINE_90, parteien, spielregeln, 8),
            "Ohne Neunen hat jeder Spieler zwei Karten weniger; die Ansagefenster muessen sich exakt mitverschieben.");
        assertFalse(ansagen.kannAnsagen(SpielerPosition.OST, Ansage.KEINE_90, parteien, spielregeln, 7));
    }

    private Karte kreuzDame(int exemplar) {
        return new Karte(Farbe.KREUZ, Kartenwert.DAME, exemplar);
    }

    private Karte herzAs(int exemplar) {
        return new Karte(Farbe.HERZ, Kartenwert.AS, exemplar);
    }

    private Karte pikAs(int exemplar) {
        return new Karte(Farbe.PIK, Kartenwert.AS, exemplar);
    }
}
