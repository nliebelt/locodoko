package de.locodoko.karten;

/**
 * Trumpfordnung fuer das Bubensolo.
 *
 * <p>Im Bubensolo sind ausschliesslich die vier Buben (Karo, Herz, Pik, Kreuz) Trumpf;
 * alle anderen Karten sind Fehlkarten. Rang innerhalb des Trumpfs: Karo-Bube (niedrigster)
 * bis Kreuz-Bube (hoechster). Hochzeit und Armut sind in Soli nicht erlaubt.</p>
 */
public final class BubensoloTrumpfOrdnung extends WertSoloTrumpfOrdnung {

    public BubensoloTrumpfOrdnung() {
        super(Kartenwert.BUBE);
    }
}
