package de.locodoko.tisch.persistenz;

import de.locodoko.partie.Partie;
import de.locodoko.partie.Spiel;
import org.springframework.data.relational.core.mapping.event.AfterConvertCallback;
import org.springframework.stereotype.Component;

/**
 * Initialisiert Domain-Felder einer {@link Partie} nach dem Laden.
 */
@Component
class PartieNachLadenCallback implements AfterConvertCallback<Partie> {

    @Override
    public Partie onAfterConvert(Partie partie) {
        partie.initialisiereDomainFelderNachLaden();
        return partie;
    }
}
