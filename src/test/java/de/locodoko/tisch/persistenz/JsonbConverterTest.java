package de.locodoko.tisch.persistenz;

import com.fasterxml.jackson.databind.ObjectMapper;
import de.locodoko.karten.Farbe;
import de.locodoko.karten.Hand;
import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartenwert;
import de.locodoko.karten.Spielregeln;
import de.locodoko.partie.AnsageEreignis;
import de.locodoko.partie.Ansage;
import de.locodoko.partie.Ansagen;
import de.locodoko.partie.ArmutStatus;
import de.locodoko.partie.GespielteKarte;
import de.locodoko.partie.HochzeitStatus;
import de.locodoko.partie.Partei;
import de.locodoko.partie.Parteien;
import de.locodoko.partie.SpielerPosition;
import de.locodoko.partie.Stich;
import de.locodoko.partie.VorbehaltAnsage;
import de.locodoko.partie.VorbehaltMeldung;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Roundtrip-Tests fuer alle JSONB-Converter-Paare.
 *
 * <p>Jeder Test prueft: Domain-VO → String/JSON (via SchreibConverter) → Domain-VO (via StringLeseConverter)
 * und stellt sicher, dass die rekonstruierte Instanz inhaltlich identisch mit der urspruenglichen ist.
 * Kein Spring-Kontext noetig — reine Jackson-Serialisierungslogik.</p>
 */
class JsonbConverterTest {

    private ObjectMapper mapper;

    @BeforeEach
    void setUp() {
        // Gleiche Konfiguration wie in JsonbConverterKonfiguration — Spring-freie ObjectMapper-Instanz
        mapper = JsonbConverter.konfiguriereObjectMapper(new ObjectMapper());
    }

    // --- Hilfsmethoden fuer Testdaten ---

    private static Karte kreuzDame1() {
        return new Karte(Farbe.KREUZ, Kartenwert.DAME, 1);
    }

    private static Karte herz10() {
        return new Karte(Farbe.HERZ, Kartenwert.ZEHN, 1);
    }

    // ---- Test 1: Hand ----

    /**
     * Warum wichtig: Hand ist ein final class mit privatem internen Zustand.
     * Der Mixin-basierte JsonCreator muss den Konstruktor korrekt belegen und
     * die karten()-Liste muss nach dem Roundtrip identisch sein.
     */
    @Test
    void hand_wirdAlsJsonbRoundtrip_korrektRekonstruiert() {
        Hand hand = new Hand(List.of(kreuzDame1(), herz10()));
        var schreibConverter = new JsonbConverter.HaendeSchreibConverter(mapper);

        Map<SpielerPosition, Hand> haende = new EnumMap<>(SpielerPosition.class);
        haende.put(SpielerPosition.NORD, hand);
        haende.put(SpielerPosition.SUED, new Hand(List.of(new Karte(Farbe.PIK, Kartenwert.AS, 1))));

        String jsonString = schreibConverter.convert(haende);
        Map<SpielerPosition, Hand> rekonstruiert = new JsonbConverter.HaendeStringLeseConverter(mapper).convert(jsonString);

        assertThat(rekonstruiert.get(SpielerPosition.NORD).karten()).isEqualTo(hand.karten());
        assertThat(rekonstruiert.get(SpielerPosition.SUED).karten()).hasSize(1);
    }

    // ---- Test 2: Stich (einzeln) ----

    /**
     * Warum wichtig: Stich hat einen privaten Konstruktor — nur via ausPersistiertemStand()
     * rekonstruierbar. Der Mixin muss diese Factory als JsonCreator markieren und die Getter
     * als Properties. Ein falscher Aufspieler oder falsche gespielteKarten wuerden auf
     * fehlerhafte Serialisierung hinweisen.
     */
    @Test
    void stich_wirdAlsJsonbRoundtrip_korrektRekonstruiert() {
        GespielteKarte gespielteKarte = new GespielteKarte(SpielerPosition.NORD, kreuzDame1(), 0);
        Stich stich = Stich.ausPersistiertemStand(SpielerPosition.NORD, List.of(gespielteKarte));
        var schreibConverter = new JsonbConverter.StichSchreibConverter(mapper);

        String jsonString = schreibConverter.convert(stich);
        Stich rekonstruiert = new JsonbConverter.StichStringLeseConverter(mapper).convert(jsonString);

        assertThat(rekonstruiert.aufspieler()).isEqualTo(SpielerPosition.NORD);
        assertThat(rekonstruiert.gespielteKarten()).hasSize(1);
        assertThat(rekonstruiert.gespielteKarten().get(0).karte()).isEqualTo(kreuzDame1());
        assertThat(rekonstruiert.gespielteKarten().get(0).spieler()).isEqualTo(SpielerPosition.NORD);
    }

