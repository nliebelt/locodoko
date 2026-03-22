package de.locodoko.karten;

/**
 * Eine gespielte Karte innerhalb eines Stichs.
 *
 * <p>Verbindet eine {@link Karte} mit der {@link SpielerPosition}, die sie ausgespielt hat,
 * und der nullbasierten Ausspiel-Reihenfolge innerhalb des Stichs (0 = erste Karte, 3 = letzte).
 * Wird von {@link Stich} fuer die Gewinnerermittlung und den Snapshot verwendet.</p>
 *
 * @param spieler     Position des Spielers, der die Karte ausgespielt hat
 * @param karte       die gespielte Karte
 * @param reihenfolge nullbasierter Index der Karte innerhalb des Stichs
 */
public record GespielteKarte(SpielerPosition spieler, Karte karte, int reihenfolge) {
}
