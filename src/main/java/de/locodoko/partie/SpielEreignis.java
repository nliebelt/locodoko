package de.locodoko.partie;

import de.locodoko.karten.Karte;

import java.util.List;

/**
 * Domänenereignisse die beim Aufruf von {@link Spiel#spieleKarte} entstehen.
 *
 * <p>Ermöglicht es Aufrufern (z.B. SpielAktionsService) zu wissen WAS passiert ist,
 * ohne State-Diffs aus zwei Snapshots berechnen zu müssen.</p>
 */
public sealed interface SpielEreignis
        permits SpielEreignis.KarteGespielt, SpielEreignis.StichAbgeschlossenEreignis {

    /** Eine Karte wurde von einem Spieler auf den Tisch gelegt. */
    record KarteGespielt(SpielerPosition position, Karte karte) implements SpielEreignis {}

    /** Ein vollständiger Stich wurde abgeschlossen inklusive Sonderpunktauswertung. */
    record StichAbgeschlossenEreignis(Stich stich, List<SonderpunktEreignis> sonderpunkte)
            implements SpielEreignis {}
}
