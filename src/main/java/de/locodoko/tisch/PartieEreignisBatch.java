package de.locodoko.tisch;

import java.util.List;

/**
 * Atomare Sammlung aller Partie-Ereignisse einer Transaktion.
 *
 * <p>Alle Ereignisse eines {@code PartieEreignisBatch} stammen aus derselben
 * Datenbanktransaktion und tragen dieselbe Versionsnummer. Der Batch wird als
 * eine einzige WebSocket-Nachricht zugestellt — entweder alle Ereignisse kommen
 * an oder keines. Dies ermoeglicht dem Frontend, Sequenzluecken zuverlaessig zu
 * erkennen: fehlt Batch N+1 und stattdessen kommt N+2, ist ein ganzer Batch verloren.</p>
 */
public record PartieEreignisBatch(
    long version,
    List<PartieEreignisAntwort> ereignisse
) {}
