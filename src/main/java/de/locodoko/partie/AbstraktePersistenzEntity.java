package de.locodoko.partie;

import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.domain.Persistable;
import org.springframework.data.relational.core.mapping.Column;

import java.time.Instant;
import java.util.UUID;

/**
 * Abstrakte Basis fuer alle Persistenz-Entities.
 * Implementiert Persistable<UUID>, damit Spring Data JDBC INSERT vs. UPDATE
 * korrekt unterscheiden kann, obwohl die UUID bereits im Konstruktor gesetzt wird.
 * Ohne Persistable wuerde Spring Data JDBC wegen der gesetzten ID immer ein UPDATE
 * versuchen, was bei neuen Entities zu einem Fehler fuehrt.
 *
 * - isNew = true: neue Entity (aus Konstruktor) → INSERT
 * - isNew = false: geladene Entity (via AfterConvertCallback) → UPDATE
 */
public abstract class AbstraktePersistenzEntity implements Persistable<UUID> {

    @Id
    @Column("id")
    private UUID id;

    @Column("erstellt_am")
    private Instant erstelltAm;

    @Column("aktualisiert_am")
    private Instant aktualisiertAm;

    /**
     * Gibt an, ob diese Entity neu ist (noch nicht in der Datenbank).
     * Wird nach dem Laden aus der DB durch AfterConvertCallback auf false gesetzt.
     */
    @Transient
    private boolean isNew = true;

    protected AbstraktePersistenzEntity() {
        // Neue Entities erhalten sofort eine UUID und Erstellungszeitstempel.
        // Der AuditZeitstempelCallback aktualisiert aktualisiertAm bei jedem Speichern.
        // erstelltAm wird hier gesetzt, damit auch Child-Entities (z.B. SpielEntity
        // in PartieEntity) einen Timestamp haben — BeforeConvertCallback laeuft nur
        // fuer Aggregate Roots, nicht fuer deren Kinder.
        this.id = UUID.randomUUID();
        Instant jetzt = Instant.now();
        this.erstelltAm = jetzt;
        this.aktualisiertAm = jetzt;
    }

    /** Pflichtimplementierung fuer Persistable — liefert die UUID als ID. */
    @Override
    public UUID getId() {
        return id;
    }

    /**
     * Pflichtimplementierung fuer Persistable.
     * Entscheidet ob Spring Data JDBC INSERT (true) oder UPDATE (false) ausfuehrt.
     */
    @Override
    public boolean isNew() {
        return isNew;
    }

    /**
     * Wird vom AfterConvertCallback aufgerufen, nachdem die Entity aus der DB geladen wurde.
     * Setzt isNew auf false, damit spaetere saves() ein UPDATE erzeugen.
     */
    void markiereAlsGeladen() {
        this.isNew = false;
    }

    public UUID id() {
        return id;
    }

    public Instant erstelltAm() {
        return erstelltAm;
    }

    public Instant aktualisiertAm() {
        return aktualisiertAm;
    }

    /** Wird vom AuditZeitstempelCallback gesetzt, wenn die Entity neu ist. */
    void setzeErstelltAm(Instant erstelltAm) {
        this.erstelltAm = erstelltAm;
    }

    /** Wird vom AuditZeitstempelCallback bei jedem Speichern gesetzt. */
    void setzeAktualisiertAm(Instant aktualisiertAm) {
        this.aktualisiertAm = aktualisiertAm;
    }
}
