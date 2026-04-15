package de.locodoko.tisch;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Einfache Bestaetigungs-Antwort fuer REST-Endpunkte ohne inhaltliche Nutzdaten.
 *
 * <p>Wird bei erfolgreichen Aktionen (z.B. Tisch verlassen, Spiel starten) zurueckgegeben,
 * die keine weiteren Daten liefern, aber eine Rueckmeldung an den Client senden sollen.</p>
 *
 * @param nachricht  menschenlesbare Erfolgsmeldung
 */
@Schema(description = "Einfache Bestaetigungsantwort ohne inhaltliche Nutzdaten.")
public record BestaetigungAntwort(
    @Schema(description = "Menschenlesbare Erfolgsmeldung.", example = "Tisch erfolgreich verlassen.")
    String nachricht
) {
}
