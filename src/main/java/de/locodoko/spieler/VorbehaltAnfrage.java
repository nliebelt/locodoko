package de.locodoko.spieler;

import de.locodoko.partie.VorbehaltAnsage;

/**
 * WebSocket-Anfrage zum Melden eines Vorbehalts ({@code /app/tisch/{id}/vorbehalt}).
 *
 * @param vorbehalt  der gemeldete Vorbehalt (GESUND oder ein Sonderspiel-Vorbehalt)
 */
public record VorbehaltAnfrage(VorbehaltAnsage vorbehalt) {
}
