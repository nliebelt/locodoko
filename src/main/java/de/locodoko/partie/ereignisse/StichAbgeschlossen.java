package de.locodoko.partie.ereignisse;

import java.util.UUID;

/** Domain Event: Ein Stich wurde vollstaendig gespielt und sein Gewinner ermittelt. */
public record StichAbgeschlossen(UUID tischId) {}
