package de.locodoko.partie.ereignisse;

import de.locodoko.partie.SpielerPosition;

import java.util.UUID;

/** Domain Event: Schweinchen wurde implizit gemeldet (erstes Karo-As gespielt). */
public record SchweinchenGemeldet(UUID tischId, SpielerPosition spielerPosition) {}
