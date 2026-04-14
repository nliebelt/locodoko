package de.locodoko.spieler;

import java.util.UUID;

/**
 * Abstrahiert Tisch-Abfragen fuer das Spieler-Modul (Dependency Inversion).
 *
 * <p>Verhindert eine direkte Abhaengigkeit von {@code spieler → tisch}.
 * Die Implementierung liegt im {@code tisch}-Modul.</p>
 */
public interface SpielerTischAbfrage {

    /** Prueft ob ein Spieler mit der gegebenen Session-ID an einem Tisch sitzt. */
    boolean spielerSitztAmTisch(String sessionId);

    /**
     * Gibt die Tisch-ID zurueck, an dem der Spieler sitzt, oder {@code null}.
     *
     * @param spielerId Spieler-ID
     * @return Tisch-UUID oder {@code null}
     */
    UUID ladeAktiveTischId(UUID spielerId);
}
