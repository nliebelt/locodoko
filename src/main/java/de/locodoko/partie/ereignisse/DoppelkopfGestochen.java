package de.locodoko.partie.ereignisse;

import de.locodoko.partie.SpielerPosition;

import java.util.UUID;

/**
 * Domain Event: Ein Stich mit mindestens 40 Augen wurde gewonnen (Doppelkopf).
 *
 * <p>Gewinner ist der Spieler, der den Doppelkopf-Stich gewonnen hat.</p>
 */
public record DoppelkopfGestochen(UUID tischId, SpielerPosition gewinner) {}
