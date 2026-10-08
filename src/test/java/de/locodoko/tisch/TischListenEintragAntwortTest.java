package de.locodoko.tisch;

import de.locodoko.spieler.SpielerEntity;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;

import static org.assertj.core.api.Assertions.assertThat;

class TischListenEintragAntwortTest {

    private static TischEntity tischOhneSpieler() {
        var tisch = TischEntity.neu("Testtisch", SpielerEntity.menschlich("Host", "host-session"),
                TischkonfigurationEmbeddable.standard());
        tisch.setzeSpielerListe(new ArrayList<>());
        return tisch;
    }

    @Test
    void leererTisch_liefertLeereSpielerNamenListe() {
        // Stellt sicher, dass aus() kein NPE wirft und korrekt auf leere Spielerliste reagiert
        var antwort = TischListenEintragAntwort.aus(tischOhneSpieler());

        assertThat(antwort.spielerNamen()).isEmpty();
    }

    @Test
    void einMenschUndZweiKI_liefertDreiNamen() {
        // Stellt sicher, dass Mensch- und KI-Spielernamen gemeinsam in der Liste landen
        var anna = SpielerEntity.menschlich("Anna", "s-anna");
        var tisch = TischEntity.neu("Tisch A", anna, TischkonfigurationEmbeddable.standard());
        tisch.fuegeSpielerHinzu(anna);
        tisch.fuegeSpielerHinzu(SpielerEntity.ki("KI Bert"));
        tisch.fuegeSpielerHinzu(SpielerEntity.ki("KI Clara"));

        var antwort = TischListenEintragAntwort.aus(tisch);

        assertThat(antwort.spielerNamen()).hasSize(3);
        assertThat(antwort.spielerNamen()).containsExactly("Anna", "KI Bert", "KI Clara");
    }

    @Test
    void vollerTisch_liefertVierNamen() {
        // Stellt sicher, dass ein voller Tisch mit 4 Spielern exakt 4 Namen liefert
        var max = SpielerEntity.menschlich("Max", "s-max");
        var tisch = TischEntity.neu("Voller Tisch", max, TischkonfigurationEmbeddable.standard());
        tisch.fuegeSpielerHinzu(max);
        tisch.fuegeSpielerHinzu(SpielerEntity.menschlich("Lena", "s-lena"));
        tisch.fuegeSpielerHinzu(SpielerEntity.ki("KI Ost"));
        tisch.fuegeSpielerHinzu(SpielerEntity.ki("KI West"));

        var antwort = TischListenEintragAntwort.aus(tisch);

        assertThat(antwort.spielerNamen()).hasSize(4);
        assertThat(antwort.spielerNamen()).containsExactly("Max", "Lena", "KI Ost", "KI West");
    }
}
