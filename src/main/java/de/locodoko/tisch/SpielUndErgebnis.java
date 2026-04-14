package de.locodoko.tisch;

import de.locodoko.partie.Spiel;

/**
 * Wrapper fuer das Ergebnis einer Registry-Aktion: enthaelt das mutierte Spiel
 * sowie einen frei definierten Rueckgabewert.
 *
 * @param neuesSpiel das mutierte, unveraenderliche Spiel nach der Aktion
 * @param wert       das Ergebnis der Aktion, z.B. das Spiel selbst oder void
 */
public record SpielUndErgebnis<T>(Spiel neuesSpiel, T wert) {
}
