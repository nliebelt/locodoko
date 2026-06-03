package de.locodoko.partie.ereignisse;

import de.locodoko.karten.Regelvariante;

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
    boolean partieBeendet,
    Regelvariante regelvariante
) {

    /**
     * Statistik-relevante Daten eines einzelnen Spielers fuer ein abgeschlossenes Spiel.
     *
     * <p>{@code kumulativePartiePunkte}: akkumulierter Gesamtpunktestand dieses Spielers
     * innerhalb der Partie nach diesem Spiel.</p>
     *
     * <p>{@code istReSpieler}: ob der Spieler in diesem Spiel in der Re-Partei war.</p>
     * <p>{@code spieltypName}: Name des {@code Spieltyp}-Enums (z.B. {@code "HOCHZEIT"},
     * {@code "ARMUT"}, {@code "SOLO_DAME"}). Leer fuer {@code NORMALSPIEL}.</p>
     * <p>{@code hatArmutAngesagt}: der Spieler hat in diesem Spiel Armut angesagt.</p>
     * <p>{@code hatArmutUebernommen}: der Spieler hat die Armut eines anderen uebernommen.</p>
     */
    public record SpielerSpielDaten(
        boolean sieger,
        int spielpunkte,
        int fuchsGefangen,
        int fuchsVerloren,
        int karlchenGespielt,
        int doppelkoepfe,
        boolean istSolist,
        int kumulativePartiePunkte,
        boolean istReSpieler,
        String spieltypName,
        boolean hatArmutAngesagt,
        boolean hatArmutUebernommen,
        /** Augen des Spielerteams in diesem Spiel (RE oder KONTRA, je nach Partei). */
        int teamAugen
    ) {}
}
