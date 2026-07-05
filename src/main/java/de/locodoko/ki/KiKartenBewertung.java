package de.locodoko.ki;

import de.locodoko.karten.Farbe;
import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartenwert;
import de.locodoko.karten.TrumpfOrdnung;
import java.util.Comparator;
import java.util.List;

class KiKartenBewertung {
    private KiKartenBewertung() {}

    static long anzahlTruepfe(List<Karte> karten, TrumpfOrdnung trumpfOrdnung) {
        return karten.stream().filter(trumpfOrdnung::istTrumpf).count();
    }

    static Comparator<Karte> vergleicheGewinnKosten(TrumpfOrdnung trumpfOrdnung) {
        return Comparator.<Karte>comparingInt(karte -> gewinnKosten(karte, trumpfOrdnung))
            .thenComparing(Karte::augen)
            .thenComparingInt(Karte::exemplarIndex);
    }

    /**
     * Stärke einer Karte zum Gewinnen eines Stichs (niedrigerer Wert = billiger zu gewinnen).
     * Wird als Sortierschlüssel genutzt, um die schwächste gewinnende Karte zu finden (Prinzip:
     * "mit möglichst wenig Trumpf gewinnen").
     */
    static int gewinnKosten(Karte karte, TrumpfOrdnung trumpfOrdnung) {
        if (trumpfOrdnung.istTrumpf(karte)) {
            return trumpfOrdnung.trumpfRang(karte);
        }
        return trumpfOrdnung.fehlRang(karte);
    }

    static Comparator<Karte> vergleicheAbwurfKosten(TrumpfOrdnung trumpfOrdnung) {
        return Comparator.<Karte>comparingInt(karte -> abwurfKosten(karte, trumpfOrdnung))
            .thenComparingInt(Karte::augen)
            .thenComparingInt(Karte::exemplarIndex);
    }

    /**
     * Kosten des Abwerfens einer Karte (höherer Wert = ungünstiger abzuwerfen).
     * Wird als Sortierschlüssel genutzt, um die am wenigsten wertvolle Karte zum Abwerfen zu finden.
     *
     * <p>Aufbau:
     * <ul>
     *   <li>{@code karte.augen()}: Augenverlust ist direkt spielwertrelevant.</li>
     *   <li>Trümpfe: +30 Basis-Offset sichert, dass jeder Trumpf teurer ist als jede Fehlkarte
     *       (Fehlrang maximal ~13), dazu +trumpfRang für interne Trumpfdifferenzierung.</li>
     *   <li>Fuchs (Karo-As) +40: Gegner erhält Sonderpunkt beim Fangen; Mehrkosten modellieren
     *       diesen zusätzlichen Verlust.</li>
     *   <li>Karlchen (Kreuz-Bube) +20: Sonderpunkt nur im letzten Stich; geringere Risikogewichtung
     *       als Fuchs, weil das Risiko erst im letzten Stich relevant wird.</li>
     * </ul>
     */
    static int abwurfKosten(Karte karte, TrumpfOrdnung trumpfOrdnung) {
        int kosten = karte.augen();
        if (trumpfOrdnung.istTrumpf(karte)) {
            // 30 = Mindestabstand zwischen dem teuersten Fehl-Rang und dem billigsten Trumpf-Rang,
            // damit Trümpfe in der Abwurf-Sortierung immer nach Fehlkarten kommen.
            kosten += 30 + trumpfOrdnung.trumpfRang(karte);
        } else {
            kosten += trumpfOrdnung.fehlRang(karte);
        }
        if (istFuchs(karte)) {
            kosten += 40;
        }
        if (istKarlchen(karte)) {
            kosten += 20;
        }
        return kosten;
    }

    static boolean istFuchs(Karte karte) {
        return karte.farbe() == Farbe.KARO && karte.wert() == Kartenwert.AS;
    }

    static boolean istKarlchen(Karte karte) {
        return karte.farbe() == Farbe.KREUZ && karte.wert() == Kartenwert.BUBE;
    }
}
