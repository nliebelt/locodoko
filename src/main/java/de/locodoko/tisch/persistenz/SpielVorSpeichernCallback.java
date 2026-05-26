package de.locodoko.tisch.persistenz;

import de.locodoko.partie.Spiel;
import org.springframework.data.relational.core.mapping.event.BeforeConvertCallback;
import org.springframework.stereotype.Component;

/** Synchronisiert JSON-Persistenzfelder eines {@link Spiel} vor dem Speichern. */
@Component
class SpielVorSpeichernCallback implements BeforeConvertCallback<Spiel> {

    @Override
    public Spiel onBeforeConvert(Spiel spiel) {
        spiel.synchronisierePersistenzFelderVorSpeichern();
        return spiel;
    }
}
