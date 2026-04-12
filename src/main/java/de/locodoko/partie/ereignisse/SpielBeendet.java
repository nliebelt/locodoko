package de.locodoko.partie.ereignisse;

import java.util.UUID;

/** Domain Event: Das aktuelle Spiel wurde ausgewertet und abgeschlossen. */
public record SpielBeendet(UUID tischId) {}
