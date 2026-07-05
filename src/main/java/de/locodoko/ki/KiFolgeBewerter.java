package de.locodoko.ki;

import de.locodoko.karten.Karte;
import de.locodoko.partie.Partei;
import de.locodoko.partie.SpielerPosition;
import de.locodoko.partie.Stich;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

class KiFolgeBewerter {

    Karte waehleFolgeKarte(KiSpielzustand zustand) {
        Stich aktuellerStich = zustand.aktuellerStich();
        Partei eigenePartei = zustand.eigenePartei().orElse(null);
        SpielerPosition aktuellerGewinner = aktuellerStich.gewinner(zustand.trumpfOrdnung()).spieler();
        Optional<Partei> sichtbareGewinnerPartei = zustand.sichtbareParteiVon(aktuellerGewinner);
        List<Karte> gewinnendeKarten = gewinnendeKarten(zustand);

        boolean partnerGewinnt = (eigenePartei != null && sichtbareGewinnerPartei.filter(eigenePartei::equals).isPresent())
            || istHochzeitPartnerGewinner(zustand, aktuellerGewinner);
        if (partnerGewinnt && aktuellerGewinner != zustand.spielerPosition()) {
            Optional<Karte> schmierkarte = zustand.gueltigeKarten().stream()
                .filter(karte -> !gewinnendeKarten.contains(karte))
                .max(Comparator
                    .comparingInt(Karte::augen)
                    .thenComparing(karte -> KiKartenBewertung.istFuchs(karte) ? 1 : 0)
                    .thenComparing(karte -> KiKartenBewertung.istKarlchen(karte) ? 1 : 0));
            if (schmierkarte.isPresent()) {
                return schmierkarte.orElseThrow();
            }
        }

        if (!gewinnendeKarten.isEmpty()) {
            // Hochzeit-Phase "sucht Partner": Als Hochzeit-Spieler gewinne ich Stiche mit der
            // stärksten Karte, damit ich die Klärung sicher kontrolliere und nicht durch
            // eine knapp schlechtere Karte übertrumpft werde.
            if (zustand.hochzeitStatus() != null && zustand.hochzeitStatus().suchtPartner()
                    && zustand.hochzeitStatus().hochzeitSpieler() == zustand.spielerPosition()) {
                return gewinnendeKarten.stream()
                    .max(KiKartenBewertung.vergleicheGewinnKosten(zustand.trumpfOrdnung()))
                    .orElseThrow();
            }
            // Hochzeit-Phase "sucht Partner": Als Nicht-Hochzeit-Spieler versuche ich, den
            // aktuellen Stich zu gewinnen, wenn der Hochzeit-Spieler ihn gerade führt — so werde
            // ich der Re-Partner, bevor jemand anderes diese Chance bekommt.
            if (zustand.hochzeitStatus() != null && zustand.hochzeitStatus().suchtPartner()
                    && zustand.hochzeitStatus().hochzeitSpieler() != zustand.spielerPosition()
                    && aktuellerGewinner == zustand.hochzeitStatus().hochzeitSpieler()) {
                return gewinnendeKarten.stream()
                    .min(KiKartenBewertung.vergleicheGewinnKosten(zustand.trumpfOrdnung()))
                    .orElseThrow();
            }
            return gewinnendeKarten.stream()
                .min(KiKartenBewertung.vergleicheGewinnKosten(zustand.trumpfOrdnung()))
                .orElseThrow();
        }

        return zustand.gueltigeKarten().stream()
            .min(KiKartenBewertung.vergleicheAbwurfKosten(zustand.trumpfOrdnung()))
            .orElseThrow();
    }

    /**
     * Prueft ob der aktuelle Stichgewinner der bekannte Hochzeit-Partner ist.
     * Greift wenn {@code hochzeitStatus.partner()} gesetzt ist, aber die Partei noch nicht
     * oeffentlich sichtbar — Parteien.ausHochzeit() traegt nur den Hochzeit-Spieler in
     * offenFuerAlle ein, nicht den Partner.
     */
    private boolean istHochzeitPartnerGewinner(KiSpielzustand zustand, SpielerPosition aktuellerGewinner) {
        if (zustand.hochzeitStatus() == null || zustand.hochzeitStatus().suchtPartner()) {
            return false;
        }
        if (zustand.spielerPosition() == zustand.hochzeitStatus().hochzeitSpieler()) {
            // Ich bin der Hochzeit-Spieler — schmiere wenn mein bestaetigter Partner gewinnt
            return zustand.hochzeitStatus().partner()
                .filter(p -> p == aktuellerGewinner).isPresent();
        }
        // Ich bin der Partner — schmiere wenn der Hochzeit-Spieler gewinnt
        return zustand.hochzeitStatus().partner()
            .filter(p -> p == zustand.spielerPosition()).isPresent()
            && aktuellerGewinner == zustand.hochzeitStatus().hochzeitSpieler();
    }

    private List<Karte> gewinnendeKarten(KiSpielzustand zustand) {
        List<Karte> gewinnendeKarten = new ArrayList<>();
        for (Karte karte : zustand.gueltigeKarten()) {
            Stich hypothetischerStich = zustand.aktuellerStich()
                .spieleKarte(zustand.spielerPosition(), karte, zustand.eigeneHand(), zustand.trumpfOrdnung());
            if (hypothetischerStich.gewinner(zustand.trumpfOrdnung()).spieler() == zustand.spielerPosition()) {
                gewinnendeKarten.add(karte);
            }
        }
        return List.copyOf(gewinnendeKarten);
    }
}
