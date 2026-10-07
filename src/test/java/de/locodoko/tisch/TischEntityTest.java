package de.locodoko.tisch;

import de.locodoko.spieler.SpielerEntity;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Tests fuer {@link TischEntity}.
 * Prueft Constraints (max. 4 Spieler, Duplikatschutz) und die Zugangsmodus-Initialisierung.
 */
class TischEntityTest {

    private static TischEntity leereTisch() {
        return TischEntity.neu("Testtisch", SpielerEntity.menschlich("Host", "host-session"),
                TischkonfigurationEmbeddable.standard());
    }

    @Test
    void neuerTischHatStandardZugangsmodusOffen() {
        var tisch = leereTisch();
        assertThat(tisch.zugangsmodus()).isEqualTo(Zugangsmodus.OFFEN);
    }

    @Test
    void tischMitExplizitemZugangsmodusNimmtDiesenAn() {
        var tisch = TischEntity.neu("Privat", SpielerEntity.menschlich("Host", "s"),
                TischkonfigurationEmbeddable.standard(), Zugangsmodus.PRIVAT);
        assertThat(tisch.zugangsmodus()).isEqualTo(Zugangsmodus.PRIVAT);
    }

    @Test
    void vierSpielerFuellenDenTisch() {
        var tisch = leereTisch();
        for (int i = 0; i < 4; i++) {
            tisch.fuegeSpielerHinzu(SpielerEntity.menschlich("S" + i, "s" + i));
        }
        assertThat(tisch.istVoll()).isTrue();
    }

    @Test
    void fuenfterSpielerWirdAbgelehnt() {
        var tisch = leereTisch();
        for (int i = 0; i < 4; i++) {
            tisch.fuegeSpielerHinzu(SpielerEntity.menschlich("S" + i, "s" + i));
        }
        var fuenfter = SpielerEntity.menschlich("Zuviel", "s5");

        assertThatThrownBy(() -> tisch.fuegeSpielerHinzu(fuenfter))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("vier");
    }

    @Test
    void doppelterSpielerWirdIgnoriert() {
        var tisch = leereTisch();
        var spieler = SpielerEntity.menschlich("Doppelt", "doppelt-session");
        tisch.fuegeSpielerHinzu(spieler);
        tisch.fuegeSpielerHinzu(spieler);

        assertThat(tisch.spieler()).hasSize(1);
    }

    @Test
    void entfernterSpielerIstNichtMehrAmTisch() {
        var tisch = leereTisch();
        var spieler = SpielerEntity.menschlich("Weggeher", "weg-session");
        tisch.fuegeSpielerHinzu(spieler);
        tisch.entferneSpieler(spieler);

        assertThat(tisch.enthaeltSpieler(spieler)).isFalse();
        assertThat(tisch.spieler()).isEmpty();
    }

    @Test
    void statusNachSetzeStatusWartendIstWARTEND() {
        var tisch = leereTisch();
        tisch.setzeStatusWartend();
        assertThat(tisch.status()).isEqualTo(TischStatus.WARTEND);
    }
}
