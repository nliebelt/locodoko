package de.locodoko.tisch;

/**
 * Schwierigkeitsstufen der KI-Gegner.
 *
 * <p>LEICHT spielt die erste gueltige Karte ohne strategische Ueberlegung — leicht zu schlagen.
 * STANDARD ist die regelbasierte Standardstrategie mit Sonderpunkt-Bewusstsein.
 * SCHWER nutzt dieselbe Logik wie STANDARD, aber mit aggressiveren Ansage-Schwellenwerten.</p>
 */
public enum KiSchwierigkeit {

    /** Keine strategischen Entscheidungen: immer Gesund, keine Ansagen, erste gueltige Karte. */
    LEICHT,

    /** Regelbasierte Strategie mit Schmier-Logik, Sonderpunkt-Schutz und Ansage-Bewertung. */
    STANDARD,

    /** Wie STANDARD, aber mit niedrigeren Re-/Kontra-Schwellenwerten — aggressivere Ansagen. */
    SCHWER
}
