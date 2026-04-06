package de.locodoko.partie;

import de.locodoko.karten.Farbe;
import de.locodoko.karten.GespielteKarte;
import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartendeck;
import de.locodoko.karten.Kartenwert;
import de.locodoko.karten.SpielerPosition;
import de.locodoko.karten.Spielregeln;
import de.locodoko.karten.Spieltyp;
import de.locodoko.karten.Stich;
import de.locodoko.partie.AnsageEreignis;
import org.junit.jupiter.api.Test;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class BockrundenTest {

    private final Spielregeln spielregelOhneBockrunden = Spielregeln.standardRegeln();
    private final Spielregeln spielregelnMitBockrunden = Spielregeln.standardRegeln().mitBockrundenAktiv(true);
    private final PunkteRechner punkteRechner = new PunkteRechner();

    // --- hatHerzDurchgegangenenStich ---

    @Test
    void hatHerzDurchgegangenenStichErkenntStichMitVierFehlherzKarten() {
        // Wichtig: Sichert ab dass der Trigger nicht von echten Spielen abhaengig ist
        // und nur Fehlherz (nicht Trumpf) zaehlt.
        Stich herzStich = Stich.ausPersistiertemStand(SpielerPosition.WEST, List.of(
            new GespielteKarte(SpielerPosition.WEST,  new Karte(Farbe.HERZ, Kartenwert.AS,     1), 1),
            new GespielteKarte(SpielerPosition.NORD,  new Karte(Farbe.HERZ, Kartenwert.KOENIG, 1), 2),
            new GespielteKarte(SpielerPosition.OST,   new Karte(Farbe.HERZ, Kartenwert.KOENIG, 2), 3),
            new GespielteKarte(SpielerPosition.SUED,  new Karte(Farbe.HERZ, Kartenwert.AS,     2), 4)
        ));
        Spiel spiel = spielMitAbgeschlossenenStichen(spielregelOhneBockrunden, List.of(herzStich));

        assertTrue(spiel.hatHerzDurchgegangenenStich(),
            "Ein Stich mit vier Fehlherz-Karten muss als Herz-durchgegangen erkannt werden.");
    }

    @Test
    void hatHerzDurchgegangenenStichIgnoriertTrumpfkarten() {
        // Wichtig: Herz-Zehn ist die Dulle (Trumpf), kein Fehlherz — kein Trigger.
        Stich trumpfStich = Stich.ausPersistiertemStand(SpielerPosition.WEST, List.of(
            new GespielteKarte(SpielerPosition.WEST,  new Karte(Farbe.HERZ, Kartenwert.ZEHN,   1), 1),
            new GespielteKarte(SpielerPosition.NORD,  new Karte(Farbe.HERZ, Kartenwert.KOENIG, 1), 2),
            new GespielteKarte(SpielerPosition.OST,   new Karte(Farbe.HERZ, Kartenwert.KOENIG, 2), 3),
            new GespielteKarte(SpielerPosition.SUED,  new Karte(Farbe.HERZ, Kartenwert.AS,     1), 4)
        ));
        Spiel spiel = spielMitAbgeschlossenenStichen(spielregelOhneBockrunden, List.of(trumpfStich));

        assertFalse(spiel.hatHerzDurchgegangenenStich(),
            "Ein Stich mit einer Trumpf-Herz-Karte darf nicht als Herz-durchgegangen zaehlen.");
    }

    @Test
    void hatHerzDurchgegangenenStichIgnoriertStichMitNichtHerzKarte() {
        // Wichtig: Karo-As ist Trumpf, kein Fehlherz — gemischter Stich kein Trigger.
        Stich gemischterStich = Stich.ausPersistiertemStand(SpielerPosition.WEST, List.of(
            new GespielteKarte(SpielerPosition.WEST,  new Karte(Farbe.KARO, Kartenwert.AS,     1), 1),
            new GespielteKarte(SpielerPosition.NORD,  new Karte(Farbe.HERZ, Kartenwert.KOENIG, 1), 2),
            new GespielteKarte(SpielerPosition.OST,   new Karte(Farbe.HERZ, Kartenwert.KOENIG, 2), 3),
            new GespielteKarte(SpielerPosition.SUED,  new Karte(Farbe.HERZ, Kartenwert.AS,     1), 4)
        ));
        Spiel spiel = spielMitAbgeschlossenenStichen(spielregelOhneBockrunden, List.of(gemischterStich));

        assertFalse(spiel.hatHerzDurchgegangenenStich(),
            "Ein Stich mit einer Nicht-Herz-Karte darf nicht als Herz-durchgegangen zaehlen.");
    }

    // --- Partie: bockrundenZaehler Startzustand ---

    @Test
    void neuePartieStartetMitBockrundenZaehlerNull() {
        Partie partie = Partie.neu(4, SpielerPosition.SUED, spielregelnMitBockrunden);
        assertEquals(0, partie.bockrundenZaehler(),
            "Eine neue Partie muss mit bockrundenZaehler=0 starten.");
    }

    @Test
    void bockrundenZaehlerBleibtNullOhneBockrundenRegel() {
        // Wichtig: Wenn bockrundenAktiv=false, darf kein Trigger ausgeloest werden,
        // auch wenn Herz-durchgegangen eintritt.
        Stich herzStich = Stich.ausPersistiertemStand(SpielerPosition.WEST, List.of(
            new GespielteKarte(SpielerPosition.WEST,  new Karte(Farbe.HERZ, Kartenwert.AS,     1), 1),
            new GespielteKarte(SpielerPosition.NORD,  new Karte(Farbe.HERZ, Kartenwert.KOENIG, 1), 2),
            new GespielteKarte(SpielerPosition.OST,   new Karte(Farbe.HERZ, Kartenwert.KOENIG, 2), 3),
            new GespielteKarte(SpielerPosition.SUED,  new Karte(Farbe.HERZ, Kartenwert.AS,     2), 4)
        ));
        Spielergebnis ergebnis = normalspielErgebnis(Partei.RE, 1);
        Parteien parteien = normalspielParteien();
        Spiel abgeschlossenesSpiel = spielMitErgebnisUndStichen(
            spielregelOhneBockrunden, parteien, Ansagen.leer(), List.of(herzStich), ergebnis);

        Partie partie = Partie.neu(2, SpielerPosition.SUED, spielregelOhneBockrunden);
        partie = partie.starteNaechstesSpiel(Kartendeck.neu(spielregelOhneBockrunden));
        partie = partie.mitAktuellemSpiel(abgeschlossenesSpiel);
        partie = partie.schliesseAktuellesSpielAb();

        assertEquals(0, partie.bockrundenZaehler(),
            "Wenn bockrundenAktiv=false, darf kein Bockrunden-Trigger ausgeloest werden.");
    }

    // --- Partie: Trigger-Erkennung ---

    @Test
    void bockrundenZaehlerWirdNachHerzDurchgegangenErhoeh() {
        // Wichtig: Trigger "Herz durchgegangen" muss bockrundenZaehler auf 1 setzen.
        Stich herzStich = Stich.ausPersistiertemStand(SpielerPosition.WEST, List.of(
            new GespielteKarte(SpielerPosition.WEST,  new Karte(Farbe.HERZ, Kartenwert.AS,     1), 1),
            new GespielteKarte(SpielerPosition.NORD,  new Karte(Farbe.HERZ, Kartenwert.KOENIG, 1), 2),
            new GespielteKarte(SpielerPosition.OST,   new Karte(Farbe.HERZ, Kartenwert.KOENIG, 2), 3),
            new GespielteKarte(SpielerPosition.SUED,  new Karte(Farbe.HERZ, Kartenwert.AS,     2), 4)
        ));
        Spielergebnis ergebnis = normalspielErgebnis(Partei.RE, 1);
        Parteien parteien = normalspielParteien();
        Spiel abgeschlossenesSpiel = spielMitErgebnisUndStichen(
            spielregelnMitBockrunden, parteien, Ansagen.leer(), List.of(herzStich), ergebnis);

        Partie partie = Partie.neu(2, SpielerPosition.SUED, spielregelnMitBockrunden);
        partie = partie.starteNaechstesSpiel(Kartendeck.neu(spielregelnMitBockrunden));
        partie = partie.mitAktuellemSpiel(abgeschlossenesSpiel);
        partie = partie.schliesseAktuellesSpielAb();

        assertEquals(1, partie.bockrundenZaehler(),
            "Herz-durchgegangen-Trigger muss bockrundenZaehler um 1 erhoehen.");
    }

    @Test
    void bockrundenZaehlerWirdNachVerlorenemKontraErhoeht() {
        // Wichtig: "Verlorenes Kontra" (RE gewinnt obwohl KONTRA angesagt wurde) triggert Bockrunde.
        Parteien parteien = normalspielParteien();
        Ansagen kontraAngesagt = ansagenMitKontra(parteien);
        Spielergebnis reGewinnt = normalspielErgebnis(Partei.RE, 2); // RE gewinnt nach Kontra: spielwert 2

        Spiel abgeschlossenesSpiel = spielMitErgebnisUndStichen(
            spielregelnMitBockrunden, parteien, kontraAngesagt, List.of(), reGewinnt);

        Partie partie = Partie.neu(2, SpielerPosition.SUED, spielregelnMitBockrunden);
        partie = partie.starteNaechstesSpiel(Kartendeck.neu(spielregelnMitBockrunden));
        partie = partie.mitAktuellemSpiel(abgeschlossenesSpiel);
        partie = partie.schliesseAktuellesSpielAb();

        assertEquals(1, partie.bockrundenZaehler(),
            "Verlorenes-Kontra-Trigger muss bockrundenZaehler um 1 erhoehen.");
    }

    @Test
    void beideTriggerGleichzeitigErhoehenzaehlerUmZwei() {
        // Wichtig: Beide Trigger koennen im selben Spiel auftreten und summieren sich (+2).
        Stich herzStich = Stich.ausPersistiertemStand(SpielerPosition.WEST, List.of(
            new GespielteKarte(SpielerPosition.WEST,  new Karte(Farbe.HERZ, Kartenwert.AS,     1), 1),
            new GespielteKarte(SpielerPosition.NORD,  new Karte(Farbe.HERZ, Kartenwert.KOENIG, 1), 2),
            new GespielteKarte(SpielerPosition.OST,   new Karte(Farbe.HERZ, Kartenwert.KOENIG, 2), 3),
            new GespielteKarte(SpielerPosition.SUED,  new Karte(Farbe.HERZ, Kartenwert.AS,     2), 4)
        ));
        Parteien parteien = normalspielParteien();
        Ansagen kontraAngesagt = ansagenMitKontra(parteien);
        Spielergebnis reGewinntNachKontra = normalspielErgebnis(Partei.RE, 2);

        Spiel abgeschlossenesSpiel = spielMitErgebnisUndStichen(
            spielregelnMitBockrunden, parteien, kontraAngesagt, List.of(herzStich), reGewinntNachKontra);

        Partie partie = Partie.neu(2, SpielerPosition.SUED, spielregelnMitBockrunden);
        partie = partie.starteNaechstesSpiel(Kartendeck.neu(spielregelnMitBockrunden));
        partie = partie.mitAktuellemSpiel(abgeschlossenesSpiel);
        partie = partie.schliesseAktuellesSpielAb();

        assertEquals(2, partie.bockrundenZaehler(),
            "Beide Trigger im selben Spiel muessen den Zaehler um 2 erhoehen.");
    }

    // --- Partie: Multiplikation + Dekrementierung ---

    @Test
    void bockrundenMultipliziertPunkteUndDekrementiertZaehler() {
        // Wichtig: Wenn bockrundenZaehler > 0, werden Spielpunkte verdoppelt und Zaehler dekrementiert.
        // Spiel 1: Herz-durchgegangen → bockrundenZaehler wird 1
        Stich herzStich = Stich.ausPersistiertemStand(SpielerPosition.WEST, List.of(
            new GespielteKarte(SpielerPosition.WEST,  new Karte(Farbe.HERZ, Kartenwert.AS,     1), 1),
            new GespielteKarte(SpielerPosition.NORD,  new Karte(Farbe.HERZ, Kartenwert.KOENIG, 1), 2),
            new GespielteKarte(SpielerPosition.OST,   new Karte(Farbe.HERZ, Kartenwert.KOENIG, 2), 3),
            new GespielteKarte(SpielerPosition.SUED,  new Karte(Farbe.HERZ, Kartenwert.AS,     2), 4)
        ));
        Parteien parteien = normalspielParteien();
        // RE gewinnt mit +1 pro RE-Spieler, -1 pro KONTRA-Spieler
        Spielergebnis ergebnis1 = normalspielErgebnis(Partei.RE, 1);

        Spiel spiel1 = spielMitErgebnisUndStichen(
            spielregelnMitBockrunden, parteien, Ansagen.leer(), List.of(herzStich), ergebnis1);

        Partie partie = Partie.neu(4, SpielerPosition.SUED, spielregelnMitBockrunden);
        partie = partie.starteNaechstesSpiel(Kartendeck.neu(spielregelnMitBockrunden));
        partie = partie.mitAktuellemSpiel(spiel1);
        partie = partie.schliesseAktuellesSpielAb();

        assertEquals(1, partie.bockrundenZaehler(), "Nach Spiel 1 muss bockrundenZaehler=1 sein.");

        // Spiel 2: Bockrunde aktiv → Punkte werden verdoppelt, Zaehler dekrementiert
        Spielergebnis ergebnis2 = normalspielErgebnis(Partei.RE, 1);
        Spiel spiel2 = spielMitErgebnisUndStichen(
            spielregelnMitBockrunden, parteien, Ansagen.leer(), List.of(), ergebnis2);

        Map<SpielerPosition, Integer> gesamtstandVorSpiel2 = partie.gesamtpunktestand();

        partie = partie.starteNaechstesSpiel(Kartendeck.neu(spielregelnMitBockrunden));
        partie = partie.mitAktuellemSpiel(spiel2);
        partie = partie.schliesseAktuellesSpielAb();

        assertEquals(0, partie.bockrundenZaehler(),
            "Nach dem Bockrunden-Spiel muss bockrundenZaehler dekrementiert werden.");

        // RE-Spieler (SUED, NORD): +2 (doppelt wegen Bockrunde statt +1), KONTRA (WEST, OST): -2
        int differenzSued = partie.gesamtpunktestand().get(SpielerPosition.SUED)
            - gesamtstandVorSpiel2.get(SpielerPosition.SUED);
        assertEquals(2, differenzSued,
            "In einer Bockrunde muss der Spielpunkt fuer RE-Spieler verdoppelt werden.");

        int differenzWest = partie.gesamtpunktestand().get(SpielerPosition.WEST)
            - gesamtstandVorSpiel2.get(SpielerPosition.WEST);
        assertEquals(-2, differenzWest,
            "In einer Bockrunde muss der Spielpunkt fuer KONTRA-Spieler ebenfalls verdoppelt werden.");
    }

    // --- Hilfsmethoden ---

    private Spiel spielMitAbgeschlossenenStichen(Spielregeln regeln, List<Stich> stiche) {
        return Spiel.ausPersistiertemStand(
            regeln,
            Kartendeck.neu(regeln),
            Spieltyp.NORMALSPIEL,
            SpielerPosition.SUED,
            Spielphase.STICHPHASE,
            Map.of(),
            List.of(),
            null,
            Ansagen.leer(),
            stiche,
            null,
            null,
            null,
            null,
            Set.of(),
            false
        );
    }

    private Spiel spielMitErgebnisUndStichen(
        Spielregeln regeln,
        Parteien parteien,
        Ansagen ansagen,
        List<Stich> stiche,
        Spielergebnis ergebnis
    ) {
        return Spiel.ausPersistiertemStand(
            regeln,
            Kartendeck.neu(regeln),
            Spieltyp.NORMALSPIEL,
            SpielerPosition.SUED,
            Spielphase.GESAMTSTAND_AKTUALISIEREN,
            Map.of(),
            List.of(),
            parteien,
            ansagen,
            stiche,
            null,
            ergebnis,
            null,
            null,
            Set.of(),
            false
        );
    }

    /**
     * Erzeugt ein Normalspiel-Ergebnis bei dem RE gewinnt.
     * RE: SUED und NORD (je +spielwert), KONTRA: WEST und OST (je -spielwert).
     */
    private Spielergebnis normalspielErgebnis(Partei sieger, int spielwert) {
        EnumMap<Partei, Integer> augen = new EnumMap<>(Partei.class);
        augen.put(Partei.RE, 121);
        augen.put(Partei.KONTRA, 119);

        int reMultiplikator = sieger == Partei.RE ? 1 : -1;
        EnumMap<SpielerPosition, Integer> spielpunkte = new EnumMap<>(SpielerPosition.class);
        spielpunkte.put(SpielerPosition.SUED, reMultiplikator * spielwert);
        spielpunkte.put(SpielerPosition.NORD, reMultiplikator * spielwert);
        spielpunkte.put(SpielerPosition.WEST, -reMultiplikator * spielwert);
        spielpunkte.put(SpielerPosition.OST,  -reMultiplikator * spielwert);

        EnumMap<Partei, List<SonderpunktEreignis>> sonderpunkte = new EnumMap<>(Partei.class);
        sonderpunkte.put(Partei.RE, List.of());
        sonderpunkte.put(Partei.KONTRA, List.of());

        return new Spielergebnis(augen, sieger, spielwert, spielwert, 0, 0, 1, spielpunkte, sonderpunkte);
    }

    /** Normalspiel-Parteien: SUED+NORD=RE, WEST+OST=KONTRA. */
    private Parteien normalspielParteien() {
        EnumMap<SpielerPosition, Partei> map = new EnumMap<>(SpielerPosition.class);
        map.put(SpielerPosition.SUED, Partei.RE);
        map.put(SpielerPosition.NORD, Partei.RE);
        map.put(SpielerPosition.WEST, Partei.KONTRA);
        map.put(SpielerPosition.OST,  Partei.KONTRA);
        return Parteien.ausParteiMap(map);
    }

    /** Erzeugt Ansagen-Objekt mit einer KONTRA-Grundansage von WEST. */
    private Ansagen ansagenMitKontra(Parteien parteien) {
        return Ansagen.ausEreignissen(List.of(
            new AnsageEreignis(SpielerPosition.WEST, Ansage.KONTRA)
        ));
    }

}
