package de.locodoko.ki;

import de.locodoko.karten.Karte;

import java.util.List;

public record KiArmutAntwort(boolean angenommen, List<Karte> rueckgabekarten) {

    public KiArmutAntwort {
        rueckgabekarten = List.copyOf(rueckgabekarten);
    }

    public static KiArmutAntwort ablehnen() {
        return new KiArmutAntwort(false, List.of());
    }

    public static KiArmutAntwort annehmen(List<Karte> rueckgabekarten) {
        return new KiArmutAntwort(true, rueckgabekarten);
    }
}
