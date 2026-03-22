package de.locodoko.lobby;

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
    BLAU_GRAFIK
}
