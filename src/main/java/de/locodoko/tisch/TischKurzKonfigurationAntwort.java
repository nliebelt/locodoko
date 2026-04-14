package de.locodoko.tisch;

import de.locodoko.tisch.TischkonfigurationEmbeddable;

/**
 * Kurzdarstellung der Tischkonfiguration fuer den Lobby-Listeneintrag.
 *
 * <p>Zeigt nur die wichtigsten Merkmale (Deck-Variante und Spielanzahl), damit Spieler
 * in der Tischliste schnell erkennen, ob ein Tisch zu ihren Wuenschen passt.
 * Fuer alle Konfigurationsfelder wird {@link TischKonfigurationDto} verwendet.</p>
 */
public record TischKurzKonfigurationAntwort(boolean ohneNeunen, int anzahlSpiele) {

    public static TischKurzKonfigurationAntwort aus(TischkonfigurationEmbeddable konfiguration) {
        return new TischKurzKonfigurationAntwort(konfiguration.ohneNeunen(), konfiguration.anzahlSpiele());
    }
}
