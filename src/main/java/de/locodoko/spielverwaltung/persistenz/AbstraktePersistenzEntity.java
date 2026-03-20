package de.locodoko.spielverwaltung.persistenz;

import jakarta.persistence.Column;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;

import java.time.Instant;
import java.util.UUID;

@MappedSuperclass
public abstract class AbstraktePersistenzEntity {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(nullable = false, updatable = false)
    private UUID id;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant erstelltAm;

    @UpdateTimestamp
    @Column(nullable = false)
    private Instant aktualisiertAm;

    public UUID id() {
        return id;
    }

    public Instant erstelltAm() {
        return erstelltAm;
    }

    public Instant aktualisiertAm() {
        return aktualisiertAm;
    }
}
