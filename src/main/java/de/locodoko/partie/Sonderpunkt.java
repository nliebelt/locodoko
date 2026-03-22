package de.locodoko.partie;

/**
 * Sonderpunktart im Doppelkopf-Spiel.
 *
 * <p>Zusatzpunkte ausserhalb der reinen Augen-/Ansage-Wertung, jeweils konfigurierbar
 * in {@link de.locodoko.karten.Spielregeln}:</p>
 * <ul>
 *   <li>{@code FUCHS_GEFANGEN} — Kontra-Spieler faengt den Kreuz-As (Fuchs) der Re-Partei</li>
 *   <li>{@code KARLCHEN} — Re-Partei gewinnt mit dem Kreuz-Buben (Karlchen) den letzten Stich</li>
 *   <li>{@code DOPPELKOPF} — ein Stich enthaelt 4 Augen-starke Karten (40+ Augen)</li>
 * </ul>
 */
public enum Sonderpunkt {
    FUCHS_GEFANGEN,
    KARLCHEN,
    DOPPELKOPF
}
