package de.locodoko.tisch;

import de.locodoko.tisch.TischEntity;
import de.locodoko.tisch.TischStatus;
import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;
import java.util.UUID;

/**
 * Kompakter Listeneintrag fuer einen Tisch in der Lobby-Uebersicht ({@code GET /api/tische}).
 *
 * <p>Liefert nur die fuer die Liste relevanten Felder: ID, Name, Spieleranzahl, Status und
 * Kurzdarstellung der Konfiguration. Fuer vollstaendige Details wird {@link TischAntwort} verwendet.</p>
 */
@Schema(description = "Kompakter Listeneintrag fuer einen Tisch in der Lobby-Uebersicht.")
public record TischListenEintragAntwort(
    @Schema(description = "Eindeutige Tisch-ID.", example = "f47ac10b-58cc-4372-a567-0e02b2c3d479")
    UUID id,
    @Schema(description = "Name des Tisches.", example = "Gemuetliche Runde")
    String name,
    @Schema(description = "Anzahl der Spieler am Tisch.", example = "3")
    int spielerAnzahl,
    @Schema(description = "Aktueller Status des Tisches.")
    TischStatus status,
    @Schema(description = "Kurzdarstellung der Tischkonfiguration.")
    TischKurzKonfigurationAntwort kurzKonfiguration,
    @Schema(description = "Anzeigenamen der aktuell belegten Spielplaetze (bis zu 4).")
    List<String> spielerNamen
) {

    public static TischListenEintragAntwort aus(TischEntity tisch) {
        return new TischListenEintragAntwort(
            tisch.id(),
            tisch.name(),
            tisch.spieler().size(),
            tisch.status(),
            TischKurzKonfigurationAntwort.aus(tisch.konfiguration()),
            tisch.spieler().stream().map(s -> s.anzeigeName()).toList()
        );
    }
}
