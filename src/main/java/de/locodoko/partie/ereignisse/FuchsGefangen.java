package de.locodoko.partie.ereignisse;

import de.locodoko.partie.SpielerPosition;

import java.util.UUID;

/**
 * Domain Event: Ein Gegner-Fuchs (Karo-As) wurde in einem Stich gefangen.
 *
 * <p>Taeter ist der Stichgewinner, Opfer ist der Spieler, dessen Fuchs gefangen wurde.</p>
 */
public record FuchsGefangen(UUID tischId, SpielerPosition taeter, SpielerPosition opfer) {}
