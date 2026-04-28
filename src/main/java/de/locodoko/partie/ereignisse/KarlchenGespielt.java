package de.locodoko.partie.ereignisse;

import de.locodoko.partie.SpielerPosition;

import java.util.UUID;

/**
 * Domain Event: Der Kreuz-Bube hat den letzten Stich gewonnen (Karlchen).
 *
 * <p>Taeter ist der Spieler, der den Kreuz-Buben im letzten Stich gespielt und gewonnen hat.</p>
 */
public record KarlchenGespielt(UUID tischId, SpielerPosition taeter) {}
