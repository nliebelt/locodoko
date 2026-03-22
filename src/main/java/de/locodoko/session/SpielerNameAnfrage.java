package de.locodoko.session;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Anfrage-DTO zum Aendern des Spielernamens ({@code PUT /api/spieler/session}).
 *
 * <p>Namensaenderungen sind nur erlaubt, solange der Spieler an keinem Tisch sitzt.
 * Validierung: Name darf nicht leer sein und darf maximal 40 Zeichen lang sein.</p>
 */
public record SpielerNameAnfrage(
    @NotBlank(message = "name darf nicht leer sein")
    @Size(max = 40, message = "name darf hoechstens 40 Zeichen lang sein")
    String name
) {
}
