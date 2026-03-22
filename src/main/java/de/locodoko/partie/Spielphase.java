package de.locodoko.partie;

/**
 * Explizite Phase innerhalb eines einzelnen Doppelkopf-Spiels.
 *
 * <p>Die Phasen laufen sequenziell ab: Karten austeilen → Vorbehalt ansagen →
 * Vorbehalt aufloesen (optional: Armut-Tausch) → Stichphase → Auswertung →
 * Gesamtstand aktualisieren. Jede Phase erlaubt nur die fuer sie relevanten Aktionen;
 * ungueltige Uebergaenge werden in {@link Spiel} mit einer Exception abgewiesen.</p>
 */
public enum Spielphase {
    KARTEN_AUSTEILEN,
    VORBEHALT_ANSAGE,
    VORBEHALT_AUFLOESUNG,
    ARMUT_TAUSCH,
    STICHPHASE,
    AUSWERTUNG,
    GESAMTSTAND_AKTUALISIEREN
}
