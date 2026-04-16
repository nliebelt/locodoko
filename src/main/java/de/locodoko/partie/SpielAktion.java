package de.locodoko.partie;

import java.util.List;

/**
 * Ergebnis von {@link Spiel#spieleKarte}: neuer Spielstand plus die dabei entstandenen Ereignisse.
 *
 * <p>Aufrufer können {@link #ereignisse()} auswerten um zu erfahren ob z.B. ein Stich
 * abgeschlossen wurde, ohne einen State-Diff berechnen zu müssen.</p>
 */
public record SpielAktion(Spiel neuerStand, List<SpielEreignis> ereignisse) {}
