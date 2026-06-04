package de.locodoko.spieler;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * REST-Antwort fuer {@code GET /api/spieler/{id}/profil}.
 * Oeffentlich sichtbares Spieler-Profil mit Statistiken pro Regelvariante und letzten Partien.
 */
@Schema(description = "Oeffentlich sichtbares Spieler-Profil mit Statistiken pro Regelvariante und letzten Partien.")
public record SpielerProfilAntwort(
    @Schema(description = "Eindeutige Spieler-ID.", example = "a1b2c3d4-e5f6-7890-abcd-ef1234567890")
    UUID spielerId,
    @Schema(description = "Oeffentlicher Anzeigename.", example = "Karlchen")
    String anzeigeName,
    @Schema(description = "Avatar-Farbe als Hex-String.", example = "#FF5733")
    String avatarFarbe,
    @Schema(description = "Zeitpunkt der Profilerstellung.", example = "2026-01-15T10:00:00Z")
    Instant erstelltAm,
    @Schema(description = "Spielstatistiken des Spielers, gruppiert nach Regelvariante (TURNIER, SONDER, FREI).")
    Map<String, StatistikAntwort> statistiken,
    @Schema(description = "Liste der letzten Partien des Spielers.")
    List<PartieErgebnisAntwort> letztePartien
) {

    @Schema(description = "Aggregierte Spielstatistiken eines Spielers fuer eine Regelvariante.")
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
        @Schema(description = "Anzahl Siege als Re-Partei.", example = "14")
        int reSiege,
        @Schema(description = "Anzahl Niederlagen als Re-Partei.", example = "8")
        int reNiederlagen,
        @Schema(description = "Anzahl Siege als Kontra-Partei.", example = "11")
        int kontraSiege,
        @Schema(description = "Anzahl Niederlagen als Kontra-Partei.", example = "9")
        int kontraNiederlagen,
        @Schema(description = "Anzahl gespielter Hochzeiten.", example = "3")
        int hochzeitenGespielt,
        @Schema(description = "Anzahl angesagter Armuten.", example = "2")
        int armutenAngesagt,
        @Schema(description = "Anzahl uebernommener Armuten.", example = "1")
        int armutenUebernommen,
        @Schema(description = "Anzahl gewonnener Solos.", example = "4")
        int solosSiege,
        @Schema(description = "Anzahl verlorener Solos.", example = "2")
        int solosNiederlagen,
        @Schema(description = "JSONB-Karte Soloergebnisse pro Solo-Typ.", example = "{\"SOLO_DAME\":{\"siege\":2,\"niederlagen\":1}}")
        String solosProTypJson,
        @Schema(description = "Durchschnittliche Punkte pro Spiel (gerundet auf 2 Dezimalstellen).", example = "2.86")
        double durchschnittlichePunkteProSpiel,
        @Schema(description = "Siegquote in Prozent (0–100).", example = "59.52")
        double siegquote,
        @Schema(description = "Durchschnittliche Team-Augen pro Spiel.", example = "126.5")
        double durchschnittlicheAugenProSpiel,
        @Schema(description = "TrueSkill-Skill-Mean (mu).", example = "27.43")
        double ratingMu,
        @Schema(description = "TrueSkill-Skill-Sigma (Unsicherheit).", example = "7.85")
        double ratingSigma,
        @Schema(description = "Konservatives TrueSkill-Rating fuer Bestenliste: mu - 3*sigma.", example = "4.08")
        double konservativesRating
    ) {
        static StatistikAntwort aus(SpielerStatistik s) {
            double durchschnittlichePunkte = s.anzahlSpiele() > 0
                ? Math.round((double) s.gesamtPunkte() / s.anzahlSpiele() * 100.0) / 100.0
                : 0.0;
            double siegquote = s.anzahlSpiele() > 0
                ? Math.round((double) s.anzahlSiege() / s.anzahlSpiele() * 10000.0) / 100.0
                : 0.0;
            double durchschnittlicheAugen = s.anzahlSpiele() > 0
                ? Math.round(s.durchschnittlicheAugenProSpiel() * 100.0) / 100.0
                : 0.0;
            return new StatistikAntwort(
                s.anzahlSpiele(), s.anzahlSiege(), s.gesamtPunkte(),
                s.fuchsGefangen(), s.fuchsVerloren(), s.karlchenGespielt(),
                s.doppelkoepfe(), s.reSiege(), s.reNiederlagen(),
                s.kontraSiege(), s.kontraNiederlagen(), s.hochzeitenGespielt(),
                s.armutenAngesagt(), s.armutenUebernommen(),
                s.solosSiege(), s.solosNiederlagen(), s.solosProTypJson(),
                durchschnittlichePunkte, siegquote, durchschnittlicheAugen,
                Math.round(s.ratingMu() * 100.0) / 100.0,
                Math.round(s.ratingSigma() * 100.0) / 100.0,
                Math.round(s.konservativesRating() * 100.0) / 100.0
            );
        }
    }

    @Schema(description = "Zusammenfassung einer abgeschlossenen Partie.")
    public record PartieErgebnisAntwort(
        @Schema(description = "ID der Partie.", example = "a1b2c3d4-e5f6-7890-abcd-ef1234567890")
        UUID partieId,
        @Schema(description = "Name des Tisches.", example = "Gemuetliche Runde")
        String tischName,
        @Schema(description = "Zeitpunkt der Partie.", example = "2026-04-15T14:30:00Z")
        Instant datum,
        @Schema(description = "Regelvariante der Partie.", example = "TURNIER")
        String regelvariante,
        @Schema(description = "Endpunktestand des Spielers.", example = "24")
        int endPunktestand,
        @Schema(description = "Rangplatz des Spielers in der Partie.", example = "1")
        int rangplatz,
        @Schema(description = "Anzahl der Spiele in der Partie.", example = "12")
        int spielanzahl
    ) {
        static PartieErgebnisAntwort aus(PartieErgebnisEintrag e) {
            return new PartieErgebnisAntwort(
                e.partieId(), e.tischName(), e.datum(), e.regelvariante(),
                e.endPunktestand(), e.rangplatz(), e.spielanzahl()
            );
        }
    }

    public static SpielerProfilAntwort aus(SpielerEntity spieler, List<SpielerStatistik> statistiken,
                                            List<PartieErgebnisEintrag> partieErgebnisse) {
        Map<String, StatistikAntwort> statistikMap = statistiken.stream()
            .collect(Collectors.toMap(SpielerStatistik::regelvariante, StatistikAntwort::aus));
        return new SpielerProfilAntwort(
            spieler.id(),
            spieler.anzeigeName(),
            spieler.avatarFarbe(),
            spieler.erstelltAm(),
            statistikMap,
            partieErgebnisse.stream().map(PartieErgebnisAntwort::aus).toList()
        );
    }
}
