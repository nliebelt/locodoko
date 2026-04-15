package de.locodoko.tisch;

import de.locodoko.spieler.SpielerEntity;
import io.swagger.v3.oas.annotations.media.Schema;

import java.util.UUID;

/**
 * Kurzdarstellung eines Spielers am Tisch in der REST-Antwort.
 *
 * <p>Wird in {@link TischAntwort#spieler()} eingebettet und zeigt ID, Namen und ob es
 * sich um einen KI-Spieler handelt. KI-Spieler werden beim Tischstart automatisch
 * hinzugefuegt, wenn weniger als vier menschliche Spieler am Tisch sitzen.</p>
 *
 * @param spielerId  eindeutige Spieler-ID
 * @param name       Anzeigename des Spielers
 * @param istKi      {@code true}, wenn es sich um einen KI-gesteuerten Spieler handelt
 */
@Schema(description = "Kurzdarstellung eines Spielers am Tisch.")
public record SpielerAmTischAntwort(
    @Schema(description = "Eindeutige Spieler-ID.", example = "a1b2c3d4-e5f6-7890-abcd-ef1234567890")
    UUID spielerId,
    @Schema(description = "Anzeigename des Spielers.", example = "Karlchen")
    String name,
    @Schema(description = "Ob es sich um einen KI-gesteuerten Spieler handelt.")
    boolean istKi
) {

    public static SpielerAmTischAntwort aus(SpielerEntity spieler) {
        return new SpielerAmTischAntwort(spieler.id(), spieler.name(), spieler.istKi());
    }
}
