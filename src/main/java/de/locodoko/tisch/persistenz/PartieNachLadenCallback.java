package de.locodoko.tisch.persistenz;

import de.locodoko.partie.Partie;
import de.locodoko.partie.Spiel;
import org.springframework.data.relational.core.mapping.event.AfterConvertCallback;
import org.springframework.stereotype.Component;

/**
 * Initialisiert transiente Felder aller {@link Spiel}-Objekte nach dem Laden einer {@link Partie}.
 *
 * <p>Spring Data JDBC ruft {@code AfterConvertCallback} nur fuer Aggregate-Roots auf,
 * nicht fuer Kind-Entitaeten innerhalb einer {@code @MappedCollection}. Daher werden
 * die Spiel-Objekte in {@code Partie.spieleMap} nicht automatisch initialisiert.
 * Dieser Callback iteriert explizit ueber alle Spiel-Objekte und initialisiert deren
 * transiente JSONB-Felder.</p>
 */
@Component
class PartieNachLadenCallback implements AfterConvertCallback<Partie> {

    @Override
    public Partie onAfterConvert(Partie partie) {
        for (Spiel spiel : partie.spiele()) {
            spiel.initialisierePersistenzDefaultsNachLaden();
        }
        partie.initialisiereDomainFelderNachLaden();
        return partie;
    }
}
