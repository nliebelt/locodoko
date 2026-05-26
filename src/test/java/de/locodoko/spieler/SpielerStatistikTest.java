package de.locodoko.spieler;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit-Tests fuer {@link SpielerStatistik} — Inkrementierungslogik.
 */
class SpielerStatistikTest {

    @Test
    void reSiegerWirdKorrektGezaehlt() {
        SpielerStatistik s = SpielerStatistik.fuer(java.util.UUID.randomUUID(), "TURNIER");
        s.verarbeiteSpiel(true, 3, 0, 0, 0, 0, false, true, "", false, false);

        assertThat(s.reSiege()).isEqualTo(1);
        assertThat(s.reNiederlagen()).isEqualTo(0);
        assertThat(s.kontraSiege()).isEqualTo(0);
        assertThat(s.kontraNiederlagen()).isEqualTo(0);
        assertThat(s.anzahlSiege()).isEqualTo(1);
    }

    @Test
    void kontraNiederlageWirdKorrektGezaehlt() {
        SpielerStatistik s = SpielerStatistik.fuer(java.util.UUID.randomUUID(), "SONDER");
        s.verarbeiteSpiel(false, -2, 0, 0, 0, 0, false, false, "", false, false);

        assertThat(s.kontraNiederlagen()).isEqualTo(1);
        assertThat(s.kontraSiege()).isEqualTo(0);
        assertThat(s.reSiege()).isEqualTo(0);
        assertThat(s.reNiederlagen()).isEqualTo(0);
    }

    @Test
    void hochzeitWirdGezaehlt() {
        SpielerStatistik s = SpielerStatistik.fuer(java.util.UUID.randomUUID(), "TURNIER");
        s.verarbeiteSpiel(true, 2, 0, 0, 0, 0, false, true, "HOCHZEIT", false, false);

        assertThat(s.hochzeitenGespielt()).isEqualTo(1);
    }

    @Test
    void armutAngesagtWirdGezaehlt() {
        SpielerStatistik s = SpielerStatistik.fuer(java.util.UUID.randomUUID(), "TURNIER");
        s.verarbeiteSpiel(false, -1, 0, 0, 0, 0, false, true, "ARMUT", true, false);

        assertThat(s.armutenAngesagt()).isEqualTo(1);
        assertThat(s.armutenUebernommen()).isEqualTo(0);
    }

    @Test
    void armutUebernommenWirdGezaehlt() {
        SpielerStatistik s = SpielerStatistik.fuer(java.util.UUID.randomUUID(), "FREI");
        s.verarbeiteSpiel(true, 4, 0, 0, 0, 0, false, true, "ARMUT", false, true);

        assertThat(s.armutenUebernommen()).isEqualTo(1);
        assertThat(s.armutenAngesagt()).isEqualTo(0);
    }

    @Test
    void soloSiegWirdInSolosProTypGespeichert() {
        SpielerStatistik s = SpielerStatistik.fuer(java.util.UUID.randomUUID(), "TURNIER");
        s.verarbeiteSpiel(true, 6, 0, 0, 0, 0, true, true, "SOLO_DAME", false, false);

        assertThat(s.solosSiege()).isEqualTo(1);
        assertThat(s.solosNiederlagen()).isEqualTo(0);
        assertThat(s.solosProTypJson()).contains("SOLO_DAME");
        assertThat(s.solosProTypJson()).contains("\"siege\":1");
    }

    @Test
    void soloNiederlageWirdInSolosProTypGespeichert() {
        SpielerStatistik s = SpielerStatistik.fuer(java.util.UUID.randomUUID(), "TURNIER");
        s.verarbeiteSpiel(false, -3, 0, 0, 0, 0, true, true, "SOLO_BUBE", false, false);

        assertThat(s.solosSiege()).isEqualTo(0);
        assertThat(s.solosNiederlagen()).isEqualTo(1);
        assertThat(s.solosProTypJson()).contains("SOLO_BUBE");
        assertThat(s.solosProTypJson()).contains("\"niederlagen\":1");
    }

    @Test
    void zuletztAktualisiertWirdGesetztNachSpiel() {
        SpielerStatistik s = SpielerStatistik.fuer(java.util.UUID.randomUUID(), "TURNIER");
        assertThat(s.zuletztAktualisiert()).isNull();

        s.verarbeiteSpiel(true, 1, 0, 0, 0, 0, false, true, "", false, false);

        assertThat(s.zuletztAktualisiert()).isNotNull();
    }
}
