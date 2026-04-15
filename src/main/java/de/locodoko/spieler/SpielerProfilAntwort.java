package de.locodoko.spieler;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * REST-Antwort fuer {@code GET /api/spieler/{id}/profil}.
 * Oeffentlich sichtbares Spieler-Profil mit Statistiken und letzten Partien.
 */
public record SpielerProfilAntwort(
    UUID spielerId,
    String anzeigeName,
    String avatarFarbe,
    Instant erstelltAm,
    StatistikAntwort statistik,
    List<PartieErgebnisAntwort> letztePartien
) {

    public record StatistikAntwort(
        int anzahlSpiele,
        int anzahlSiege,
        int gesamtPunkte,
        int fuchsGefangen,
        int fuchsVerloren,
        int karlchenGespielt,
        int doppelkoepfe,
        int solosSiege,
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

    public record PartieErgebnisAntwort(
        String tischName,
        Instant datum,
        int endPunktestand,
        int rangplatz,
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
