package de.locodoko.tisch;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class TischkonfigurationEmbeddableTest {

    @Test
    void locoBlatRegeln_aktiviertAlleSonderregeln() {
        // Stellt sicher, dass locoBlatRegeln() ein vollständiges Haus-Regelwerk liefert
        // und nicht versehentlich auf dkvRegeln() oder eine unvollständige Konfiguration delegiert.
        var config = TischkonfigurationEmbeddable.locoBlatRegeln();

        assertThat(config.ohneNeunen()).isTrue();
        assertThat(config.anzahlSpiele()).isEqualTo(24);
        assertThat(config.bockrundenAktiv()).isTrue();
        assertThat(config.schweinchenAktiv()).isTrue();
        assertThat(config.dreissigAugenPflichtAktiv()).isTrue();
        assertThat(config.schmeissenAktiv()).isTrue();
        assertThat(config.hochzeitErlaubt()).isTrue();
        assertThat(config.armutErlaubt()).isTrue();
    }

    @Test
    void dkvRegeln_deaktiviertBockrundenSchweinchenDreissigAugenUndSchmeissen() {
        // Stellt sicher, dass dkvRegeln() exakt die Abweichungen vom Loco-Blatt-Regelwerk
        // abbildet, die das DKV-Turnier-Regelwerk vorschreibt.
        var config = TischkonfigurationEmbeddable.dkvRegeln();

        assertThat(config.ohneNeunen()).isFalse();
        assertThat(config.anzahlSpiele()).isEqualTo(24);
        assertThat(config.bockrundenAktiv()).isFalse();
        assertThat(config.schweinchenAktiv()).isFalse();
        assertThat(config.dreissigAugenPflichtAktiv()).isFalse();
        assertThat(config.schmeissenAktiv()).isFalse();
        assertThat(config.hochzeitErlaubt()).isTrue();
        assertThat(config.armutErlaubt()).isTrue();
    }

    @Test
    void ohneNeunenLocoBlatRegeln_setzt10KartenSpielMitAllenSonderregeln() {
        // Stellt sicher, dass ohneNeunenLocoBlatRegeln() tatsächlich ohne Neunen spielt
        // und alle Sonderregeln wie das Standard-Loco-Blatt aktiviert.
        var config = TischkonfigurationEmbeddable.ohneNeunenLocoBlatRegeln();

        assertThat(config.ohneNeunen()).isTrue();
        assertThat(config.anzahlSpiele()).isEqualTo(24);
        assertThat(config.bockrundenAktiv()).isTrue();
        assertThat(config.schweinchenAktiv()).isTrue();
        assertThat(config.dreissigAugenPflichtAktiv()).isTrue();
        assertThat(config.schmeissenAktiv()).isTrue();
    }

    @Test
    void standard_delegiertZuLocoBlatRegeln() {
        // Stellt sicher, dass standard() und locoBlatRegeln() dasselbe Regelwerk liefern,
        // damit bestehende Tischerstellungen nicht unbemerkt auf andere Defaults wechseln.
        var standard = TischkonfigurationEmbeddable.standard();
        var locoBlatRegeln = TischkonfigurationEmbeddable.locoBlatRegeln();

        assertThat(standard.alsSpielregeln()).isEqualTo(locoBlatRegeln.alsSpielregeln());
        assertThat(standard.anzahlSpiele()).isEqualTo(locoBlatRegeln.anzahlSpiele());
        assertThat(standard.ohneNeunen()).isEqualTo(locoBlatRegeln.ohneNeunen());
    }
}
