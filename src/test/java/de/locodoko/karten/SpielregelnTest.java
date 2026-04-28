package de.locodoko.karten;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SpielregelnTest {

    @Test
    void locoBlatRegelnAktivierenAlleSonderregeln() {
        // Stellt sicher dass Bockrunden/Schweinchen/30AP/Schmeissen aktiv sind —
        // verhindert, dass ein Refactoring diese versehentlich deaktiviert.
        // Loco Blatt spielt OHNE Neunen (10 Karten). Referenz: specs/regelkatalog.md
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
    void locoBlatRegelnHatKorrekteWerteFuerAlleFelder() {
        // Vollständige Feldprüfung sichert ab, dass ein Refactoring kein einzelnes
        // Preset-Feld unbemerkt verändert — jedes Feld hat im Loco-Blatt-Kontext eine Bedeutung.
        Spielregeln regeln = Spielregeln.locoBlatRegeln();
        assertThat(regeln.ohneNeunen()).isTrue();
        assertThat(regeln.zweiteDulleSticht()).isTrue();
        assertThat(regeln.mindestkartenReKontra()).isEqualTo(9);
        assertThat(regeln.mindestkartenKeine90()).isEqualTo(8);
        assertThat(regeln.mindestkartenKeine60()).isEqualTo(7);
        assertThat(regeln.mindestkartenKeine30()).isEqualTo(6);
        assertThat(regeln.mindestkartenSchwarz()).isEqualTo(5);
        assertThat(regeln.fuchsAktiv()).isTrue();
        assertThat(regeln.karlchenAktiv()).isTrue();
        assertThat(regeln.doppelkopfAktiv()).isTrue();
        assertThat(regeln.armutAktiv()).isTrue();
        assertThat(regeln.soloDameAktiv()).isTrue();
        assertThat(regeln.soloBubeAktiv()).isTrue();
        assertThat(regeln.soloTrumpfAktiv()).isTrue();
        assertThat(regeln.soloFleischlosAktiv()).isTrue();
        assertThat(regeln.hochzeitAktiv()).isTrue();
        assertThat(regeln.bockrundenAktiv()).isTrue();
        assertThat(regeln.schweinchenAktiv()).isTrue();
        assertThat(regeln.dreissigAugenPflichtAktiv()).isTrue();
        assertThat(regeln.schmeissenAktiv()).isTrue();
        assertThat(regeln.herzDurchgegangenNurHoch()).isFalse();
    }

    @Test
    void dkvRegelnHatKorrekteWerteFuerAlleFelder() {
        // Vollständige Feldprüfung sichert ab, dass das offizielle DKV-Turnier-Preset
        // exakt die vorgeschriebenen Werte hat — Fehler hier würden Turniere verfälschen.
        Spielregeln regeln = Spielregeln.dkvRegeln();
        assertThat(regeln.ohneNeunen()).isFalse();
        assertThat(regeln.zweiteDulleSticht()).isTrue();
        assertThat(regeln.mindestkartenReKontra()).isEqualTo(11);
        assertThat(regeln.mindestkartenKeine90()).isEqualTo(10);
        assertThat(regeln.mindestkartenKeine60()).isEqualTo(9);
        assertThat(regeln.mindestkartenKeine30()).isEqualTo(8);
        assertThat(regeln.mindestkartenSchwarz()).isEqualTo(7);
        assertThat(regeln.fuchsAktiv()).isTrue();
        assertThat(regeln.karlchenAktiv()).isTrue();
        assertThat(regeln.doppelkopfAktiv()).isTrue();
        assertThat(regeln.armutAktiv()).isTrue();
        assertThat(regeln.soloDameAktiv()).isTrue();
        assertThat(regeln.soloBubeAktiv()).isTrue();
        assertThat(regeln.soloTrumpfAktiv()).isTrue();
        assertThat(regeln.soloFleischlosAktiv()).isTrue();
        assertThat(regeln.hochzeitAktiv()).isTrue();
        assertThat(regeln.bockrundenAktiv()).isFalse();
        assertThat(regeln.schweinchenAktiv()).isFalse();
        assertThat(regeln.dreissigAugenPflichtAktiv()).isFalse();
        assertThat(regeln.schmeissenAktiv()).isFalse();
        assertThat(regeln.herzDurchgegangenNurHoch()).isFalse();
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
        // Beide spielen ohne Neunen (10 Karten), loco hat alle Sonderregeln
        assertThat(loco.ohneNeunen()).isTrue();
        assertThat(dkv.ohneNeunen()).isFalse();
    }
}
