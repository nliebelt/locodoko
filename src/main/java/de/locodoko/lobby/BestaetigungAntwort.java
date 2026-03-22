package de.locodoko.lobby;

/**
 * Einfache Bestaetigungs-Antwort fuer REST-Endpunkte ohne inhaltliche Nutzdaten.
 *
 * <p>Wird bei erfolgreichen Aktionen (z.B. Tisch verlassen, Spiel starten) zurueckgegeben,
 * die keine weiteren Daten liefern, aber eine Rueckmeldung an den Client senden sollen.</p>
 *
 * @param nachricht  menschenlesbare Erfolgsmeldung
 */
public record BestaetigungAntwort(String nachricht) {
}
