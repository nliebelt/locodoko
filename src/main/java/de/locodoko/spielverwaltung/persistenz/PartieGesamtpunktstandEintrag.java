package de.locodoko.spielverwaltung.persistenz;

import de.locodoko.spiel.karten.SpielerPosition;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

/**
 * Repraesentiert einen Eintrag im Gesamtpunktestand einer Partie.
 * Child-Entity von PartieEntity (kein eigenes @Id).
 * Entspricht einem Eintrag in der Map&lt;SpielerPosition, Integer&gt; aus dem JPA-Modell.
 */
@Table("partie_gesamtpunktestand")
public class PartieGesamtpunktstandEintrag {

    @Column("spieler_position")
    private String spielerPosition;

    @Column("spielpunkte")
    private int spielpunkte;

    protected PartieGesamtpunktstandEintrag() {
    }

    public PartieGesamtpunktstandEintrag(SpielerPosition spielerPosition, int spielpunkte) {
        this.spielerPosition = spielerPosition.name();
        this.spielpunkte = spielpunkte;
    }

    public SpielerPosition spielerPosition() {
        return SpielerPosition.valueOf(spielerPosition);
    }

    public int spielpunkte() {
        return spielpunkte;
    }
}
