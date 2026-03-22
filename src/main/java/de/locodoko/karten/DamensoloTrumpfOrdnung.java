package de.locodoko.karten;

/**
 * Trumpfordnung fuer das Damensolo.
 *
 * <p>Im Damensolo sind ausschliesslich die vier Damen (Karo, Herz, Pik, Kreuz) Trumpf;
 * alle anderen Karten sind Fehlkarten. Rang innerhalb des Trumpfs: Karo-Dame (niedrigste)
 * bis Kreuz-Dame (hoechste). Hochzeit und Armut sind in Soli nicht erlaubt.</p>
 */
public final class DamensoloTrumpfOrdnung extends WertSoloTrumpfOrdnung {

    public DamensoloTrumpfOrdnung() {
        super(Kartenwert.DAME);
    }
}
