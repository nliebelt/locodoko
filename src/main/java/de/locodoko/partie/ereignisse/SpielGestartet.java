package de.locodoko.partie.ereignisse;

import java.util.UUID;

/** Domain Event: Ein neues Spiel wurde innerhalb einer laufenden Partie gestartet. */
public record SpielGestartet(UUID tischId) {}