    // ---- Test 3: List<Stich> ----

    /**
     * Warum wichtig: abgeschlossene_stiche ist eine Liste abgeschlossener Stiche.
     * Der Converter muss die Typinformation (TypeReference) korrekt uebergeben,
     * damit Jackson jeden Stich als vollstaendigen Stich-Typ deserialisiert.
     */
    @Test
    void stichListe_wirdAlsJsonbRoundtrip_korrektRekonstruiert() {
        Stich stich1 = Stich.ausPersistiertemStand(SpielerPosition.NORD, List.of(
                new GespielteKarte(SpielerPosition.NORD, kreuzDame1(), 0)));
        Stich stich2 = Stich.ausPersistiertemStand(SpielerPosition.WEST, List.of());
        var schreibConverter = new JsonbConverter.StichListeSchreibConverter(mapper);

        String jsonString = schreibConverter.convert(List.of(stich1, stich2));
        List<Stich> rekonstruiert = new JsonbConverter.StichListeStringLeseConverter(mapper).convert(jsonString);

        assertThat(rekonstruiert).hasSize(2);
        assertThat(rekonstruiert.get(0).aufspieler()).isEqualTo(SpielerPosition.NORD);
        assertThat(rekonstruiert.get(1).aufspieler()).isEqualTo(SpielerPosition.WEST);
    }

    // ---- Test 4: List<VorbehaltMeldung> ----

    /**
     * Warum wichtig: VorbehaltMeldung ist ein Record — Jackson unterstuetzt Records
     * nativ. Dieser Test stellt sicher, dass Enum-Felder (SpielerPosition, VorbehaltAnsage)
     * korrekt serialisiert und deserialisiert werden.
     */
    @Test
    void vorbehaltMeldungListe_wirdAlsJsonbRoundtrip_korrektRekonstruiert() {
        VorbehaltMeldung meldung1 = new VorbehaltMeldung(SpielerPosition.NORD, VorbehaltAnsage.GESUND);
        VorbehaltMeldung meldung2 = new VorbehaltMeldung(SpielerPosition.OST, VorbehaltAnsage.HOCHZEIT);
        var schreibConverter = new JsonbConverter.VorbehaltMeldungListeSchreibConverter(mapper);

        String jsonString = schreibConverter.convert(List.of(meldung1, meldung2));
        List<VorbehaltMeldung> rekonstruiert = new JsonbConverter.VorbehaltMeldungListeStringLeseConverter(mapper).convert(jsonString);

        assertThat(rekonstruiert).hasSize(2);
        assertThat(rekonstruiert.get(0)).isEqualTo(meldung1);
        assertThat(rekonstruiert.get(1)).isEqualTo(meldung2);
    }

    // ---- Test 5: Ansagen ----

    /**
     * Warum wichtig: Ansagen-Objekte haben einen privaten Konstruktor. Der Mixin
     * muss ausEreignissen() als JsonCreator markieren. AnsageEreignis ist ein Record
     * mit zwei Enum-Feldern — wichtig fuer korrektes Enum-Mapping.
     */
    @Test
    void ansagen_wirdAlsJsonbRoundtrip_korrektRekonstruiert() {
        AnsageEreignis ereignis1 = new AnsageEreignis(SpielerPosition.NORD, Ansage.RE);
        AnsageEreignis ereignis2 = new AnsageEreignis(SpielerPosition.OST, Ansage.KONTRA);
        Ansagen ansagen = Ansagen.ausEreignissen(List.of(ereignis1, ereignis2));
        var schreibConverter = new JsonbConverter.AnsagenSchreibConverter(mapper);

        String jsonString = schreibConverter.convert(ansagen);
        Ansagen rekonstruiert = new JsonbConverter.AnsagenStringLeseConverter(mapper).convert(jsonString);

        assertThat(rekonstruiert.ereignisse()).hasSize(2);
        assertThat(rekonstruiert.ereignisse().get(0).spieler()).isEqualTo(SpielerPosition.NORD);
        assertThat(rekonstruiert.ereignisse().get(0).ansage()).isEqualTo(Ansage.RE);
        assertThat(rekonstruiert.ereignisse().get(1).ansage()).isEqualTo(Ansage.KONTRA);
    }

