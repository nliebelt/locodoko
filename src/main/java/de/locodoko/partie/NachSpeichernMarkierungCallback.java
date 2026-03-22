package de.locodoko.partie;

import org.springframework.data.relational.core.mapping.event.AfterSaveCallback;
import org.springframework.stereotype.Component;

/**
 * Markiert jede gespeicherte Entity als "nicht neu" (isNew = false).
 * Ohne diesen Callback wuerde isNew nach dem ersten save() immer noch true bleiben,
 * und ein weiterer save()-Aufruf wuerde ein doppeltes INSERT ausloesen statt UPDATE.
 * Dies ist besonders kritisch fuer Entities wie PartieEntity, die vom TischRepositoryImpl
 * mehrfach gespeichert werden koennen (z.B. bei Spielzustandsaenderungen).
 */
@Component
class NachSpeichernMarkierungCallback implements AfterSaveCallback<AbstraktePersistenzEntity> {

    @Override
    public AbstraktePersistenzEntity onAfterSave(AbstraktePersistenzEntity entity) {
        entity.markiereAlsGeladen();
        return entity;
    }
}
