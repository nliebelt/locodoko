package de.locodoko.tisch;

/**
 * Strukturierte Fehlerantwort fuer REST-Endpunkte.
 *
 * <p>Wird von {@link SpielverwaltungExceptionHandler} fuer alle fachlichen Fehler
 * (ungueltige Session, Konflikt, nicht gefunden) erzeugt. Der {@code fehlerCode}
 * ist maschinenlesbar (z.B. {@code SESSION_UNGUELTIG}), die {@code nachricht}
 * ist menschenlesbar.</p>
 *
 * @param fehlerCode  maschinenlesbarer Fehlercode
 * @param nachricht   menschenlesbare Beschreibung des Fehlers
 */
public record ApiFehlerAntwort(String fehlerCode, String nachricht) {
}
