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
import de.locodoko.partie.GeschmisseneSpieler;
import de.locodoko.partie.GespielteKarte;
import de.locodoko.partie.Haende;
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

    // ---- Test 9b: ArmutStatus mit Partner ----

    /**
     * Warum wichtig: ArmutStatus-Compact-Konstruktor erlaubt partnerSpieler nur bei angebotAbgegeben=true.
     * Dieser Branch (partnerSpieler != null) ist im bestehenden Test nicht abgedeckt. Jackson muss
     * den nicht-null-Partner korrekt serialisieren und deserialisieren, sonst bricht der Zustand
     * beim Laden aus der DB und der Armut-Ablauf faellt in einen ungueltigen Stand.
     */
    @Test
    void armutStatus_mitPartner_wirdAlsJsonbRoundtrip_korrektRekonstruiert() {
        ArmutStatus ohnePartner = ArmutStatus.gestartet(SpielerPosition.SUED);
        ArmutStatus mitAngebot = ohnePartner.mitAngebot(List.of(kreuzDame1()));
        // Der erste Antwortspieler (im Uhrzeigersinn ab SUED.naechste = WEST) nimmt an
        SpielerPosition ersterAntwortspieler = ohnePartner.abfrageReihenfolge().get(0);
        ArmutStatus mitPartner = mitAngebot.mitPartner(ersterAntwortspieler);
        var schreibConverter = new JsonbConverter.ArmutStatusSchreibConverter(mapper);

        String jsonString = schreibConverter.convert(mitPartner);
        ArmutStatus rekonstruiert = new JsonbConverter.ArmutStatusStringLeseConverter(mapper).convert(jsonString);

        assertThat(rekonstruiert.armutSpieler()).isEqualTo(SpielerPosition.SUED);
        assertThat(rekonstruiert.partnerSpieler()).isEqualTo(ersterAntwortspieler);
        assertThat(rekonstruiert.angebotAbgegeben()).isTrue();
        assertThat(rekonstruiert.angeboteneTrumpfkarten()).containsExactly(kreuzDame1());
    }

    // ---- Test 9c: GeschmisseneSpieler ----

    /**
     * Warum wichtig: GeschmisseneSpieler ist ein Non-Record mit privatem Konstruktor. Der Mixin
     * muss aus() als JsonCreator und alsSet() als JsonValue korrekt verdrahten. Ohne diesen Test
     * koennte ein kaputter Converter dazu fuehren, dass beim Laden aus der DB ein leeres Set
     * zurueckkommt — alle Schmiss-Informationen gehen verloren.
     */
    @Test
    void geschmisseneSpieler_wirdAlsJsonbRoundtrip_korrektRekonstruiert() {
        GeschmisseneSpieler geschmissen = GeschmisseneSpieler.leer()
                .mitPosition(SpielerPosition.NORD)
                .mitPosition(SpielerPosition.OST);
        var schreibConverter = new JsonbConverter.GeschmisseneSpielerVOSchreibConverter(mapper);

        String jsonString = schreibConverter.convert(geschmissen);
        GeschmisseneSpieler rekonstruiert = new JsonbConverter.GeschmisseneSpielerVOStringLeseConverter(mapper).convert(jsonString);

        assertThat(rekonstruiert.alsSet()).containsExactlyInAnyOrder(SpielerPosition.NORD, SpielerPosition.OST);
        assertThat(rekonstruiert.enthaelt(SpielerPosition.NORD)).isTrue();
        assertThat(rekonstruiert.enthaelt(SpielerPosition.SUED)).isFalse();
    }

    // ---- Test 9d: Haende ----

    /**
     * Warum wichtig: Haende ist das komplexeste JSONB-Feld — eine Map von SpielerPosition
     * auf Hand, jede Hand mit einer Kartenliste. Der HaendeMixin muss aus() als JsonCreator
     * und alsMap() als JsonValue korrekt verdrahten. Falsche Deserialisierung fuehrt dazu,
     * dass Spieler nach einem App-Neustart nicht mehr ihre Karten sehen — kritisch fuer Prod.
     */
    @Test
    void haende_wirdAlsJsonbRoundtrip_korrektRekonstruiert() {
        Hand nordHand = new Hand(List.of(
                new Karte(Farbe.KREUZ, Kartenwert.DAME, 1),
                new Karte(Farbe.PIK, Kartenwert.ZEHN, 2)
        ));
        Hand suedHand = new Hand(List.of(
                new Karte(Farbe.HERZ, Kartenwert.AS, 3)
        ));
        Map<SpielerPosition, Hand> haendeMap = new EnumMap<>(SpielerPosition.class);
        haendeMap.put(SpielerPosition.NORD, nordHand);
        haendeMap.put(SpielerPosition.SUED, suedHand);
        Haende haende = Haende.aus(haendeMap);
        var schreibConverter = new JsonbConverter.HaendeVOSchreibConverter(mapper);

        String jsonString = schreibConverter.convert(haende);
        Haende rekonstruiert = new JsonbConverter.HaendeVOStringLeseConverter(mapper).convert(jsonString);

        assertThat(rekonstruiert.positionen()).containsExactlyInAnyOrder(SpielerPosition.NORD, SpielerPosition.SUED);
        assertThat(rekonstruiert.handVon(SpielerPosition.NORD).karten()).hasSize(2);
        assertThat(rekonstruiert.handVon(SpielerPosition.NORD).karten().get(0))
                .isEqualTo(new Karte(Farbe.KREUZ, Kartenwert.DAME, 1));
        assertThat(rekonstruiert.handVon(SpielerPosition.SUED).karten()).hasSize(1);
        assertThat(rekonstruiert.handVon(SpielerPosition.SUED).karten().get(0))
                .isEqualTo(new Karte(Farbe.HERZ, Kartenwert.AS, 3));
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

        String ansagenJson = new JsonbConverter.AnsagenSchreibConverter(m)
                .convert(Ansagen.leer());
        assertThat(ansagenJson).contains("ereignisse");

        String spielregelnJson = new JsonbConverter.SpielregelnSchreibConverter(m)
                .convert(Spielregeln.standardRegeln());
        assertThat(spielregelnJson).startsWith("{").endsWith("}");
    }
}
