package de.locodoko.tisch;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import de.locodoko.karten.Farbe;
import de.locodoko.karten.Hand;
import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartendeck;
import de.locodoko.karten.Kartenwert;
import de.locodoko.karten.Spielregeln;
import de.locodoko.karten.Spieltyp;
import de.locodoko.partie.AnsageEreignis;
import de.locodoko.partie.Ansagen;
import de.locodoko.partie.GespielteKarte;
import de.locodoko.partie.Parteien;
import de.locodoko.partie.Partei;
import de.locodoko.partie.Partie;
import de.locodoko.partie.Spiel;
import de.locodoko.partie.Spielphase;
import de.locodoko.partie.Ansage;
import de.locodoko.partie.SpielerPosition;
import de.locodoko.partie.Stich;
import de.locodoko.partie.VorbehaltAnsage;
import de.locodoko.partie.VorbehaltMeldung;
import de.locodoko.spieler.SpielerEntity;
import org.junit.jupiter.api.Test;

import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.fail;

/**
 * Wire-Format-Pinning-Test für PartieStandAntwort.
 *
 * <p>Friert das JSON-Serialisierungsformat von {@link PartieStandAntwort} ein.
 * Jede Änderung an der JSON-Ausgabe (durch DOMAIN-3 oder spätere Refactorings)
 * bricht diesen Test — das ist gewollt: Änderungen müssen bewusst sein und
 * im Commit-Body dokumentiert werden.</p>
 *
 * <p>Beim ersten Lauf ohne Baseline-Datei schlägt der Test fehl und gibt die
 * aktuelle JSON-Ausgabe aus. Diese in
 * {@code src/test/resources/wire-format-baseline.json} speichern,
 * dann schlägt der Test nicht mehr fehl.</p>
 */
class PartieStandAntwortWireFormatTest {

    // Kein Spring-Kontext: Standard-ObjectMapper mit denselben Grundeinstellungen
    // wie Spring Boot (Enums als Strings, keine Timestamps).
    // ORDER_MAP_ENTRIES_BY_KEYS: EnumMap-Reihenfolge ist JVM-spezifisch — sortieren für Stabilität.
    private static final ObjectMapper MAPPER = new ObjectMapper()
        .enable(SerializationFeature.INDENT_OUTPUT)
        .enable(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS);

    // UUIDs und Avatar-Farben werden vor dem Vergleich normalisiert —
    // sonst schlägt der Test bei jedem Lauf wegen neuer Zufallswerte fehl.
    private static final Pattern UUID_MUSTER =
        Pattern.compile("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");
    private static final String FESTE_UUID = "00000000-0000-0000-0000-000000000000";

    private static final Pattern FARB_MUSTER = Pattern.compile("#[0-9a-fA-F]{6}");
    private static final String FESTE_FARBE = "#000000";

    private static String normalisiereUUIDs(String json) {
        String result = UUID_MUSTER.matcher(json).replaceAll(FESTE_UUID);
        return FARB_MUSTER.matcher(result).replaceAll(FESTE_FARBE);
    }

    /**
     * Schweinchen-Normalspiel: WEST hält beide Karo-Asse.
     *
     * <p>Repräsentativer Spielzustand für DOMAIN-3: deckt haendeAlsJson,
     * sticheAlsJson, Ansagen, Vorbehalte, aktuelle Stichmitte, schweinchenAktiv,
     * Parteien-Sicht und Spieler-Maskierung ab. Bei jedem DOMAIN-Schritt muss
     * dieser Test grün bleiben und die Baseline-JSON unverändert sein.</p>
     */
    @Test
    void wireFormatBleibtstabil() throws Exception {
        PartieStandAntwort antwort = erstelleRepräsentativenSpielstand();
        String jsonAktuell = normalisiereUUIDs(MAPPER.writeValueAsString(antwort));

        URL baselineUrl = getClass().getClassLoader().getResource("wire-format-baseline.json");
        if (baselineUrl == null) {
            // Erste Ausführung: Baseline automatisch anlegen
            Path zielPfad = Path.of("src/test/resources/wire-format-baseline.json");
            Files.writeString(zielPfad, jsonAktuell, StandardCharsets.UTF_8);
            fail("Baseline wurde neu angelegt unter " + zielPfad.toAbsolutePath() +
                " — Test erneut ausführen, dann muss er grün sein.");
        }

        String jsonBaseline = Files.readString(Path.of(baselineUrl.toURI()), StandardCharsets.UTF_8);
        assertEquals(jsonBaseline, jsonAktuell,
            "Wire-Format hat sich geändert. Wenn die Änderung bewusst ist: " +
            "wire-format-baseline.json aktualisieren und die Änderung im Commit-Body dokumentieren.");
    }

