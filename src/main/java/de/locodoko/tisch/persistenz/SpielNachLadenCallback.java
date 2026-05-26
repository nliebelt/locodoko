package de.locodoko.tisch.persistenz;

import de.locodoko.partie.Spiel;
import org.springframework.data.relational.core.mapping.event.AfterConvertCallback;
import org.springframework.stereotype.Component;

/**
 * Initialisiert transiente Felder eines {@link Spiel} nach dem Laden aus der Datenbank.
 *
 * <p>Spring Data JDBC laedt JSONB-Spalten in {@code @Column String}-Felder. Die eigentlichen
 * Domain-Felder ({@code haende}, {@code abgeschlosseneStiche}, etc.) sind {@code @Transient}
 * und werden beim Laden nicht gefuellt. Dieser Callback ruft
 * {@link Spiel#initialisierePersistenzDefaultsNachLaden()} auf, um diese Felder sofort
 * aus den JSON-Strings zu deserialisieren.</p>
 */
@Component
class SpielNachLadenCallback implements AfterConvertCallback<Spiel> {

    @Override
    public Spiel onAfterConvert(Spiel spiel) {
        spiel.initialisierePersistenzDefaultsNachLaden();
        return spiel;
    }
}
