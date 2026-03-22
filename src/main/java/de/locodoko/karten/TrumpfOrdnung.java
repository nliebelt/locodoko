package de.locodoko.karten;

/**
 * Austauschbare Trumpfstrategie fuer verschiedene Spielvarianten.
 *
 * <p>Definiert fuer jeden Spieltyp (Normalspiel, Damensolo, Bubensolo, Fleischlos usw.),
 * welche Karten Trumpf sind und wie Trumpf- bzw. Fehlkarten innerhalb eines Stichs
 * gegeneinander abgestuft werden. Die Stichlogik in {@link Stich} delegiert alle
 * Rang-Entscheidungen an diese Schnittstelle, um Spielvarianten auszutauschen ohne
 * die Kernlogik zu veraendern.</p>
 */
public interface TrumpfOrdnung {

    boolean istTrumpf(Karte karte);

    Bedienfarbe bedienfarbeVon(Karte karte);

    int fehlRang(Karte karte);

    int trumpfRang(Karte karte);

    default boolean spaetereGleicheKarteGewinnt(Karte karte) {
        return false;
    }
}
