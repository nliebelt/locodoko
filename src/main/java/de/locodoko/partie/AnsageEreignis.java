package de.locodoko.partie;

import de.locodoko.karten.SpielerPosition;

import java.util.Objects;

public record AnsageEreignis(SpielerPosition spieler, Ansage ansage) {

    public AnsageEreignis {
        Objects.requireNonNull(spieler, "spieler darf nicht null sein");
        Objects.requireNonNull(ansage, "ansage darf nicht null sein");
    }
}
