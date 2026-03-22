package de.locodoko.partie;

import de.locodoko.karten.SpielerPosition;

import java.util.Objects;

/**
 * Die Vorbehalt-Meldung eines einzelnen Spielers in der Vorbehalt-Ansage-Phase.
 *
 * <p>Verbindet die {@link SpielerPosition} mit der gemeldeten {@link VorbehaltAnsage}.
 * Nach der Ansage-Runde werden alle vier Meldungen gesammelt und per
 * {@link Spiel#loeseVorbehalteAuf()} zur Vorbehalt-Aufloesung uebergeben.</p>
 *
 * @param spielerPosition  Position des meldenden Spielers
 * @param ansage           der gemeldete Vorbehalt (oder GESUND)
 */
public record VorbehaltMeldung(SpielerPosition spielerPosition, VorbehaltAnsage ansage) {

    public VorbehaltMeldung {
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        Objects.requireNonNull(ansage, "ansage darf nicht null sein");
    }

    public boolean istVorbehalt() {
        return !ansage.istGesund();
    }
}
