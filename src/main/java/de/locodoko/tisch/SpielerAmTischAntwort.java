package de.locodoko.tisch;

import de.locodoko.spieler.SpielerEntity;

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
public record SpielerAmTischAntwort(UUID spielerId, String name, boolean istKi) {

    public static SpielerAmTischAntwort aus(SpielerEntity spieler) {
        return new SpielerAmTischAntwort(spieler.id(), spieler.name(), spieler.istKi());
    }
}
