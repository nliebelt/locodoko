package de.locodoko.ki;

import de.locodoko.karten.Farbe;
import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartenwert;
import java.util.Comparator;
import java.util.Optional;

class KiAnspielBewerter {

    Karte waehleAnspielKarte(KiSpielzustand zustand) {
        // Hochzeit-Phase "sucht Partner": Der Hochzeit-Spieler spielt offensiv mit dem stärksten
        // Trumpf, um Klärungsstiche aktiv zu gewinnen. So behält er die Kontrolle darüber, ob er
        // einen schwachen oder starken Partner bekommt — oder das stille Solo erzwingt.
        if (zustand.hochzeitStatus() != null && zustand.hochzeitStatus().suchtPartner()
                && zustand.hochzeitStatus().hochzeitSpieler() == zustand.spielerPosition()) {
            Optional<Karte> staerksterTrumpf = zustand.gueltigeKarten().stream()
                .filter(zustand.trumpfOrdnung()::istTrumpf)
                .max(KiKartenBewertung.vergleicheGewinnKosten(zustand.trumpfOrdnung()));
            if (staerksterTrumpf.isPresent()) {
                return staerksterTrumpf.orElseThrow();
            }
        }

        long eigeneTruepfe = KiKartenBewertung.anzahlTruepfe(zustand.eigeneHand().karten(), zustand.trumpfOrdnung());
        // Ab 6 Trümpfen besitzt die KI genug Trumpfübergewicht (Mehrheit des 26-Trumpf-Stapels),
        // um gezielt mit kleinen Trümpfen zu ziehen — Gegner werden zur Abgabe guter Trümpfe gezwungen.
        if (eigeneTruepfe >= 6) {
            Optional<Karte> kleinerTrumpf = zustand.gueltigeKarten().stream()
                .filter(zustand.trumpfOrdnung()::istTrumpf)
                .min(KiKartenBewertung.vergleicheGewinnKosten(zustand.trumpfOrdnung()));
            if (kleinerTrumpf.isPresent()) {
                return kleinerTrumpf.orElseThrow();
            }
        }
        Optional<Karte> fehlAs = zustand.gueltigeKarten().stream()
            .filter(karte -> !zustand.trumpfOrdnung().istTrumpf(karte))
            .filter(karte -> karte.wert() == Kartenwert.AS)
            .max(Comparator.comparingInt(karte -> laengeDerFehlfarbe(zustand, karte.farbe())));
        if (fehlAs.isPresent()) {
            return fehlAs.orElseThrow();
        }
        return zustand.gueltigeKarten().stream()
            .min(KiKartenBewertung.vergleicheAbwurfKosten(zustand.trumpfOrdnung()))
            .orElseThrow();
    }

    private int laengeDerFehlfarbe(KiSpielzustand zustand, Farbe farbe) {
        return (int) zustand.eigeneHand().karten().stream()
            .filter(karte -> karte.farbe() == farbe)
            .filter(karte -> !zustand.trumpfOrdnung().istTrumpf(karte))
            .count();
    }
}
