package de.locodoko.spielverwaltung.tisch;

import de.locodoko.spielverwaltung.persistenz.TischkonfigurationEmbeddable;

public record TischKurzKonfigurationAntwort(boolean ohneNeunen, int anzahlSpiele) {

    public static TischKurzKonfigurationAntwort aus(TischkonfigurationEmbeddable konfiguration) {
        return new TischKurzKonfigurationAntwort(konfiguration.ohneNeunen(), konfiguration.anzahlSpiele());
    }
}
