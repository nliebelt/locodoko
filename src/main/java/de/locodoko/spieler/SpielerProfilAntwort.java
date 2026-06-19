package de.locodoko.spieler;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * REST-Antwort fuer {@code GET /api/spieler/{id}/profil}.
 * Oeffentlich sichtbares Spieler-Profil mit aggregierten Statistiken ueber alle Regelvarianten und letzten Partien.
 */
@Schema(description = "Oeffentlich sichtbares Spieler-Profil mit aggregierten Statistiken und letzten Partien.")
public record SpielerProfilAntwort(
    @Schema(description = "Eindeutige Spieler-ID.", example = "a1b2c3d4-e5f6-7890-abcd-ef1234567890")
    UUID spielerId,
    @Schema(description = "Oeffentlicher Anzeigename.", example = "Karlchen")
    String anzeigeName,
    @Schema(description = "Avatar-Farbe als Hex-String.", example = "#FF5733")
    String avatarFarbe,
    @Schema(description = "Zeitpunkt der Profilerstellung.", example = "2026-01-15T10:00:00Z")
    Instant erstelltAm,
    @Schema(description = "Aggregierte Spielstatistiken ueber alle Regelvarianten. Null wenn noch keine Spiele gespielt.")
    StatistikAntwort statistik,
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
        return new SpielerProfilAntwort(
            spieler.id(),
            spieler.anzeigeName(),
            spieler.avatarFarbe(),
            spieler.erstelltAm(),
            aggregiereStatistiken(statistiken),
            partieErgebnisse.stream().map(PartieErgebnisAntwort::aus).toList()
        );
    }

    private static StatistikAntwort aggregiereStatistiken(List<SpielerStatistik> statistiken) {
        if (statistiken.isEmpty()) return null;
        int anzahlSpiele = 0, anzahlSiege = 0, gesamtPunkte = 0, fuchsGefangen = 0, fuchsVerloren = 0,
            karlchenGespielt = 0, doppelkoepfe = 0, reSiege = 0, reNiederlagen = 0,
            kontraSiege = 0, kontraNiederlagen = 0, hochzeitenGespielt = 0,
            armutenAngesagt = 0, armutenUebernommen = 0, solosSiege = 0, solosNiederlagen = 0,
            gesamtAugen = 0;
        double sumMu = 0, sumSigma = 0;
        Map<String, Map<String, Integer>> solosGesamt = new java.util.HashMap<>();

        for (SpielerStatistik s : statistiken) {
            anzahlSpiele += s.anzahlSpiele();
            anzahlSiege += s.anzahlSiege();
            gesamtPunkte += s.gesamtPunkte();
            fuchsGefangen += s.fuchsGefangen();
            fuchsVerloren += s.fuchsVerloren();
            karlchenGespielt += s.karlchenGespielt();
            doppelkoepfe += s.doppelkoepfe();
            reSiege += s.reSiege();
            reNiederlagen += s.reNiederlagen();
            kontraSiege += s.kontraSiege();
            kontraNiederlagen += s.kontraNiederlagen();
            hochzeitenGespielt += s.hochzeitenGespielt();
            armutenAngesagt += s.armutenAngesagt();
            armutenUebernommen += s.armutenUebernommen();
            solosSiege += s.solosSiege();
            solosNiederlagen += s.solosNiederlagen();
            gesamtAugen += s.gesamtAugen();
            sumMu += s.ratingMu();
            sumSigma += s.ratingSigma();
            fuegesolosZusammen(solosGesamt, s.solosProTypJson());
        }

        int n = statistiken.size();
        double avgMu = sumMu / n;
        double avgSigma = sumSigma / n;
        String solosJson = schreibeSolosJson(solosGesamt);

        // Berechne abgeleitete Werte wie in StatistikAntwort.aus()
        double durchschnittlichePunkte = anzahlSpiele > 0
            ? Math.round((double) gesamtPunkte / anzahlSpiele * 100.0) / 100.0 : 0.0;
        double siegquote = anzahlSpiele > 0
            ? Math.round((double) anzahlSiege / anzahlSpiele * 10000.0) / 100.0 : 0.0;
        double durchschnittlicheAugen = anzahlSpiele > 0
            ? Math.round((double) gesamtAugen / anzahlSpiele * 100.0) / 100.0 : 0.0;

        return new StatistikAntwort(
            anzahlSpiele, anzahlSiege, gesamtPunkte,
            fuchsGefangen, fuchsVerloren, karlchenGespielt,
            doppelkoepfe, reSiege, reNiederlagen,
            kontraSiege, kontraNiederlagen, hochzeitenGespielt,
            armutenAngesagt, armutenUebernommen,
            solosSiege, solosNiederlagen, solosJson,
            durchschnittlichePunkte, siegquote, durchschnittlicheAugen,
            Math.round(avgMu * 100.0) / 100.0,
            Math.round(avgSigma * 100.0) / 100.0,
            Math.round((avgMu - 3 * avgSigma) * 100.0) / 100.0
        );
    }

    @SuppressWarnings("unchecked")
    private static void fuegesolosZusammen(Map<String, Map<String, Integer>> gesamt, String solosJson) {
        if (solosJson == null || solosJson.isBlank() || "{}".equals(solosJson)) return;
        try {
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            Map<String, Map<String, Integer>> einzel = mapper.readValue(solosJson,
                mapper.getTypeFactory().constructMapType(Map.class,
                    mapper.getTypeFactory().constructType(String.class),
                    mapper.getTypeFactory().constructMapType(Map.class, String.class, Integer.class)));
            einzel.forEach((soloTyp, werte) -> {
                Map<String, Integer> ziel = gesamt.computeIfAbsent(soloTyp, k -> new java.util.HashMap<>());
                werte.forEach((schluessel, wert) ->
                    ziel.merge(schluessel, wert, Integer::sum));
            });
        } catch (Exception ignored) {
            // fehlerhafte JSONB-Eintraege ueberspringen
        }
    }

    private static String schreibeSolosJson(Map<String, Map<String, Integer>> solosGesamt) {
        if (solosGesamt.isEmpty()) return "{}";
        try {
            return new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(solosGesamt);
        } catch (Exception ignored) {
            return "{}";
        }
    }
}
