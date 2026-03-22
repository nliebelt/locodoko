package de.locodoko.partie;

import org.springframework.data.relational.core.mapping.event.BeforeConvertCallback;
import org.springframework.stereotype.Component;

import java.time.Instant;

/**
 * Setzt automatisch die Zeitstempel-Felder (erstelltAm, aktualisiertAm)
 * vor dem Persistieren einer Entity.
 * Ersetzt Hibernates @CreationTimestamp/@UpdateTimestamp fuer Spring Data JDBC.
 */
@Component
class AuditZeitstempelCallback implements BeforeConvertCallback<AbstraktePersistenzEntity> {

    @Override
    public AbstraktePersistenzEntity onBeforeConvert(AbstraktePersistenzEntity entity) {
        // aktualisiertAm bei jedem Speichern aktualisieren.
        // erstelltAm wird bereits im Konstruktor gesetzt, damit auch Child-Entities
        // (die den BeforeConvertCallback nicht erhalten) korrekte Zeitstempel haben.
        entity.setzeAktualisiertAm(Instant.now());
        return entity;
    }
}
