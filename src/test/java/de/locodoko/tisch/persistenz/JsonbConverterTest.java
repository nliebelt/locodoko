package de.locodoko.tisch.persistenz;

import com.fasterxml.jackson.databind.ObjectMapper;
import de.locodoko.karten.Farbe;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.util.EnumMap;
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
