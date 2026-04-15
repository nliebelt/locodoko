package de.locodoko.tisch;

/**
 * Zugangsmodus eines Tisches.
 *
 * <p>{@code OFFEN}: Tisch ist fuer alle Spieler in der Lobby sichtbar und betretbar.
 * {@code PRIVAT}: Tisch ist nur ueber den Einladungslink betretbar und in der
 * oeffentlichen Tischliste nicht sichtbar.</p>
 */
public enum Zugangsmodus {
    OFFEN,
    PRIVAT
}
