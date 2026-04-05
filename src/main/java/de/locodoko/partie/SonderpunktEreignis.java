package de.locodoko.partie;

import de.locodoko.karten.SpielerPosition;

/**
 * Beschreibt ein konkretes Sonderpunkt-Ereignis mit Taeter und optionalem Opfer.
 *
 * <p>Taeter ist der Spieler, der den Sonderpunkt ausgeloest hat (z.B. Stichgewinner).
 * Opfer ist nur bei {@link Sonderpunkt#FUCHS_GEFANGEN} gesetzt (Spieler, dessen Fuchs
 * gefangen wurde). Bei {@link Sonderpunkt#KARLCHEN} und {@link Sonderpunkt#DOPPELKOPF}
 * ist das Opfer {@code null}.</p>
 */
public record SonderpunktEreignis(
    Sonderpunkt art,
    SpielerPosition taeter,
    SpielerPosition opfer
) {

    public SonderpunktEreignis {
        if (art == null) throw new IllegalArgumentException("art darf nicht null sein");
        if (taeter == null) throw new IllegalArgumentException("taeter darf nicht null sein");
    }
}
