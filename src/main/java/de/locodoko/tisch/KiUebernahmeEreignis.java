package de.locodoko.tisch;

/**
 * Wird publiziert wenn ein Spieler die Verbindung verliert und die KI übernimmt.
 * {@link de.locodoko.ki.orchestrierung.KiEventAdapter} reagiert darauf und startet
 * die KI-Automatisierung für den betroffenen Tisch.
 */
public record KiUebernahmeEreignis(TischId tischId) {}
