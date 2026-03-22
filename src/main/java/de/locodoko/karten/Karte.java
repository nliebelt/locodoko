package de.locodoko.karten;

import java.util.Objects;

/**
 * Einzelne Spielkarte im Doppelkopf-Deck.
 *
 * <p>Eine Karte ist ein unveraenderliches Value Object, das durch Farbe, Kartenwert und
 * Exemplar-Index eindeutig identifiziert wird. Da jede Karte im Doppelkopf-Deck zweimal
 * vorkommt (zwei Exemplare pro Farbe-Wert-Kombination), unterscheidet der {@code exemplarIndex}
 * zwischen den beiden physischen Karten (1 oder 2).</p>
 *
 * @param farbe          Kartenfarbe (Kreuz, Pik, Herz, Karo)
 * @param wert           Kartenwert (Neun bis As)
 * @param exemplarIndex  Exemplarnummer (1 oder 2) — unterscheidet die zwei Kopien derselben Karte
 */
public record Karte(Farbe farbe, Kartenwert wert, int exemplarIndex) {

    public Karte {
        Objects.requireNonNull(farbe, "farbe darf nicht null sein");
        Objects.requireNonNull(wert, "wert darf nicht null sein");
        if (exemplarIndex < 1) {
            throw new IllegalArgumentException("exemplarIndex muss groesser gleich 1 sein");
        }
    }

    public int augen() {
        return wert.augen();
    }

    public boolean gleicheAuspraegungWie(Karte andereKarte) {
        return farbe == andereKarte.farbe() && wert == andereKarte.wert();
    }
}
