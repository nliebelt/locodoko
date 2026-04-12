package de.locodoko.partie.ereignisse;

import java.util.UUID;

/**
 * Domain Event: Ein Spieler soll seinen Vorbehalt melden (Phase VORBEHALT_ANSAGE).
 * KI-Subscriber melden automatisch einen Vorbehalt.
 */
public record VorbehaltErwartet(UUID tischId) {}
