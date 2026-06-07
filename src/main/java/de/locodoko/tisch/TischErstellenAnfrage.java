package de.locodoko.tisch;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Anfrage-DTO zum Erstellen eines neuen Tisches ({@code POST /api/tische}).
 *
 * <p>Enthaelt den gewuenschten Tischnamen (nicht leer, max. 100 Zeichen) und die
 * vollstaendige Konfiguration. Wird nach erfolgreicher Validierung an {@link TischService}
 * weitergeleitet, der den Tisch anlegt und den Ersteller automatisch beisetzt.</p>
 */
public record TischErstellenAnfrage(
    @NotBlank(message = "Der Tischname darf nicht leer sein.")
    @Size(max = 100, message = "Der Tischname darf hoechstens 100 Zeichen enthalten.")
    String name,
    @Valid TischKonfigurationDto konfiguration,
    /** Wenn true, wird der Tisch als PRIVAT erstellt (nur via Einladungslink betretbar). */
    Boolean privat,
    /** Optionaler Name eines Presets. Wenn angegeben, wird die manuelle 'konfiguration' ignoriert. */
    String presetName,
    /** Optionale Anzahl der Spiele. Überschreibt den Preset-Wert, wenn angegeben. */
    @Min(value = 1, message = "Die Anzahl der Spiele muss mindestens 1 betragen.")
    @Max(value = 240, message = "Die Anzahl der Spiele darf maximal 240 betragen.")
    Integer anzahlSpiele
) {
}
