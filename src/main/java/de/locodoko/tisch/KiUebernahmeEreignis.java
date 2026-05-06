package de.locodoko.tisch;

/**
 * Wird publiziert wenn ein Spieler die Verbindung verliert und die KI übernimmt.
 * {@link de.locodoko.tisch.KiTischOrchestrator} reagiert darauf und startet
 * die KI-Automatisierung für den betroffenen Tisch.
 */
public record KiUebernahmeEreignis(TischId tischId) {}
