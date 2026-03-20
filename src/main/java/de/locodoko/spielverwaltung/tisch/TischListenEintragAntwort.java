package de.locodoko.spielverwaltung.tisch;

import de.locodoko.spielverwaltung.persistenz.TischEntity;
import de.locodoko.spielverwaltung.persistenz.TischStatus;

import java.util.UUID;

public record TischListenEintragAntwort(
    UUID id,
    String name,
    int spielerAnzahl,
    TischStatus status,
    TischKurzKonfigurationAntwort kurzKonfiguration
) {

    public static TischListenEintragAntwort aus(TischEntity tisch) {
        return new TischListenEintragAntwort(
            tisch.id(),
            tisch.name(),
            tisch.spieler().size(),
            tisch.status(),
            TischKurzKonfigurationAntwort.aus(tisch.konfiguration())
        );
    }
}
