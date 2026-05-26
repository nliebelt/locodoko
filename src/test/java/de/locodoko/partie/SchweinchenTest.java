package de.locodoko.partie;

import de.locodoko.karten.Farbe;
import de.locodoko.karten.Hand;
import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartendeck;
import de.locodoko.karten.Kartenwert;
import de.locodoko.karten.SchweinchenTrumpfOrdnung;
import de.locodoko.karten.Spielregeln;
import de.locodoko.karten.TrumpfOrdnung;
import org.junit.jupiter.api.Test;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Tests fuer die Schweinchen-Regel.
 *
 * <p>Wenn ein Spieler beide Karo-Asse haelt und die Regel aktiv ist, werden die Karo-Asse
 * zu den staerksten Truempfen (oberhalb der Dulle). Gilt nur bei NORMALSPIEL.</p>
 */
class SchweinchenTest {

    private final Spielregeln mitSchweinchen = Spielregeln.standardRegeln().mitSchweinchenAktiv(true);
    private final Spielregeln ohneSchweinchen = Spielregeln.standardRegeln();

    private static final Karte KARO_AS_1 = new Karte(Farbe.KARO, Kartenwert.AS, 1);
    private static final Karte KARO_AS_2 = new Karte(Farbe.KARO, Kartenwert.AS, 2);
    private static final Karte DULLE = new Karte(Farbe.HERZ, Kartenwert.ZEHN, 1);

    // --- SchweinchenTrumpfOrdnung: Rang-Hierarchie ---

    @Test
    void schweinchenErstesStechtDulle() {
        // Wichtig: Das erste Schweinchen (Rang 14) muss hoechster Trumpf nach dem zweiten
        // Schweinchen sein. Ohne diesen Rang wuerden Stiche mit Karo-As falsch entschieden.
        TrumpfOrdnung ordnung = new SchweinchenTrumpfOrdnung(mitSchweinchen);

        assertTrue(ordnung.trumpfRang(KARO_AS_1) > ordnung.trumpfRang(DULLE),
            "Erstes Schweinchen (Rang 14) muss die Dulle (Rang 13) stechen.");
    }

    @Test
    void schweinchen_ZweitesSchlagtErstesUndBeidesUeberDulle() {
        // Wichtig: Zweites Schweinchen (Rang 15) muss erstes Schweinchen (Rang 14) schlagen.
        // Die Rangkette Dulle < Schweinchen_1 < Schweinchen_2 ist die korrekte Spec-Hierarchie.
        TrumpfOrdnung ordnung = new SchweinchenTrumpfOrdnung(mitSchweinchen);

        assertTrue(ordnung.trumpfRang(KARO_AS_2) > ordnung.trumpfRang(KARO_AS_1),
            "Zweites Schweinchen (Rang 15) muss das erste Schweinchen (Rang 14) stechen.");
        assertTrue(ordnung.trumpfRang(KARO_AS_1) > ordnung.trumpfRang(DULLE),
            "Erstes Schweinchen muss oberhalb der Dulle liegen.");
    }

    @Test
    void spaetereGleicheKarteGewinntFuerKaroAs() {
        // Wichtig: Analogie zur Dulle — das zweite Schweinchen schlaegt das erste im selben
        // Stich. Ohne spaetereGleicheKarteGewinnt=true wuerde die Stichlogik das zweite
        // Karo-As nicht als Sieger erkennen.
        TrumpfOrdnung ordnung = new SchweinchenTrumpfOrdnung(mitSchweinchen);

        assertTrue(ordnung.spaetereGleicheKarteGewinnt(KARO_AS_1),
            "Zweites Karo-As schlaegt das erste — analog zur Dulle-Regel.");
        assertTrue(ordnung.spaetereGleicheKarteGewinnt(KARO_AS_2),
            "Auch exemplarIndex 2 muss spaetereGleicheKarteGewinnt liefern.");
        // Dulle: standardRegeln haben zweiteDulleSticht=true → wird delegiert ohne Veraenderung
        assertTrue(ordnung.spaetereGleicheKarteGewinnt(DULLE),
            "SchweinchenTrumpfOrdnung delegiert Dulle-Verhalten unveraendert an NormaleTrumpfOrdnung (standardRegeln: zweiteDulleSticht=true).");
    }

