package de.locodoko.karten;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

/**
 * Austauschbare Trumpfstrategie fuer verschiedene Spielvarianten.
 *
 * <p>Definiert fuer jeden Spieltyp (Normalspiel, Damensolo, Bubensolo, Fleischlos usw.),
 * welche Karten Trumpf sind und wie Trumpf- bzw. Fehlkarten innerhalb eines Stichs
 * gegeneinander abgestuft werden. Die Stichlogik in {@link de.locodoko.partie.Stich} delegiert alle
 * Rang-Entscheidungen an diese Schnittstelle, um Spielvarianten auszutauschen ohne
 * die Kernlogik zu veraendern.</p>
 */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "typ")
@JsonSubTypes({
    @JsonSubTypes.Type(value = NormaleTrumpfOrdnung.class,              name = "NORMAL"),
    @JsonSubTypes.Type(value = SchweinchenTrumpfOrdnung.class,          name = "SCHWEINCHEN"),
    @JsonSubTypes.Type(value = DamensoloTrumpfOrdnung.class,            name = "SOLO_DAME"),
    @JsonSubTypes.Type(value = BubensoloTrumpfOrdnung.class,            name = "SOLO_BUBE"),
    @JsonSubTypes.Type(value = FleischlosTrumpfOrdnung.class,           name = "SOLO_FLEISCHLOS"),
    @JsonSubTypes.Type(value = VariableTrumpfsoloTrumpfOrdnung.class,   name = "SOLO_TRUMPF_VARIABEL")
})
public interface TrumpfOrdnung {

    boolean istTrumpf(Karte karte);

    Bedienfarbe bedienfarbeVon(Karte karte);

    int fehlRang(Karte karte);

    int trumpfRang(Karte karte);

    default boolean spaetereGleicheKarteGewinnt(Karte karte) {
        return false;
    }
}
