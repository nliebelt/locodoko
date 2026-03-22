package de.locodoko.session;

import de.locodoko.session.SpielerEntity;

import java.util.UUID;

/**
 * REST-Antwort fuer Session-Endpunkte ({@code GET/POST /api/spieler/session}).
 *
 * <p>Liefert die wesentlichen Spieler-Informationen nach erfolgreicher Session-Erstellung
 * oder -Wiederherstellung: ID, Name und ob es sich um einen KI-Spieler handelt.</p>
 *
 * @param spielerId  eindeutige Spieler-ID
 * @param name       Anzeigename des Spielers
 * @param istKi      {@code true} fuer KI-gesteuerte Spieler (im normalen Flow immer {@code false})
 */
public record SpielerSessionAntwort(UUID spielerId, String name, boolean istKi) {

    public static SpielerSessionAntwort aus(SpielerEntity spieler) {
        return new SpielerSessionAntwort(spieler.id(), spieler.name(), spieler.istKi());
    }
}
