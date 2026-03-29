package de.locodoko.karten;

/**
 * Art des aktuell gespielten Doppelkopf-Spiels.
 *
 * <p>Bestimmt, welche {@link TrumpfOrdnung} aktiv ist und welche Parteien existieren.
 * {@code NORMALSPIEL} und {@code HOCHZEIT} nutzen die {@code NormaleTrumpfOrdnung},
 * {@code ARMUT} ebenfalls; die Solo-Varianten haben eigene Trumpfordnungen.</p>
 */
public enum Spieltyp {
    NORMALSPIEL,
    HOCHZEIT,
    ARMUT,
    SOLO_DAME,
    SOLO_BUBE,
    SOLO_TRUMPF,
    SOLO_TRUMPF_HERZ,
    SOLO_TRUMPF_PIK,
    SOLO_TRUMPF_KREUZ,
    SOLO_FLEISCHLOS
}
