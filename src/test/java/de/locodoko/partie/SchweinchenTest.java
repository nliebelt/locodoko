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
                kartendeckMitBeideKaroAsseAnWEST())
            .teileKartenAus();

        assertInstanceOf(SchweinchenTrumpfOrdnung.class, spiel.trumpfOrdnung(),
            "Nach dem Austeilen muss SchweinchenTrumpfOrdnung aktiv sein wenn ein Spieler beide Karo-Asse haelt.");
    }

    @Test
    void teileKartenAusBehältNormaleTrumpfOrdnungWennKaroAsseVerteilt() {
        // Wichtig: Schweinchen darf nur aktiv werden wenn BEIDE Karo-Asse bei einem Spieler
        // liegen. Sind sie auf verschiedene Spieler verteilt, gilt die normale Rangordnung.
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, mitSchweinchen,
                kartendeckMitKaroAsseAufVerschiedeneSpieler())
            .teileKartenAus();

        assertFalse(spiel.trumpfOrdnung() instanceof SchweinchenTrumpfOrdnung,
            "Keine SchweinchenTrumpfOrdnung wenn Karo-Asse auf zwei Spieler verteilt sind.");
    }

    @Test
    void teileKartenAusBehältNormaleTrumpfOrdnungWennRegelDeaktiviert() {
        // Wichtig: Schweinchen kann per Tischkonfiguration deaktiviert werden. Auch wenn
        // ein Spieler beide Karo-Asse haelt, muss die normale Rangordnung gelten.
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, ohneSchweinchen,
                kartendeckMitBeideKaroAsseAnWEST())
            .teileKartenAus();

        assertFalse(spiel.trumpfOrdnung() instanceof SchweinchenTrumpfOrdnung,
            "Ohne schweinchenAktiv darf keine SchweinchenTrumpfOrdnung gesetzt werden.");
    }

    // --- Solo-Ausschluss ---

    @Test
    void loeseVorbehalteAufVerwirftSchweinchenBeiSolo() {
        // Wichtig: Bei einem Solo wird eine eigene TrumpfOrdnung gesetzt (z.B. Damensolo,
        // Bubensolo). Auch wenn vor dem Vorbehalt Schweinchen erkannt wurde, muss die
        // Solo-TrumpfOrdnung SchweinchenTrumpfOrdnung ersetzen.
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, mitSchweinchen,
                kartendeckMitBeideKaroAsseAnWEST())
            .teileKartenAus()
            .meldeVorbehalt(SpielerPosition.WEST, VorbehaltAnsage.SOLO_TRUMPF)
            .meldeGesund(SpielerPosition.NORD)
            .meldeGesund(SpielerPosition.OST)
            .meldeGesund(SpielerPosition.SUED)
            .loeseVorbehalteAuf();

        assertFalse(spiel.trumpfOrdnung() instanceof SchweinchenTrumpfOrdnung,
            "Im SOLO_TRUMPF muss die normale TrumpfOrdnung gelten — kein Schweinchen-Vorteil fuer Solo-Spieler.");
    }

    @Test
    void schweinchenBleibtAktivNachNormalemLoeseVorbehalteAuf() {
        // Wichtig: Wenn kein Vorbehalt gemeldet wird (alle GESUND), muss die SchweinchenTrumpfOrdnung
        // aus teileKartenAus() unveraendert in die Stichphase uebernommen werden.
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, mitSchweinchen,
                kartendeckMitBeideKaroAsseAnWEST())
            .teileKartenAus()
            .meldeGesund(SpielerPosition.WEST)
            .meldeGesund(SpielerPosition.NORD)
            .meldeGesund(SpielerPosition.OST)
            .meldeGesund(SpielerPosition.SUED)
            .loeseVorbehalteAuf();

        assertInstanceOf(SchweinchenTrumpfOrdnung.class, spiel.trumpfOrdnung(),
            "Nach allen GESUND-Meldungen muss SchweinchenTrumpfOrdnung erhalten bleiben.");
    }

    @Test
    void schweinchenKaroAsHatHoeherenRangAlsDulleImLaufendenSpiel() {
        // Wichtig: End-to-End-Pruefung: Im laufenden Normalspiel mit Schweinchen muss
        // die aktive TrumpfOrdnung das Karo-As tatsaechlich hoeher als die Dulle werten.
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, mitSchweinchen,
                kartendeckMitBeideKaroAsseAnWEST())
            .teileKartenAus()
            .meldeGesund(SpielerPosition.WEST)
            .meldeGesund(SpielerPosition.NORD)
            .meldeGesund(SpielerPosition.OST)
            .meldeGesund(SpielerPosition.SUED)
            .loeseVorbehalteAuf();

        assertTrue(
            spiel.trumpfOrdnung().trumpfRang(KARO_AS_1) > spiel.trumpfOrdnung().trumpfRang(DULLE),
            "Im laufenden Spiel mit Schweinchen muss Karo-As die Dulle stechen.");
        assertEquals(14, spiel.trumpfOrdnung().trumpfRang(KARO_AS_1));
        assertEquals(15, spiel.trumpfOrdnung().trumpfRang(KARO_AS_2));
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
