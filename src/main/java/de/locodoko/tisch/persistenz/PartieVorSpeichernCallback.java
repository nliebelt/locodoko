package de.locodoko.tisch.persistenz;

import de.locodoko.partie.Partie;
import de.locodoko.partie.Spiel;
import org.springframework.data.relational.core.mapping.event.BeforeConvertCallback;
import org.springframework.stereotype.Component;

/** Synchronisiert enthaltene {@link Spiel}-Entitaeten einer {@link Partie} vor dem Speichern. */
@Component
class PartieVorSpeichernCallback implements BeforeConvertCallback<Partie> {

    @Override
    public Partie onBeforeConvert(Partie partie) {
        for (Spiel spiel : partie.spiele()) {
            spiel.synchronisierePersistenzFelderVorSpeichern();
        }
        return partie;
    }
}
