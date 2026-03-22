package de.locodoko.karten;

import java.util.Objects;

/**
 * Abstrakte Basisklasse fuer Solo-Varianten, bei denen exakt ein Kartenwert Trumpf ist.
 *
 * <p>Konkreter Einsatz: {@link DamensoloTrumpfOrdnung} (nur Damen sind Trumpf) und
 * {@link BubensoloTrumpfOrdnung} (nur Buben sind Trumpf). Innerhalb des Trumpfs wird
 * nach Farbe geordnet: Karo (niedrigster) < Herz < Pik < Kreuz (hoechster).</p>
 */
abstract class WertSoloTrumpfOrdnung implements TrumpfOrdnung {

    private final Kartenwert trumpfWert;

    protected WertSoloTrumpfOrdnung(Kartenwert trumpfWert) {
        this.trumpfWert = Objects.requireNonNull(trumpfWert, "trumpfWert darf nicht null sein");
    }

    @Override
    public boolean istTrumpf(Karte karte) {
        return karte.wert() == trumpfWert;
    }

    @Override
    public Bedienfarbe bedienfarbeVon(Karte karte) {
        return istTrumpf(karte) ? Bedienfarbe.alsTrumpf() : Bedienfarbe.fehl(karte.farbe());
    }

    @Override
    public int fehlRang(Karte karte) {
        if (istTrumpf(karte)) {
            throw new IllegalArgumentException("Trumpfkarten haben keinen Fehlrang: " + karte);
        }
        return karte.wert().fehlRang();
    }

    @Override
    public int trumpfRang(Karte karte) {
        if (!istTrumpf(karte)) {
            throw new IllegalArgumentException("Fehlkarten haben keinen Trumpfrang: " + karte);
        }
        return switch (karte.farbe()) {
            case KARO -> 1;
            case HERZ -> 2;
            case PIK -> 3;
            case KREUZ -> 4;
        };
    }
}
