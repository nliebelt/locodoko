package de.locodoko.tisch;

/**
 * Konfigurierbarer Tischoberflaechentyp fuer die visuelle Darstellung im Frontend.
 *
 * <p>Wird vom Tischersteller eingestellt und in der {@link TischkonfigurationEmbeddable}
 * persistiert. Das Frontend rendert die passende Hintergrundtextur, fuer unbekannte Werte
 * gilt {@code FILZ_GRUEN} als Fallback.</p>
 */
public enum Tischhintergrund {
    FILZ_GRUEN,
    HOLZ_DUNKEL,
    BLAU_GRAFIK,
    RECHTECK_1,
    RECHTECK_2,
    OVAL_1,
    OVAL_2,
    RUND_1
}
