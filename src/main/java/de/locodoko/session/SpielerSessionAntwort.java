package de.locodoko.session;

import de.locodoko.session.SpielerEntity;

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
 */
public record SpielerSessionAntwort(UUID spielerId, String name, boolean istKi, UUID aktiverTischId) {

    public static SpielerSessionAntwort aus(SpielerEntity spieler, UUID aktiverTischId) {
        return new SpielerSessionAntwort(spieler.id(), spieler.name(), spieler.istKi(), aktiverTischId);
    }
}
