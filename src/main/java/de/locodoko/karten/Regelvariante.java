package de.locodoko.karten;

/**
 * Klassifikation der Spielregeln einer Doppelkopf-Partie.
 *
 * <p>Wird aus den aktiven {@link Spielregeln} abgeleitet und ermoeglicht,
 * Spielerstatistiken getrennt nach Regelvariante zu fuehren.</p>
 *
 * <ul>
 *   <li>{@code TURNIER} — DKV-Turnierregeln ({@link Spielregeln#dkvRegeln()})</li>
 *   <li>{@code SONDER} — Standard-Hausregeln ({@link Spielregeln#standardRegeln()},
 *       {@link Spielregeln#ohneNeunenRegeln()}, {@link Spielregeln#locoBlatRegeln()})</li>
 *   <li>{@code FREI} — individuell konfigurierte Regeln</li>
 * </ul>
 */
public enum Regelvariante {
    TURNIER,
    SONDER,
    FREI
}
