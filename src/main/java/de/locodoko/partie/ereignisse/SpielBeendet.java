package de.locodoko.partie.ereignisse;

import java.util.Map;
import java.util.UUID;

/**
 * Domain Event: Das aktuelle Spiel wurde ausgewertet und abgeschlossen.
 *
 * <p>Enthaelt pro Spieler die relevanten Statistik-Daten, damit Listener
 * (z.B. in {@code spieler/}) die Spieler-Statistiken aktualisieren koennen,
 * ohne auf das {@code tisch/}- oder {@code partie/}-Modul zuzugreifen.</p>
 */
public record SpielBeendet(
    UUID tischId,
    String tischName,
    int spielNummer,
    Map<UUID, SpielerSpielDaten> spielerDaten
) {

    /**
     * Statistik-relevante Daten eines einzelnen Spielers fuer ein abgeschlossenes Spiel.
     */
    public record SpielerSpielDaten(
        boolean sieger,
        int spielpunkte,
        int fuchsGefangen,
        int fuchsVerloren,
        int karlchenGespielt,
        int doppelkoepfe,
        boolean istSolist
    ) {}
}
