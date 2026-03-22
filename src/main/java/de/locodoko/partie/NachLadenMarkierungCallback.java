package de.locodoko.partie;

import org.springframework.data.relational.core.mapping.event.AfterConvertCallback;
import org.springframework.stereotype.Component;

/**
 * Markiert jede aus der Datenbank geladene Entity als "nicht neu" (isNew = false).
 * Damit weiss Spring Data JDBC bei einem spaeterem save() dass ein UPDATE statt
 * einem INSERT noetig ist — auch wenn die UUID schon im Konstruktor gesetzt wurde.
 */
@Component
class NachLadenMarkierungCallback implements AfterConvertCallback<AbstraktePersistenzEntity> {

    @Override
    public AbstraktePersistenzEntity onAfterConvert(AbstraktePersistenzEntity entity) {
        entity.markiereAlsGeladen();
        return entity;
    }
}
