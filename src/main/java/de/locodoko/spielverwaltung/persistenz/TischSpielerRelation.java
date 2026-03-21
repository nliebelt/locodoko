package de.locodoko.spielverwaltung.persistenz;

import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.util.UUID;

/**
 * Repraesentiert einen Eintrag in der tisch_spieler Join-Tabelle.
 * Dient als Child-Entity von TischEntity (kein eigenes @Id, da es Teil des Aggregates ist).
 * Speichert die spieler_id als Fremdschluessel — der Spieler selbst ist ein eigenes Aggregat.
 */
@Table("tisch_spieler")
public class TischSpielerRelation {

    /** Fremdschluessel auf die Spieler-Tabelle. */
    @Column("spieler_id")
    private UUID spielerId;

    protected TischSpielerRelation() {
    }

    public TischSpielerRelation(UUID spielerId) {
        this.spielerId = spielerId;
    }

    public UUID spielerId() {
        return spielerId;
    }
}
