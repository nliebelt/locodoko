package de.locodoko.spiel.karten;

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
