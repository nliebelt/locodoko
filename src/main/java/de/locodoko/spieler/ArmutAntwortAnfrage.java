package de.locodoko.spieler;

import java.util.List;

/**
 * WebSocket-Anfrage fuer die Armut-Antwort ({@code /app/tisch/{id}/armut-antwort}).
 *
 * <p>Wird vom angefragten Spieler gesendet, um das Armut-Angebot anzunehmen oder abzulehnen.
 * Bei Annahme muessen {@code kartenIds} die IDs der zurueckzugebenden Karten enthalten.</p>
 *
 * @param angenommen  {@code true}, wenn der Spieler das Armut-Angebot annimmt
 * @param kartenIds   IDs der Karten, die bei Annahme zurueckgegeben werden
 */
public record ArmutAntwortAnfrage(boolean angenommen, List<String> kartenIds) {
}
