package de.locodoko.tisch;

import de.locodoko.tisch.TischEntity;
import de.locodoko.tisch.TischStatus;

import java.util.UUID;

/**
 * Kompakter Listeneintrag fuer einen Tisch in der Lobby-Uebersicht ({@code GET /api/tische}).
 *
 * <p>Liefert nur die fuer die Liste relevanten Felder: ID, Name, Spieleranzahl, Status und
 * Kurzdarstellung der Konfiguration. Fuer vollstaendige Details wird {@link TischAntwort} verwendet.</p>
 */
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
