package de.locodoko.spieler;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests fuer {@link SpielerProfilAntwort}.
 * Deckt Aggregations-Logik und Division-Guards ab: bei fehlenden Statistiken
 * muss null zurueckgeliefert werden; bei anzahlSpiele==0 darf keine Division-by-Zero auftreten.
 */
class SpielerProfilAntwortTest {

    private static SpielerEntity testSpieler() {
        return SpielerEntity.menschlich("Testfritz", "test-session");
    }

    @Test
    void ohneStatistikenIstStatistikNull() {
        var antwort = SpielerProfilAntwort.aus(testSpieler(), List.of(), List.of());

        assertThat(antwort.statistik()).isNull();
    }

    @Test
    void mitStatistikWirdAggregiert() {
        SpielerStatistik s = SpielerStatistik.fuer(UUID.randomUUID(), "TURNIER");
        s.verarbeiteSpiel(true, 3, 1, 0, 0, 0, false, true, "NORMALSPIEL", false, false, 130);

        var antwort = SpielerProfilAntwort.aus(testSpieler(), List.of(s), List.of());

        assertThat(antwort.statistik()).isNotNull();
        assertThat(antwort.statistik().anzahlSpiele()).isEqualTo(1);
        assertThat(antwort.statistik().anzahlSiege()).isEqualTo(1);
    }

    @Test
    void statistikMitNullSpieleVerursachtKeineDivisionByZero() {
        SpielerStatistik s = SpielerStatistik.fuer(UUID.randomUUID(), "TURNIER");
        // anzahlSpiele bleibt 0 (neue leere Statistik ohne verarbeiteSpiel)

        var antwort = SpielerProfilAntwort.aus(testSpieler(), List.of(s), List.of());

        assertThat(antwort.statistik()).isNotNull();
        assertThat(antwort.statistik().durchschnittlichePunkteProSpiel()).isEqualTo(0.0);
        assertThat(antwort.statistik().siegquote()).isEqualTo(0.0);
        assertThat(antwort.statistik().durchschnittlicheAugenProSpiel()).isEqualTo(0.0);
    }

    @Test
    void mehrereRegelvarianten_WerdenZusammengezaehlt() {
        UUID id = UUID.randomUUID();
        SpielerStatistik s1 = SpielerStatistik.fuer(id, "TURNIER");
        s1.verarbeiteSpiel(true, 3, 1, 0, 0, 0, false, true, "NORMALSPIEL", false, false, 130);
        SpielerStatistik s2 = SpielerStatistik.fuer(id, "STANDARD");
        s2.verarbeiteSpiel(false, -3, 0, 0, 0, 0, false, false, "NORMALSPIEL", false, false, 100);

        var antwort = SpielerProfilAntwort.aus(testSpieler(), List.of(s1, s2), List.of());

        assertThat(antwort.statistik().anzahlSpiele()).isEqualTo(2);
        assertThat(antwort.statistik().anzahlSiege()).isEqualTo(1);
    }
}
