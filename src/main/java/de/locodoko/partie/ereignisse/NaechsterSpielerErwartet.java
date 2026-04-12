package de.locodoko.partie.ereignisse;

import java.util.UUID;

/**
 * Domain Event: Ein Spieler wird erwartet — entweder in der Stichphase, beim Armut-Tausch
 * oder bei der Spielauswertung. KI-Subscriber reagieren darauf und fuehren den naechsten Zug aus.
 */
public record NaechsterSpielerErwartet(UUID tischId) {}
