package de.locodoko.partie;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.util.UUID;

/**
 * Persistierter Eintrag eines einzelnen Sonderpunkt-Ereignisses.
 *
 * <p>FK-Kind von {@link SpielergebnisArchiv}. Bildet ein {@link SonderpunktEreignis}
 * (Fuchs gefangen, Karlchen, Doppelkopf) zusammen mit der zugehoerigen Partei ab.</p>
 */
@Table("sonderpunkt_eintrag")
public class SonderpunktEintrag {

    @Id
    @Column("id")
    private UUID id;

    @Column("partei")
    private Partei partei;

    @Column("sonderpunkt_typ")
    private Sonderpunkt sonderpunktTyp;

    @Column("taeter_position")
    private SpielerPosition taeterPosition;

    @Column("opfer_position")
    private SpielerPosition opferPosition;

    /** Fuer Spring Data JDBC (Reflektion). */
    protected SonderpunktEintrag() {}

    private SonderpunktEintrag(Partei partei, Sonderpunkt sonderpunktTyp,
                               SpielerPosition taeterPosition, SpielerPosition opferPosition) {
        this.id = UUID.randomUUID();
        this.partei = partei;
        this.sonderpunktTyp = sonderpunktTyp;
        this.taeterPosition = taeterPosition;
        this.opferPosition = opferPosition;
    }

    /**
     * Erzeugt einen persistierbaren Eintrag aus einem Domain-Ereignis.
     *
     * @param partei   die Partei, der dieser Sonderpunkt gutgeschrieben wird
     * @param ereignis das konkrete Sonderpunkt-Ereignis mit Taeter und optionalem Opfer
     */
    public static SonderpunktEintrag aus(Partei partei, SonderpunktEreignis ereignis) {
        return new SonderpunktEintrag(partei, ereignis.art(), ereignis.taeter(), ereignis.opfer());
    }

    public UUID id() { return id; }
    public Partei partei() { return partei; }
    public Sonderpunkt sonderpunktTyp() { return sonderpunktTyp; }
    public SpielerPosition taeterPosition() { return taeterPosition; }
    public SpielerPosition opferPosition() { return opferPosition; }
}
