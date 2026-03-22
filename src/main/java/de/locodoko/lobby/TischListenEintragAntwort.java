package de.locodoko.lobby;

import de.locodoko.lobby.TischEntity;
import de.locodoko.lobby.TischStatus;

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
