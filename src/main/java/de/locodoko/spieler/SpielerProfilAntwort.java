package de.locodoko.spieler;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * REST-Antwort fuer {@code GET /api/spieler/{id}/profil}.
 * Oeffentlich sichtbares Spieler-Profil mit Statistiken und letzten Partien.
 */
@Schema(description = "Oeffentlich sichtbares Spieler-Profil mit Statistiken und letzten Partien.")
public record SpielerProfilAntwort(
    @Schema(description = "Eindeutige Spieler-ID.", example = "a1b2c3d4-e5f6-7890-abcd-ef1234567890")
    UUID spielerId,
    @Schema(description = "Oeffentlicher Anzeigename.", example = "Karlchen")
    String anzeigeName,
    @Schema(description = "Avatar-Farbe als Hex-String.", example = "#FF5733")
    String avatarFarbe,
    @Schema(description = "Zeitpunkt der Profilerstellung.", example = "2026-01-15T10:00:00Z")
    Instant erstelltAm,
    @Schema(description = "Spielstatistiken des Spielers.")
    StatistikAntwort statistik,
    @Schema(description = "Liste der letzten Partien des Spielers.")
    List<PartieErgebnisAntwort> letztePartien
) {

    @Schema(description = "Aggregierte Spielstatistiken eines Spielers.")
    public record StatistikAntwort(
        @Schema(description = "Gesamtanzahl gespielter Spiele.", example = "42")
        int anzahlSpiele,
        @Schema(description = "Anzahl gewonnener Spiele.", example = "25")
        int anzahlSiege,
        @Schema(description = "Gesamtpunkte ueber alle Partien.", example = "120")
        int gesamtPunkte,
        @Schema(description = "Anzahl gefangener Fuechse.", example = "5")
        int fuchsGefangen,
        @Schema(description = "Anzahl verlorener Fuechse.", example = "3")
        int fuchsVerloren,
        @Schema(description = "Anzahl gespielter Karlchen.", example = "2")
        int karlchenGespielt,
        @Schema(description = "Anzahl erzielter Doppelkoepfe.", example = "1")
        int doppelkoepfe,
        @Schema(description = "Anzahl gewonnener Solos.", example = "4")
        int solosSiege,
        @Schema(description = "Anzahl verlorener Solos.", example = "2")
        int solosNiederlagen
    ) {
        static StatistikAntwort aus(SpielerStatistik s) {
            return new StatistikAntwort(
                s.anzahlSpiele(), s.anzahlSiege(), s.gesamtPunkte(),
                s.fuchsGefangen(), s.fuchsVerloren(), s.karlchenGespielt(),
                s.doppelkoepfe(), s.solosSiege(), s.solosNiederlagen()
            );
        }
    }

    @Schema(description = "Zusammenfassung einer abgeschlossenen Partie.")
    public record PartieErgebnisAntwort(
        @Schema(description = "Name des Tisches.", example = "Gemuetliche Runde")
        String tischName,
        @Schema(description = "Zeitpunkt der Partie.", example = "2026-04-15T14:30:00Z")
        Instant datum,
        @Schema(description = "Endpunktestand des Spielers.", example = "24")
        int endPunktestand,
        @Schema(description = "Rangplatz des Spielers in der Partie.", example = "1")
        int rangplatz,
        @Schema(description = "Anzahl der Spiele in der Partie.", example = "12")
        int spielanzahl
    ) {
        static PartieErgebnisAntwort aus(PartieErgebnisEintrag e) {
            return new PartieErgebnisAntwort(
                e.tischName(), e.datum(), e.endPunktestand(), e.rangplatz(), e.spielanzahl()
            );
        }
    }

    public static SpielerProfilAntwort aus(SpielerEntity spieler, SpielerStatistik statistik,
                                            List<PartieErgebnisEintrag> partieErgebnisse) {
        return new SpielerProfilAntwort(
            spieler.id(),
            spieler.anzeigeName(),
            spieler.avatarFarbe(),
            spieler.erstelltAm(),
            StatistikAntwort.aus(statistik),
            partieErgebnisse.stream().map(PartieErgebnisAntwort::aus).toList()
        );
    }
}
