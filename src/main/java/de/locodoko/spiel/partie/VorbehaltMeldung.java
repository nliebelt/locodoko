package de.locodoko.spiel.partie;

import de.locodoko.spiel.karten.SpielerPosition;

import java.util.Objects;

public record VorbehaltMeldung(SpielerPosition spielerPosition, VorbehaltAnsage ansage) {

    public VorbehaltMeldung {
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        Objects.requireNonNull(ansage, "ansage darf nicht null sein");
    }

    public boolean istVorbehalt() {
        return !ansage.istGesund();
    }
}
