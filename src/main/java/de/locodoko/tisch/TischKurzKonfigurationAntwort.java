package de.locodoko.tisch;

import de.locodoko.tisch.TischkonfigurationEmbeddable;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Kurzdarstellung der Tischkonfiguration fuer den Lobby-Listeneintrag.
 *
 * <p>Zeigt nur die wichtigsten Merkmale (Deck-Variante und Spielanzahl), damit Spieler
 * in der Tischliste schnell erkennen, ob ein Tisch zu ihren Wuenschen passt.
 * Fuer alle Konfigurationsfelder wird {@link TischKonfigurationDto} verwendet.</p>
 */
@Schema(description = "Kurzdarstellung der Tischkonfiguration fuer die Lobby-Liste.")
public record TischKurzKonfigurationAntwort(
    @Schema(description = "Ohne Neunen spielen (10er-Deck).")
    boolean ohneNeunen,
    @Schema(description = "Anzahl der Spiele pro Partie.", example = "12")
    int anzahlSpiele
) {

    public static TischKurzKonfigurationAntwort aus(TischkonfigurationEmbeddable konfiguration) {
        return new TischKurzKonfigurationAntwort(konfiguration.ohneNeunen(), konfiguration.anzahlSpiele());
    }
}
