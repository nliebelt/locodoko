package de.locodoko.spielverwaltung.persistenz;

import de.locodoko.spiel.karten.SpielerPosition;
import de.locodoko.spiel.partie.Ansage;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;

import java.util.Objects;

@Embeddable
public class AnsageEreignisEmbeddable {

    @Enumerated(EnumType.STRING)
    @Column(name = "spieler_position", nullable = false)
    private SpielerPosition spielerPosition;

    @Enumerated(EnumType.STRING)
    @Column(name = "ansage", nullable = false)
    private Ansage ansage;

    protected AnsageEreignisEmbeddable() {
    }

    private AnsageEreignisEmbeddable(SpielerPosition spielerPosition, Ansage ansage) {
        this.spielerPosition = Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        this.ansage = Objects.requireNonNull(ansage, "ansage darf nicht null sein");
    }

    public static AnsageEreignisEmbeddable neu(SpielerPosition spielerPosition, Ansage ansage) {
        return new AnsageEreignisEmbeddable(spielerPosition, ansage);
    }

    public SpielerPosition spielerPosition() {
        return spielerPosition;
    }

    public Ansage ansage() {
        return ansage;
    }
}