    private PartieStandAntwort erstelleRepräsentativenSpielstand() {
        SpielerEntity anna = SpielerEntity.menschlich("Anna", "session-anna");
        SpielerEntity benKi = SpielerEntity.ki("Ben-KI");
        SpielerEntity claraKi = SpielerEntity.ki("Clara-KI");
        SpielerEntity dirkKi = SpielerEntity.ki("Dirk-KI");

        TischEntity tisch = TischEntity.neu(
            "Wire-Format-Pinning-Test",
            anna,
            TischkonfigurationEmbeddable.ausSpielregeln(Spielregeln.standardRegeln(), 12)
        );
        tisch.fuegeSpielerHinzu(anna);     // SUED
        tisch.fuegeSpielerHinzu(benKi);    // WEST
        tisch.fuegeSpielerHinzu(claraKi);  // NORD
        tisch.fuegeSpielerHinzu(dirkKi);   // OST

        // Händeverteilung nach 2 abgeschlossenen Stichen (je 10 Karten).
        // WEST hält beide Karo-Asse → Schweinchen aktiv.
        Map<SpielerPosition, Hand> haende = Map.of(
            SpielerPosition.SUED, new Hand(List.of(
                new Karte(Farbe.KREUZ, Kartenwert.DAME, 1),
                new Karte(Farbe.HERZ, Kartenwert.ZEHN, 2),
                new Karte(Farbe.PIK, Kartenwert.AS, 1),
                new Karte(Farbe.PIK, Kartenwert.AS, 2),
                new Karte(Farbe.KREUZ, Kartenwert.KOENIG, 1),
                new Karte(Farbe.KREUZ, Kartenwert.KOENIG, 2),
                new Karte(Farbe.HERZ, Kartenwert.AS, 1),
                new Karte(Farbe.HERZ, Kartenwert.AS, 2),
                new Karte(Farbe.PIK, Kartenwert.KOENIG, 1),
                new Karte(Farbe.PIK, Kartenwert.DAME, 1)
            )),
            SpielerPosition.WEST, new Hand(List.of(
                new Karte(Farbe.KREUZ, Kartenwert.DAME, 2),
                new Karte(Farbe.KARO, Kartenwert.AS, 1),    // erstes Schweinchen
                new Karte(Farbe.KARO, Kartenwert.AS, 2),    // zweites Schweinchen
                new Karte(Farbe.HERZ, Kartenwert.BUBE, 1),
                new Karte(Farbe.HERZ, Kartenwert.BUBE, 2),
                new Karte(Farbe.PIK, Kartenwert.BUBE, 1),
                new Karte(Farbe.PIK, Kartenwert.BUBE, 2),
                new Karte(Farbe.KREUZ, Kartenwert.BUBE, 1),
                new Karte(Farbe.KREUZ, Kartenwert.AS, 1),
                new Karte(Farbe.PIK, Kartenwert.KOENIG, 2)
            )),
            SpielerPosition.NORD, new Hand(List.of(
                new Karte(Farbe.KARO, Kartenwert.DAME, 1),
                new Karte(Farbe.KARO, Kartenwert.DAME, 2),
                new Karte(Farbe.KARO, Kartenwert.BUBE, 1),
                new Karte(Farbe.KARO, Kartenwert.BUBE, 2),
                new Karte(Farbe.KARO, Kartenwert.ZEHN, 1),
                new Karte(Farbe.KARO, Kartenwert.KOENIG, 1),
                new Karte(Farbe.KARO, Kartenwert.KOENIG, 2),
                new Karte(Farbe.KARO, Kartenwert.NEUN, 1),
                new Karte(Farbe.HERZ, Kartenwert.KOENIG, 1),
                new Karte(Farbe.PIK, Kartenwert.NEUN, 1)
            )),
            SpielerPosition.OST, new Hand(List.of(
                new Karte(Farbe.KARO, Kartenwert.ZEHN, 2),
                new Karte(Farbe.KARO, Kartenwert.NEUN, 2),
                new Karte(Farbe.KREUZ, Kartenwert.BUBE, 2),
                new Karte(Farbe.KREUZ, Kartenwert.NEUN, 1),
                new Karte(Farbe.KREUZ, Kartenwert.NEUN, 2),
                new Karte(Farbe.PIK, Kartenwert.NEUN, 2),
                new Karte(Farbe.PIK, Kartenwert.ZEHN, 1),
                new Karte(Farbe.PIK, Kartenwert.ZEHN, 2),
                new Karte(Farbe.HERZ, Kartenwert.KOENIG, 2),
                new Karte(Farbe.HERZ, Kartenwert.NEUN, 1)
            ))
        );

        // Stich 1: SUED eröffnet mit Dulle (HERZ-ZEHN-1), WEST schlägt mit KREUZ-ZEHN-1
        Stich ersterStich = Stich.ausPersistiertemStand(SpielerPosition.SUED, List.of(
            new GespielteKarte(SpielerPosition.SUED, new Karte(Farbe.HERZ, Kartenwert.ZEHN, 1), 0),
            new GespielteKarte(SpielerPosition.WEST, new Karte(Farbe.KREUZ, Kartenwert.ZEHN, 1), 1),
            new GespielteKarte(SpielerPosition.NORD, new Karte(Farbe.HERZ, Kartenwert.DAME, 1), 2),
            new GespielteKarte(SpielerPosition.OST, new Karte(Farbe.PIK, Kartenwert.DAME, 2), 3)
        ));

        // Stich 2: WEST eröffnet (hat Stich 1 gewonnen durch KREUZ-ZEHN)
        Stich zweiterStich = Stich.ausPersistiertemStand(SpielerPosition.WEST, List.of(
            new GespielteKarte(SpielerPosition.WEST, new Karte(Farbe.KREUZ, Kartenwert.ZEHN, 2), 0),
            new GespielteKarte(SpielerPosition.NORD, new Karte(Farbe.HERZ, Kartenwert.DAME, 2), 1),
            new GespielteKarte(SpielerPosition.OST, new Karte(Farbe.HERZ, Kartenwert.NEUN, 2), 2),
            new GespielteKarte(SpielerPosition.SUED, new Karte(Farbe.KREUZ, Kartenwert.AS, 2), 3)
        ));

        // Aktiver Stich: SUED ist dran (leerer Stich, SUED eröffnet)
        Stich aktuellerStich = Stich.neu(SpielerPosition.SUED);

        // Parteien: SUED + WEST (je eine KREUZ-DAME) sind RE; SUED hat RE angesagt (offen)
        Parteien parteien = Parteien.ausParteiMap(Map.of(
            SpielerPosition.SUED, Partei.RE,
            SpielerPosition.WEST, Partei.RE,
            SpielerPosition.NORD, Partei.KONTRA,
            SpielerPosition.OST, Partei.KONTRA
        )).mitOffenenParteienFuerAlle(List.of(SpielerPosition.SUED));

        // Ansagen: SUED hat RE angesagt
        Ansagen ansagen = Ansagen.ausEreignissen(List.of(
            new AnsageEreignis(SpielerPosition.SUED, Ansage.RE)
        ));

        // Vorbehalte: alle 4 Spieler haben GESUND gemeldet
        List<VorbehaltMeldung> vorbehalte = List.of(
            new VorbehaltMeldung(SpielerPosition.SUED, VorbehaltAnsage.GESUND),
            new VorbehaltMeldung(SpielerPosition.WEST, VorbehaltAnsage.GESUND),
            new VorbehaltMeldung(SpielerPosition.NORD, VorbehaltAnsage.GESUND),
            new VorbehaltMeldung(SpielerPosition.OST, VorbehaltAnsage.GESUND)
        );

        Spielregeln spielregeln = Spielregeln.standardRegeln().mitSchweinchenAktiv(true);
        Kartendeck kartendeck = Kartendeck.neu(spielregeln);

        Spiel spiel = Spiel.ausPersistiertemStand(
            spielregeln,
            kartendeck,
            Spieltyp.NORMALSPIEL,
            SpielerPosition.SUED,
            new Spielphase.Stichphase(aktuellerStich, java.util.Set.of(), null),
            haende,
            vorbehalte,
            parteien,
            ansagen,
            List.of(ersterStich, zweiterStich),
            null,   // kein Ergebnis — Spiel läuft noch
            true,   // schweinchenAktiv
            null    // kein Solist-Aufspieler (Normalspiel)
        );
        spiel.setzeSpielNummer(1);

        Partie partie = Partie.neuePersistenz(12, Spielregeln.standardRegeln(), null);
        partie.fuegeSpielHinzu(spiel);
        tisch.setzePartie(partie);

        // Snapshot aus Annas Sicht (SUED): eigene Karten sichtbar, Gegner maskiert
        return PartieStandAntwort.aus(tisch, anna.id());
    }
}
