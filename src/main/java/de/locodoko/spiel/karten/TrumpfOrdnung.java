package de.locodoko.spiel.karten;

public interface TrumpfOrdnung {

    boolean istTrumpf(Karte karte);

    Bedienfarbe bedienfarbeVon(Karte karte);

    int fehlRang(Karte karte);

    int trumpfRang(Karte karte);

    default boolean spaetereGleicheKarteGewinnt(Karte karte) {
        return false;
    }
}
