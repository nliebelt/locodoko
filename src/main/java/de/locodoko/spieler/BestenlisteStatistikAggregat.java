package de.locodoko.spieler;

import java.util.UUID;

/**
 * Aggregiertes Spielerprofil ueber alle Regelvarianten — Projektion fuer die Bestenliste.
 */
record BestenlisteStatistikAggregat(UUID spielerId, int anzahlSpiele, int anzahlSiege,
                                    double ratingMu, double ratingSigma) {
    double konservativesRating() {
        return ratingMu - 3 * ratingSigma;
    }
}
