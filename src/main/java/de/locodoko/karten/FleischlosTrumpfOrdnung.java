package de.locodoko.karten;

/**
 * Trumpfordnung fuer das Fleischlos-Solo (auch "Nullspiel" oder "Ohne-Trumpf-Solo").
 *
 * <p>Im Fleischlos gibt es keinerlei Trumpf — alle Karten sind Fehlkarten ihrer jeweiligen
 * Farbe. Ein Stich wird immer von der erstgespielten Farbe bestimmt; hoeherer Fehlrang
 * gewinnt innerhalb dieser Farbe. Kein Stechen durch eine andere Farbe ist moeglich.</p>
 */
public final class FleischlosTrumpfOrdnung implements TrumpfOrdnung {

    @Override
    public boolean istTrumpf(Karte karte) {
        return false;
    }

    @Override
    public Bedienfarbe bedienfarbeVon(Karte karte) {
        return Bedienfarbe.fehl(karte.farbe());
    }

    @Override
    public int fehlRang(Karte karte) {
        return karte.wert().fehlRang();
    }

    @Override
    public int trumpfRang(Karte karte) {
        throw new IllegalArgumentException("Es gibt im Fleischlos keine Truempe");
    }
}
