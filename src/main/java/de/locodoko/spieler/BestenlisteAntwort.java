package de.locodoko.spieler;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * REST-Antwort fuer {@code GET /api/spieler/leaderboard}.
 * Ewige Bestenliste aggregiert ueber alle Regelvarianten, sortiert nach konservativem TrueSkill-Rating (mu - 3*sigma).
 */
@Schema(description = "Ewige Bestenliste aggregiert ueber alle Regelvarianten, sortiert nach konservativem TrueSkill-Rating.")
public record BestenlisteAntwort(
    @Schema(description = "Eintraege der Bestenliste, aufsteigend nach Rang sortiert.")
    List<BestenlisteEintragAntwort> eintraege
) {

    @Schema(description = "Einzelner Eintrag in der Bestenliste.")
    public record BestenlisteEintragAntwort(
        @Schema(description = "Rangplatz (1 = bester).", example = "1")
        int rang,
        @Schema(description = "Spieler-ID.", example = "a1b2c3d4-e5f6-7890-abcd-ef1234567890")
        UUID spielerId,
        @Schema(description = "Anzeigename des Spielers.", example = "Karlchen")
        String spielerName,
        @Schema(description = "Avatar-Farbe als Hex-String.", example = "#FF5733")
        String avatarFarbe,
        @Schema(description = "Konservatives TrueSkill-Rating fuer Bestenliste: mu - 3*sigma.", example = "12.34")
        double konservativesRating,
        @Schema(description = "TrueSkill-Skill-Mean (mu).", example = "27.43")
        double ratingMu,
        @Schema(description = "TrueSkill-Skill-Sigma (Unsicherheit).", example = "5.03")
        double ratingSigma,
        @Schema(description = "Anzahl gespielter Spiele.", example = "42")
        int anzahlSpiele,
        @Schema(description = "Siegquote in Prozent (0-100).", example = "59.52")
        double siegquote
    ) {}

    public static BestenlisteAntwort aus(List<BestenlisteStatistikAggregat> statistiken,
                                          Map<UUID, SpielerEntity> spielerMap) {
        List<BestenlisteEintragAntwort> eintraege = new java.util.ArrayList<>();
        for (int i = 0; i < statistiken.size(); i++) {
            BestenlisteStatistikAggregat stat = statistiken.get(i);
            SpielerEntity spieler = spielerMap.get(stat.spielerId());
            if (spieler == null) continue;
            double siegquote = stat.anzahlSpiele() > 0
                ? Math.round((double) stat.anzahlSiege() / stat.anzahlSpiele() * 10000.0) / 100.0
                : 0.0;
            eintraege.add(new BestenlisteEintragAntwort(
                i + 1,
                stat.spielerId(),
                spieler.anzeigeName(),
                spieler.avatarFarbe(),
                Math.round(stat.konservativesRating() * 100.0) / 100.0,
                Math.round(stat.ratingMu() * 100.0) / 100.0,
                Math.round(stat.ratingSigma() * 100.0) / 100.0,
                stat.anzahlSpiele(),
                siegquote
            ));
        }
        return new BestenlisteAntwort(eintraege);
    }
}
