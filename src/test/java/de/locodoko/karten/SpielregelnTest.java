package de.locodoko.karten;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SpielregelnTest {

    @Test
    void locoBlatRegelnAktivierenAlleSonderregeln() {
        // Stellt sicher dass Bockrunden/Schweinchen/30AP/Schmeissen aktiv sind —
        // verhindert, dass ein Refactoring diese versehentlich deaktiviert
        Spielregeln regeln = Spielregeln.locoBlatRegeln();
        assertThat(regeln.bockrundenAktiv()).isTrue();
        assertThat(regeln.schweinchenAktiv()).isTrue();
        assertThat(regeln.dreissigAugenPflichtAktiv()).isTrue();
        assertThat(regeln.schmeissenAktiv()).isTrue();
        assertThat(regeln.ohneNeunen()).isTrue();
        assertThat(regeln.mindestkartenReKontra()).isEqualTo(9);
    }

    @Test
    void dkvRegelnDeaktivierenBockrundenSchweinchenUnd30APUndSchmeissen() {
        // Stellt sicher dass Turnier-Regeln genau die vier Sonderregeln nicht enthalten —
        // falsches Preset würde Turniere mit Sonderregeln spielen lassen
        Spielregeln regeln = Spielregeln.dkvRegeln();
        assertThat(regeln.bockrundenAktiv()).isFalse();
        assertThat(regeln.schweinchenAktiv()).isFalse();
        assertThat(regeln.dreissigAugenPflichtAktiv()).isFalse();
        assertThat(regeln.schmeissenAktiv()).isFalse();
        assertThat(regeln.ohneNeunen()).isFalse();
        assertThat(regeln.mindestkartenReKontra()).isEqualTo(11);
    }

    @Test
    void ohneNeunenLocoBlatRegelnSetzenOhneNeunenUndPassendeMindestkarten() {
        // Stellt sicher dass ohneNeunen gesetzt ist und Mindestkarten für 10-Karten-Spiel gelten —
        // falsche Mindestkarten machen Ansagen fast immer unmöglich
        Spielregeln regeln = Spielregeln.ohneNeunenLocoBlatRegeln();
        assertThat(regeln.ohneNeunen()).isTrue();
        assertThat(regeln.mindestkartenReKontra()).isEqualTo(9);
        assertThat(regeln.mindestkartenKeine90()).isEqualTo(8);
        assertThat(regeln.mindestkartenSchwarz()).isEqualTo(5);
        assertThat(regeln.bockrundenAktiv()).isTrue();
        assertThat(regeln.schweinchenAktiv()).isTrue();
        assertThat(regeln.dreissigAugenPflichtAktiv()).isTrue();
    }

    @Test
    void dkvUndLocoBlatTeilenDieselbenGrundregeln() {
        // Stellt sicher dass beide Presets abgesehen von den 3 Sonderregeln identisch sind —
        // verhindert unbeabsichtigte Unterschiede bei Fuchs/Karlchen/Solo etc.
        Spielregeln loco = Spielregeln.locoBlatRegeln();
        Spielregeln dkv = Spielregeln.dkvRegeln();
        assertThat(loco.zweiteDulleSticht()).isEqualTo(dkv.zweiteDulleSticht());
        assertThat(loco.fuchsAktiv()).isEqualTo(dkv.fuchsAktiv());
        assertThat(loco.karlchenAktiv()).isEqualTo(dkv.karlchenAktiv());
        assertThat(loco.hochzeitAktiv()).isEqualTo(dkv.hochzeitAktiv());
        assertThat(loco.armutAktiv()).isEqualTo(dkv.armutAktiv());
        // Loco Blatt hat ohneNeunen=true (10 Karten), DKV spielt mit Neunen (12 Karten)
        assertThat(loco.ohneNeunen()).isTrue();
        assertThat(dkv.ohneNeunen()).isFalse();
    }
}
