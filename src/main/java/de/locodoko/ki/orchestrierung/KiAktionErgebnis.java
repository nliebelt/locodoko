package de.locodoko.ki.orchestrierung;

import de.locodoko.partie.Spiel;
import de.locodoko.partie.SpielEreignis;
import org.springframework.lang.Nullable;

import java.util.List;

/**
 * Ergebnis eines einzelnen KI-Zugs.
 *
 * <p>Enthaelt den aktualisierten Spielstand nach dem Zug, ggf. die gespielte Karte (als ID)
 * sowie alle ausgeloesten Spielereignisse (Stichende, Sonderpunkte, Schweinchen, Hochzeit).
 * Der Orchestrierungsservice im Tisch-Kontext wertet diese Felder aus, persistiert und broadcastet.</p>
 */
public record KiAktionErgebnis(
        Spiel naechsterStand,
        @Nullable String gespielteKarteId,
        List<SpielEreignis> ereignisse) {}
