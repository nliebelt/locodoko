package de.locodoko.partie;

/**
 * Wird geworfen, wenn eine Spielaktion wegen eines Zustandskonflikts nicht ausfuehrbar ist (HTTP 409).
 *
 * <p>Typische Faelle: Aktion in falscher Spielphase, falscher Spieler am Zug, Schmeiss-Recht bereits genutzt,
 * Partie bereits beendet. Im Gegensatz zur {@code UngueltigerSpielzugException} (422 — Regelverstoß)
 * zeigt diese Exception einen Konflikt mit dem aktuellen Spielzustand an.</p>
 */
public class SpielzugKonfliktException extends RuntimeException {

    public SpielzugKonfliktException(String nachricht) {
        super(nachricht);
    }
}
