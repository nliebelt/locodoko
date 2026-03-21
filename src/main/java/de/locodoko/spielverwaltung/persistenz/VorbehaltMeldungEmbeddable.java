package de.locodoko.spielverwaltung.persistenz;

import de.locodoko.spiel.karten.SpielerPosition;
import de.locodoko.spiel.partie.VorbehaltAnsage;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;

import java.util.Objects;

@Embeddable
public class VorbehaltMeldungEmbeddable {

    @Enumerated(EnumType.STRING)
    @Column(name = "spieler_position", nullable = false)
    private SpielerPosition spielerPosition;

    @Enumerated(EnumType.STRING)
    @Column(name = "vorbehalt_ansage", nullable = false)
    private VorbehaltAnsage ansage;

    protected VorbehaltMeldungEmbeddable() {
    }

    private VorbehaltMeldungEmbeddable(SpielerPosition spielerPosition, VorbehaltAnsage ansage) {
        this.spielerPosition = Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        this.ansage = Objects.requireNonNull(ansage, "ansage darf nicht null sein");
    }

    public static VorbehaltMeldungEmbeddable neu(SpielerPosition spielerPosition, VorbehaltAnsage ansage) {
        return new VorbehaltMeldungEmbeddable(spielerPosition, ansage);
    }

    public SpielerPosition spielerPosition() {
        return spielerPosition;
    }

    public VorbehaltAnsage ansage() {
        return ansage;
    }
}