    // ---- Test 6: Parteien ----

    /**
     * Warum wichtig: Parteien ist das komplexeste VO — zwei interne Felder (Map und Set)
     * mit nicht-standardmaessigen Getter-Namen. Der Mixin muss alsMap() unter
     * "parteienNachSpieler" und offenFuerAlle() korrekt serialisieren. Ohne diesen
     * Converter wuerde ein leeres JSON-Objekt entstehen.
     */
    @Test
    void parteien_wirdAlsJsonbRoundtrip_korrektRekonstruiert() {
        Map<SpielerPosition, Partei> parteienMap = new EnumMap<>(SpielerPosition.class);
        parteienMap.put(SpielerPosition.NORD, Partei.RE);
        parteienMap.put(SpielerPosition.OST, Partei.RE);
        parteienMap.put(SpielerPosition.SUED, Partei.KONTRA);
        parteienMap.put(SpielerPosition.WEST, Partei.KONTRA);
        Parteien parteien = Parteien.ausPersistiertemStand(parteienMap, Set.of(SpielerPosition.NORD));
        var schreibConverter = new JsonbConverter.ParteienSchreibConverter(mapper);

        String jsonString = schreibConverter.convert(parteien);
        Parteien rekonstruiert = new JsonbConverter.ParteienStringLeseConverter(mapper).convert(jsonString);

        assertThat(rekonstruiert.parteiVon(SpielerPosition.NORD)).isEqualTo(Partei.RE);
        assertThat(rekonstruiert.parteiVon(SpielerPosition.SUED)).isEqualTo(Partei.KONTRA);
        assertThat(rekonstruiert.offenFuerAlle()).containsExactly(SpielerPosition.NORD);
    }

    // ---- Test 7: Set<SpielerPosition> ----

    /**
     * Warum wichtig: bereits_geschmissen enthaelt nullbasiert 0-4 Positionen.
     * Enum-Sets werden als JSON-Arrays serialisiert — der Converter muss Set-TypeReference
     * verwenden, damit Jackson die Elemente korrekt als SpielerPosition-Enums deserialisiert.
     */
    @Test
    void spielerPositionSet_wirdAlsJsonbRoundtrip_korrektRekonstruiert() {
        Set<SpielerPosition> positionen = EnumSet.of(SpielerPosition.NORD, SpielerPosition.OST);
        var schreibConverter = new JsonbConverter.SpielerPositionSetSchreibConverter(mapper);

        String jsonString = schreibConverter.convert(positionen);
        Set<SpielerPosition> rekonstruiert = new JsonbConverter.SpielerPositionSetStringLeseConverter(mapper).convert(jsonString);

        assertThat(rekonstruiert).containsExactlyInAnyOrder(SpielerPosition.NORD, SpielerPosition.OST);
    }

    // ---- Test 8: Set<Partei> ----

    /**
     * Warum wichtig: pflicht_ansage_ausstehend kann RE, KONTRA oder beide enthalten.
     * Sicherstellt, dass der Set<Partei>-Converter unabhaengig vom Set<SpielerPosition>-
     * Converter korrekt funktioniert — beide konvertieren PGobject → Set<Enum>, aber
     * mit unterschiedlichen Ziel-Enum-Typen.
     */
    @Test
    void parteiSet_wirdAlsJsonbRoundtrip_korrektRekonstruiert() {
        Set<Partei> parteien = EnumSet.of(Partei.RE);
        var schreibConverter = new JsonbConverter.ParteiSetSchreibConverter(mapper);

        String jsonString = schreibConverter.convert(parteien);
        Set<Partei> rekonstruiert = new JsonbConverter.ParteiSetStringLeseConverter(mapper).convert(jsonString);

        assertThat(rekonstruiert).containsExactly(Partei.RE);
    }

    // ---- Test 9: ArmutStatus ----

