package de.locodoko.partie.ereignisse;

import java.util.Map;
import java.util.UUID;

/**
 * Domain Event: Das aktuelle Spiel wurde ausgewertet und abgeschlossen.
 *
 * <p>Enthaelt pro Spieler die relevanten Statistik-Daten, damit Listener
 * (z.B. in {@code spieler/}) die Spieler-Statistiken aktualisieren koennen,
 * ohne auf das {@code tisch/}- oder {@code partie/}-Modul zuzugreifen.</p>
 *
 * <p>{@code partieBeendet} ist {@code true}, wenn dies das letzte Spiel der Partie war.
 * In diesem Fall enthaelt {@code kumulativePartiePunkte} in {@link SpielerSpielDaten}
 * den Endpunktestand jedes Spielers fuer den Partieverlauf.</p>
 */
public record SpielBeendet(
    UUID tischId,
    String tischName,
    int spielNummer,
    Map<UUID, SpielerSpielDaten> spielerDaten,
    boolean partieBeendet
) {

    /**
     * Statistik-relevante Daten eines einzelnen Spielers fuer ein abgeschlossenes Spiel.
     *
     * <p>{@code kumulativePartiePunkte}: akkumulierter Gesamtpunktestand dieses Spielers
     * innerhalb der Partie nach diesem Spiel. Wird fuer {@code PartieErgebnisEintrag}
     * benoetigt wenn {@code partieBeendet == true}.</p>
     */
    public record SpielerSpielDaten(
        boolean sieger,
        int spielpunkte,
        int fuchsGefangen,
        int fuchsVerloren,
        int karlchenGespielt,
        int doppelkoepfe,
        boolean istSolist,
        int kumulativePartiePunkte
    ) {}
}