    @Test
    void karoAsBleibtTrumpfInSchweinchenOrdnung() {
        // Wichtig: istTrumpf muss fuer Karo-As weiterhin true liefern, sonst kann die
        // Bedienpflicht-Logik Karo-As versehentlich als Fehlkarte einstufen.
        TrumpfOrdnung ordnung = new SchweinchenTrumpfOrdnung(mitSchweinchen);

        assertTrue(ordnung.istTrumpf(KARO_AS_1), "Karo-As ist und bleibt Trumpf.");
        assertTrue(ordnung.istTrumpf(KARO_AS_2), "Karo-As (Exemplar 2) ist und bleibt Trumpf.");
    }

    // --- Schweinchen-Erkennung beim Austeilen ---

    @Test
    void teileKartenAusSetzt_SchweinchenTrumpfOrdnungWennBeideKaroAsse() {
        // Wichtig: Die SchweinchenTrumpfOrdnung muss direkt nach dem Austeilen aktiv sein,
        // nicht erst nach loeseVorbehalteAuf. Sonst koennten in der Vorbehalt-Phase falsche
        // Karten als Trumpf eingestuft werden.
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, mitSchweinchen,
                kartendeckMitBeideKaroAsseAnWEST());
        spiel.teileKartenAus();

        assertInstanceOf(SchweinchenTrumpfOrdnung.class, spiel.trumpfOrdnung(),
            "Nach dem Austeilen muss SchweinchenTrumpfOrdnung aktiv sein wenn ein Spieler beide Karo-Asse haelt.");
    }

    @Test
    void teileKartenAusBehältNormaleTrumpfOrdnungWennKaroAsseVerteilt() {
        // Wichtig: Schweinchen darf nur aktiv werden wenn BEIDE Karo-Asse bei einem Spieler
        // liegen. Sind sie auf verschiedene Spieler verteilt, gilt die normale Rangordnung.
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, mitSchweinchen,
                kartendeckMitKaroAsseAufVerschiedeneSpieler());
        spiel.teileKartenAus();

        assertFalse(spiel.trumpfOrdnung() instanceof SchweinchenTrumpfOrdnung,
            "Keine SchweinchenTrumpfOrdnung wenn Karo-Asse auf zwei Spieler verteilt sind.");
    }

    @Test
    void teileKartenAusBehältNormaleTrumpfOrdnungWennRegelDeaktiviert() {
        // Wichtig: Schweinchen kann per Tischkonfiguration deaktiviert werden. Auch wenn
        // ein Spieler beide Karo-Asse haelt, muss die normale Rangordnung gelten.
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, ohneSchweinchen,
                kartendeckMitBeideKaroAsseAnWEST());
        spiel.teileKartenAus();

        assertFalse(spiel.trumpfOrdnung() instanceof SchweinchenTrumpfOrdnung,
            "Ohne schweinchenAktiv darf keine SchweinchenTrumpfOrdnung gesetzt werden.");
    }

    // --- Solo-Ausschluss ---

    @Test
    void soloTrumpfBehältSchweinchenWennSpielerBeideKaroAsseHat() {
        // Wichtig: Laut Spec gilt Schweinchen auch im Trumpfsolo (SOLO_TRUMPF), nicht nur im
        // Normalspiel. Wenn der Solo-Spieler beide Karo-Asse haelt, muss SchweinchenTrumpfOrdnung
        // aktiv bleiben — kein anderes Solo profitiert davon.
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, mitSchweinchen,
                kartendeckMitBeideKaroAsseAnWEST());
        spiel.teileKartenAus();
        spiel.meldeVorbehalt(SpielerPosition.WEST, VorbehaltAnsage.SOLO_TRUMPF);
        spiel.meldeGesund(SpielerPosition.NORD);
        spiel.meldeGesund(SpielerPosition.OST);
        spiel.meldeGesund(SpielerPosition.SUED);
        spiel.loeseVorbehalteAuf();

        assertInstanceOf(SchweinchenTrumpfOrdnung.class, spiel.trumpfOrdnung(),
            "Im SOLO_TRUMPF muss SchweinchenTrumpfOrdnung gelten wenn ein Spieler beide Karo-Asse haelt (Spec: Schweinchen gilt in Normalspiel und Trumpfsolo).");
        assertTrue(spiel.schweinchenAktiv(),
            "schweinchenAktiv() muss true sein (bestimmt was in die DB geschrieben wird).");
    }

    // --- Schweinchen bei Hochzeit und Armut ---

    @Test
    void hochzeitDeaktiviertSchweinchen() {
        // Wichtig: Laut Spec gilt Schweinchen NICHT bei Hochzeit. Selbst wenn ein anderer
        // Spieler beide Karo-Asse haelt, muss bei Hochzeit-Vorbehalt NormaleTrumpfOrdnung
        // verwendet werden. Ohne diesen Fix wuerde trumpfOrdnungFuer(HOCHZEIT) faelschlicherweise
        // SchweinchenTrumpfOrdnung setzen.
        Spielregeln regeln = mitSchweinchen.mitHochzeitAktiv(true);
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, regeln,
                kartendeckMitSchweinchenUndHochzeit());
        spiel.teileKartenAus();
        spiel.meldeGesund(SpielerPosition.WEST);
        spiel.meldeVorbehalt(SpielerPosition.NORD, VorbehaltAnsage.HOCHZEIT);
        spiel.meldeGesund(SpielerPosition.OST);
        spiel.meldeGesund(SpielerPosition.SUED);
        spiel.loeseVorbehalteAuf();

        assertFalse(spiel.trumpfOrdnung() instanceof SchweinchenTrumpfOrdnung,
            "Bei Hochzeit darf Schweinchen nicht aktiv sein — Spec schliesst Hochzeit und Armut aus.");
        assertFalse(spiel.schweinchenAktiv(),
            "schweinchenAktiv() muss false sein damit Persistenz kein Schweinchen wiederhersteilt.");
    }

    @Test
    void armutDeaktiviertSchweinchen() {
        // Wichtig: Laut Spec gilt Schweinchen NICHT bei Armut — weder bei Vorbehalt-Aufloesung
        // noch nach dem Kartentausch. Auch wenn nach dem Tausch ein Spieler beide Karo-Asse haelt,
        // bleibt NormaleTrumpfOrdnung aktiv. Ohne diesen Fix wuerde nimmArmutAn() bei passendem
        // Tausch SchweinchenTrumpfOrdnung aktivieren.
        Spielregeln regeln = mitSchweinchen.mitArmutAktiv(true);
        Karte herzBube1 = new Karte(Farbe.HERZ, Kartenwert.BUBE, 1);
        Karte pikAs1 = new Karte(Farbe.PIK, Kartenwert.AS, 1);
        Karte pikAs2 = new Karte(Farbe.PIK, Kartenwert.AS, 2);

        // OST hat Armut: nur 2 Truempfe (Herz-Bube + Karo-Bube), rest Fehlkarten
        // WEST hat beide Karo-Asse → würde Schweinchen ergeben, aber nicht in Armut
        Kartendeck deck = kartendeckMitVerteiltenHaenden(Map.of(
            SpielerPosition.WEST, List.of(KARO_AS_1, KARO_AS_2, KREUZ_DAME_1),
            SpielerPosition.NORD, List.of(KREUZ_DAME_2),
            SpielerPosition.OST, List.of(herzBube1, new Karte(Farbe.KARO, Kartenwert.BUBE, 1),
                pikAs1, pikAs2,
                new Karte(Farbe.KREUZ, Kartenwert.AS, 1), new Karte(Farbe.KREUZ, Kartenwert.AS, 2),
                new Karte(Farbe.KREUZ, Kartenwert.ZEHN, 1), new Karte(Farbe.KREUZ, Kartenwert.ZEHN, 2),
                new Karte(Farbe.KREUZ, Kartenwert.KOENIG, 1), new Karte(Farbe.KREUZ, Kartenwert.KOENIG, 2),
                new Karte(Farbe.PIK, Kartenwert.KOENIG, 1), new Karte(Farbe.PIK, Kartenwert.KOENIG, 2))
        ));
        Spiel nachVorbehalten = Spiel.neu(SpielerPosition.SUED, regeln, deck);
        nachVorbehalten.teileKartenAus();
        nachVorbehalten.meldeGesund(SpielerPosition.WEST);
        nachVorbehalten.meldeGesund(SpielerPosition.NORD);
        nachVorbehalten.meldeVorbehalt(SpielerPosition.OST, VorbehaltAnsage.ARMUT);
        nachVorbehalten.meldeGesund(SpielerPosition.SUED);
        nachVorbehalten.loeseVorbehalteAuf();

        assertFalse(nachVorbehalten.trumpfOrdnung() instanceof SchweinchenTrumpfOrdnung,
            "Bei Armut darf Schweinchen nicht aktiv sein — Spec schliesst Hochzeit und Armut aus.");

        // OST bietet seine 2 Truempfe an — mutiert nachVorbehalten direkt
        nachVorbehalten.legeArmutTrumpfkarten(SpielerPosition.OST,
            List.of(herzBube1, new Karte(Farbe.KARO, Kartenwert.BUBE, 1)));

        // SUED nimmt an, gibt 2 Fehlkarten zurueck
        Hand suedHand = nachVorbehalten.handVon(SpielerPosition.SUED);
        List<Karte> rueckgabe = suedHand.karten().stream()
            .filter(k -> !nachVorbehalten.trumpfOrdnung().istTrumpf(k))
            .limit(2)
            .toList();
        nachVorbehalten.nimmArmutAn(SpielerPosition.SUED, rueckgabe);

        // Auch nach dem Tausch: Armut nutzt nie Schweinchen, egal wer die Karo-Asse hat
        assertFalse(nachVorbehalten.trumpfOrdnung() instanceof SchweinchenTrumpfOrdnung,
            "Nach Armut-Kartentausch darf Schweinchen weiterhin nicht aktiv sein — Armut-Spiele nutzen immer NormaleTrumpfOrdnung.");
        assertFalse(nachVorbehalten.schweinchenAktiv(),
            "schweinchenAktiv() muss false sein.");
    }

    @Test
    void schweinchenBleibtAktivNachNormalemLoeseVorbehalteAuf() {
        // Wichtig: Wenn kein Vorbehalt gemeldet wird (alle GESUND), muss die SchweinchenTrumpfOrdnung
        // aus teileKartenAus() unveraendert in die Stichphase uebernommen werden.
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, mitSchweinchen,
                kartendeckMitBeideKaroAsseAnWEST());
        spiel.teileKartenAus();
        spiel.meldeGesund(SpielerPosition.WEST);
        spiel.meldeGesund(SpielerPosition.NORD);
        spiel.meldeGesund(SpielerPosition.OST);
        spiel.meldeGesund(SpielerPosition.SUED);
        spiel.loeseVorbehalteAuf();

        assertInstanceOf(SchweinchenTrumpfOrdnung.class, spiel.trumpfOrdnung(),
            "Nach allen GESUND-Meldungen muss SchweinchenTrumpfOrdnung erhalten bleiben.");
    }

    @Test
    void schweinchenKaroAsHatHoeherenRangAlsDulleImLaufendenSpiel() {
        // Wichtig: End-to-End-Pruefung: Im laufenden Normalspiel mit Schweinchen muss
        // die aktive TrumpfOrdnung das Karo-As tatsaechlich hoeher als die Dulle werten.
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, mitSchweinchen,
                kartendeckMitBeideKaroAsseAnWEST());
        spiel.teileKartenAus();
        spiel.meldeGesund(SpielerPosition.WEST);
        spiel.meldeGesund(SpielerPosition.NORD);
        spiel.meldeGesund(SpielerPosition.OST);
        spiel.meldeGesund(SpielerPosition.SUED);
        spiel.loeseVorbehalteAuf();

        assertTrue(
            spiel.trumpfOrdnung().trumpfRang(KARO_AS_1) > spiel.trumpfOrdnung().trumpfRang(DULLE),
            "Im laufenden Spiel mit Schweinchen muss Karo-As die Dulle stechen.");
        assertEquals(14, spiel.trumpfOrdnung().trumpfRang(KARO_AS_1));
        assertEquals(15, spiel.trumpfOrdnung().trumpfRang(KARO_AS_2));
    }

    @Test
    void stichGewinner_SchweinchenSchlagtDulleUndZweitesSchweinchenSchlagtErstes() {
        // Wichtig: Kern-Regressionstest fuer den Spielbetrieb. Die SchweinchenTrumpfOrdnung muss
        // nicht nur korrekte Raenge ausgeben, sondern die Stichlogik (Stich.gewinner()) muss
        // tatsaechlich den richtigen Gewinner ermitteln. Dieser Test verifiziert den
        // End-to-End-Pfad von der TrumpfOrdnung bis zur Stich-Entscheidung.
        TrumpfOrdnung ordnung = new SchweinchenTrumpfOrdnung(mitSchweinchen);
        Karte kreuzBube1 = new Karte(Farbe.KREUZ, Kartenwert.BUBE, 1);
        Karte kreuzBube2 = new Karte(Farbe.KREUZ, Kartenwert.BUBE, 2);

        // Fall 1: zweites Schweinchen (Rang 15) schlaegt erstes (Rang 14) und Dulle (Rang 13)
        Stich stich1 = Stich.neu(SpielerPosition.WEST);
        stich1 = stich1.spieleKarte(SpielerPosition.WEST, DULLE,
            new Hand(List.of(DULLE)), ordnung);
        stich1 = stich1.spieleKarte(SpielerPosition.NORD, KARO_AS_1,
            new Hand(List.of(KARO_AS_1)), ordnung);
        stich1 = stich1.spieleKarte(SpielerPosition.OST, kreuzBube1,
            new Hand(List.of(kreuzBube1)), ordnung);
        stich1 = stich1.spieleKarte(SpielerPosition.SUED, KARO_AS_2,
            new Hand(List.of(KARO_AS_2)), ordnung);

        assertEquals(SpielerPosition.SUED, stich1.gewinner(ordnung).spieler(),
            "Zweites Schweinchen (Rang 15) muss Stich gewinnen — schlaegt erstes Schweinchen (14) und Dulle (13).");

        // Fall 2: erstes Schweinchen (Rang 14) schlaegt Dulle (Rang 13) wenn kein zweites gespielt
        Stich stich2 = Stich.neu(SpielerPosition.WEST);
        stich2 = stich2.spieleKarte(SpielerPosition.WEST, DULLE,
            new Hand(List.of(DULLE)), ordnung);
        stich2 = stich2.spieleKarte(SpielerPosition.NORD, KARO_AS_1,
            new Hand(List.of(KARO_AS_1)), ordnung);
        stich2 = stich2.spieleKarte(SpielerPosition.OST, kreuzBube1,
            new Hand(List.of(kreuzBube1)), ordnung);
        stich2 = stich2.spieleKarte(SpielerPosition.SUED, kreuzBube2,
            new Hand(List.of(kreuzBube2)), ordnung);

        assertEquals(SpielerPosition.NORD, stich2.gewinner(ordnung).spieler(),
            "Erstes Schweinchen (Rang 14) muss Dulle (Rang 13) schlagen wenn kein zweites Schweinchen gespielt wird.");
    }

    @Test
    void spieleKarteErzeugtSchweinchenGemeldetBeimErstenKaroAs() {
        // Wichtig: Laut DKV-Regeln wird das Schweinchen erst beim ersten Ausspielen eines
        // Karo-Asses "gemeldet". Das Domain-Modell muss dieses Ereignis als SpielEreignis liefern.
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, mitSchweinchen,
                kartendeckMitBeideKaroAsseAnWEST());
        spiel.teileKartenAus();
        spiel.meldeGesund(SpielerPosition.WEST);
        spiel.meldeGesund(SpielerPosition.NORD);
        spiel.meldeGesund(SpielerPosition.OST);
        spiel.meldeGesund(SpielerPosition.SUED);
        spiel.loeseVorbehalteAuf();

        // WEST spielt das erste Karo-As
        List<SpielEreignis> ereignisse1 = spiel.spieleKarte(SpielerPosition.WEST, KARO_AS_1);

        assertTrue(ereignisse1.stream()
            .anyMatch(e -> e instanceof SpielEreignis.SchweinchenGemeldet s
                && s.spielerPosition() == SpielerPosition.WEST),
            "Beim ersten Karo-As muss ein SchweinchenGemeldet-Ereignis erzeugt werden.");

        // NORD spielt eine Karte (kein Karo-As)
        Karte herzZehn = spiel.handVon(SpielerPosition.NORD).karten().stream()
                .filter(k -> k.farbe() == Farbe.HERZ && k.wert() == Kartenwert.ZEHN)
                .findFirst().orElseThrow();
        List<SpielEreignis> ereignisse2 = spiel.spieleKarte(SpielerPosition.NORD, herzZehn);

        assertFalse(ereignisse2.stream()
            .anyMatch(e -> e instanceof SpielEreignis.SchweinchenGemeldet),
            "Beim zweiten Spieler (kein Karo-As) darf kein SchweinchenGemeldet-Ereignis kommen.");
            
        // ... (Optional: Zweites Karo-As pruefen)
    }

    // --- Hilfsmethoden ---

    private static final Karte KREUZ_DAME_1 = new Karte(Farbe.KREUZ, Kartenwert.DAME, 1);
    private static final Karte KREUZ_DAME_2 = new Karte(Farbe.KREUZ, Kartenwert.DAME, 2);

    private Kartendeck kartendeckMitBeideKaroAsseAnWEST() {
        // Kreuz-Damen explizit aufteilen, damit kein stilles Solo entsteht
        return kartendeckMitVerteiltenHaenden(Map.of(
            SpielerPosition.WEST, List.of(KARO_AS_1, KARO_AS_2),
            SpielerPosition.SUED, List.of(KREUZ_DAME_1),
            SpielerPosition.NORD, List.of(KREUZ_DAME_2)
        ));
    }

    private Kartendeck kartendeckMitSchweinchenUndHochzeit() {
        // WEST hat beide Karo-Asse (Schweinchen), NORD hat beide Kreuz-Damen (Hochzeit)
        return kartendeckMitVerteiltenHaenden(Map.of(
            SpielerPosition.WEST, List.of(KARO_AS_1, KARO_AS_2),
            SpielerPosition.NORD, List.of(KREUZ_DAME_1, KREUZ_DAME_2)
        ));
    }

    private Kartendeck kartendeckMitKaroAsseAufVerschiedeneSpieler() {
        return kartendeckMitVerteiltenHaenden(Map.of(
            SpielerPosition.WEST, List.of(KARO_AS_1),
            SpielerPosition.NORD, List.of(KARO_AS_2)
        ));
    }

    private Kartendeck kartendeckMitVerteiltenHaenden(Map<SpielerPosition, List<Karte>> vorgaben) {
        Spielregeln basisregeln = Spielregeln.standardRegeln();
        EnumMap<SpielerPosition, List<Karte>> haende = new EnumMap<>(SpielerPosition.class);
        for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
            haende.put(position, new ArrayList<>(vorgaben.getOrDefault(position, List.of())));
        }

        List<Karte> restkarten = new ArrayList<>(Kartendeck.neu(basisregeln).karten());
        for (List<Karte> karten : haende.values()) {
            for (Karte karte : karten) {
                if (!restkarten.remove(karte)) {
                    throw new IllegalArgumentException("Vorgegebene Karte ist nicht verfuegbar: " + karte);
                }
            }
        }

        for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
            while (haende.get(position).size() < 12) {
                haende.get(position).add(restkarten.removeFirst());
            }
        }

        List<Karte> deckkarten = new ArrayList<>();
        for (int index = 0; index < 12; index++) {
            for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
                deckkarten.add(haende.get(position).get(index));
            }
        }

        return kartendeckAus(deckkarten);
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
