package de.locodoko.tisch;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Antwort-DTO fuer ein Regel-Preset (z.B. Loco-Blatt oder DKV-Regeln).
 */
@Schema(description = "Informationen ueber ein verfuegbares Regel-Preset")
public record TischPresetAntwort(
    @Schema(description = "Technischer Name des Presets (zur Verwendung beim Erstellen)", example = "LOCO_BLATT")
    String name,
    @Schema(description = "Anzeigename fuer die UI", example = "Loco-Blatt (Hausregeln)")
    String label,
    @Schema(description = "Kurze Beschreibung der Regeln", example = "Alle Sonderregeln aktiv, ohne Neunen.")
    String beschreibung,
    @Schema(description = "Die vollstaendige Konfiguration dieses Presets")
    TischKonfigurationDto konfiguration
) {
}
