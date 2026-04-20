package de.locodoko.ki;

import de.locodoko.tisch.KiSchwierigkeit;
import org.springframework.stereotype.Component;

/**
 * Fabrik fuer KI-Strategien nach Schwierigkeitsstufe.
 *
 * <p>Erzeugt die passende {@link KiStrategie}-Implementierung anhand der am Tisch
 * konfigurierten {@link KiSchwierigkeit}. Jeder Aufruf erzeugt eine neue Instanz,
 * da die Strategien zustandslos sind und keine gemeinsamen Felder haben.</p>
 */
@Component
public class KiStrategieFactory {

    /**
     * Erzeugt die passende KI-Strategie fuer die angegebene Schwierigkeitsstufe.
     *
     * @param schwierigkeit die gewuenschte Schwierigkeitsstufe
     * @return eine neue Instanz der entsprechenden Strategie
     */
    public KiStrategie erzeuge(KiSchwierigkeit schwierigkeit) {
        return switch (schwierigkeit) {
            case LEICHT -> new LeichteKiStrategie();
            case STANDARD -> new StandardKiStrategie();
            case SCHWER -> new SchwerKiStrategie();
        };
    }
}