    /**
     * Warum wichtig: ArmutStatus ist ein Record mit einem nullable-Feld (partnerSpieler).
     * Dieser Test prueft den Fall ohne Partner (null) und stellt sicher, dass Jackson
     * den null-Wert korrekt serialisiert und deserialisiert. Falsche Handhabung von null
     * wuerde beim Laden aus der DB zu einem NPE im Compact-Konstruktor fuehren.
     */
    @Test
    void armutStatus_ohnePartner_wirdAlsJsonbRoundtrip_korrektRekonstruiert() {
        ArmutStatus status = ArmutStatus.gestartet(SpielerPosition.NORD);
        var schreibConverter = new JsonbConverter.ArmutStatusSchreibConverter(mapper);

        String jsonString = schreibConverter.convert(status);
        ArmutStatus rekonstruiert = new JsonbConverter.ArmutStatusStringLeseConverter(mapper).convert(jsonString);

        assertThat(rekonstruiert.armutSpieler()).isEqualTo(SpielerPosition.NORD);
        assertThat(rekonstruiert.partnerSpieler()).isNull();
        assertThat(rekonstruiert.aktuellerIndex()).isEqualTo(0);
        assertThat(rekonstruiert.abfrageReihenfolge()).hasSize(3);
    }

    // ---- Test 10: HochzeitStatus ----

    /**
     * Warum wichtig: HochzeitStatus hat ebenfalls nullable-Felder (partnerSpieler)
     * und einen boolean (stillesSolo). Wichtig: die Compact-Konstruktor-Validierung
     * darf bei Deserialisierung nicht faelschlicherweise ausloesen.
     */
    @Test
    void hochzeitStatus_wirdAlsJsonbRoundtrip_korrektRekonstruiert() {
        HochzeitStatus status = HochzeitStatus.gestartet(SpielerPosition.WEST);
        var schreibConverter = new JsonbConverter.HochzeitStatusSchreibConverter(mapper);

        String jsonString = schreibConverter.convert(status);
        HochzeitStatus rekonstruiert = new JsonbConverter.HochzeitStatusStringLeseConverter(mapper).convert(jsonString);

        assertThat(rekonstruiert.hochzeitSpieler()).isEqualTo(SpielerPosition.WEST);
        assertThat(rekonstruiert.geklaerteStiche()).isEqualTo(0);
        assertThat(rekonstruiert.partnerSpieler()).isNull();
        assertThat(rekonstruiert.stillesSolo()).isFalse();
    }

    // ---- Test 11: Spielregeln ----

    /**
     * Warum wichtig: Spielregeln ist ein Record mit 21 Feldern. Dieser Test stellt
     * sicher, dass kein Feld beim Roundtrip verloren geht und dass die Preset-Methoden
     * nach Deserialisierung identische Objekte liefern wie vor der Serialisierung.
     * Eine fehlende Regel koennte ein gesamtes Spiel mit falschen Regeln laufen lassen.
     */
    @Test
    void spielregeln_wirdAlsJsonbRoundtrip_korrektRekonstruiert() {
        Spielregeln spielregeln = Spielregeln.locoBlatRegeln();
        var schreibConverter = new JsonbConverter.SpielregelnSchreibConverter(mapper);

        String jsonString = schreibConverter.convert(spielregeln);
        Spielregeln rekonstruiert = new JsonbConverter.SpielregelnStringLeseConverter(mapper).convert(jsonString);

        assertThat(rekonstruiert).isEqualTo(spielregeln);
        assertThat(rekonstruiert.ohneNeunen()).isTrue();
        assertThat(rekonstruiert.bockrundenAktiv()).isTrue();
        assertThat(rekonstruiert.schweinchenAktiv()).isTrue();
    }

    // ---- Test 12: Schreib-Converter-Output ----

    /**
     * Warum wichtig: Alle Schreib-Converter muessen gueltigen JSON-String zurueckgeben,
     * damit PostgreSQL (JSONB-Spalte) und H2 (JSON-Spalte) den Wert korrekt speichern koennen.
     */
    @Test
    void alleSchreibConverter_gebenGueltigenJsonString_zurueck() {
        ObjectMapper m = mapper;
        String stichJson = new JsonbConverter.StichSchreibConverter(m)
                .convert(Stich.neu(SpielerPosition.NORD));
        assertThat(stichJson).startsWith("{").endsWith("}");

        String ansagenJson = new JsonbConverter.AnsagenSchreibConverter(m)
                .convert(Ansagen.leer());
        assertThat(ansagenJson).contains("ereignisse");

        String spielregelnJson = new JsonbConverter.SpielregelnSchreibConverter(m)
                .convert(Spielregeln.standardRegeln());
        assertThat(spielregelnJson).startsWith("{").endsWith("}");
    }
}
