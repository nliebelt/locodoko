package de.locodoko.lobby;

import de.locodoko.lobby.TischkonfigurationEmbeddable;

public record TischKurzKonfigurationAntwort(boolean ohneNeunen, int anzahlSpiele) {

    public static TischKurzKonfigurationAntwort aus(TischkonfigurationEmbeddable konfiguration) {
        return new TischKurzKonfigurationAntwort(konfiguration.ohneNeunen(), konfiguration.anzahlSpiele());
    }
}
