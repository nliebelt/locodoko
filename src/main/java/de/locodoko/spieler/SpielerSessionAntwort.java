package de.locodoko.spieler;

import de.locodoko.spieler.SpielerEntity;
import io.swagger.v3.oas.annotations.media.Schema;

import java.util.UUID;

/**
 * REST-Antwort fuer Session-Endpunkte ({@code GET/POST /api/spieler/session}).
 *
 * <p>Liefert die wesentlichen Spieler-Informationen nach erfolgreicher Session-Erstellung
 * oder -Wiederherstellung: ID, Name, ob KI und — falls der Spieler gerade an einem Tisch sitzt —
 * dessen ID fuer automatische Session-Recovery im Frontend.</p>
 *
 * @param spielerId      eindeutige Spieler-ID
 * @param name           Anzeigename des Spielers
 * @param istKi          {@code true} fuer KI-gesteuerte Spieler (im normalen Flow immer {@code false})
 * @param aktiverTischId ID des Tisches, an dem der Spieler aktuell sitzt; {@code null} falls keiner
 * @param anzeigeName    oeffentlicher Anzeigename (Fallback: name)
 * @param avatarFarbe    Avatar-Farbe als Hex-String
 */
@Schema(description = "Spieler-Session-Informationen nach Erstellung oder Wiederherstellung.")
public record SpielerSessionAntwort(
    @Schema(description = "Eindeutige Spieler-ID.", example = "a1b2c3d4-e5f6-7890-abcd-ef1234567890")
    UUID spielerId,
    @Schema(description = "Anzeigename des Spielers.", example = "Karlchen")
    String name,
    @Schema(description = "Ob es sich um einen KI-gesteuerten Spieler handelt.")
    boolean istKi,
    @Schema(description = "ID des Tisches, an dem der Spieler aktuell sitzt; null falls keiner.", example = "f47ac10b-58cc-4372-a567-0e02b2c3d479")
    UUID aktiverTischId,
    @Schema(description = "Oeffentlicher Anzeigename.", example = "Karlchen")
    String anzeigeName,
    @Schema(description = "Avatar-Farbe als Hex-String.", example = "#FF5733")
    String avatarFarbe
) {

    public static SpielerSessionAntwort aus(SpielerEntity spieler, UUID aktiverTischId) {
        return new SpielerSessionAntwort(spieler.id(), spieler.name(), spieler.istKi(), aktiverTischId,
            spieler.anzeigeName(), spieler.avatarFarbe());
    }
}
