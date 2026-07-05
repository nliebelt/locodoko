package de.locodoko.ki;

import de.locodoko.karten.Farbe;
import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartenwert;
import de.locodoko.partie.VorbehaltAnsage;

class KiVorbehaltBewerter {

    /**
     * Berechnet einen Stärkescore für einen bestimmten Solo-Typ.
     *
     * <p>Gewichtungslogik pro Solo-Typ:
     * <ul>
     *   <li><b>SOLO_TRUMPF:</b> Trümpfe × 4 (wichtigste Ressource — mehr Trumpf = sicherer Sieg),
     *       Asse/Damen/Buben × 2 (jede dieser Karten ist entweder Trumpf oder Fehl-Ass;
     *       geringeres Gewicht weil sie bereits in trumpfAnzahl enthalten sind oder als
     *       Fehlfarben-Gewinner wirken). Schwelle: 46.</li>
     *   <li><b>SOLO_TRUMPF_HERZ/PIK/KREUZ:</b> Farbsolo-Trümpfe × 4 (Dame + Bube + Farbkarten
     *       der gewählten Farbe), Fehl-Asse × 2 (Asse der Nicht-Trumpf-Farben), Damen/Buben × 2
     *       (Bonus für starke Oberkarten die bereits in Trumpfanzahl enthalten sind).
     *       Schwelle: 46.</li>
     *   <li><b>SOLO_DAME:</b> Damen × 8 (einzige Trümpfe — alle 4 Damen = klare Mehrheit),
     *       Asse × 2 (sichern Fehlstiche), hoheFehlkarten × 1 (Zehn gewinnt nach Ass-Zug).
     *       Schwelle: 28 (≈ 3 Damen + 2 Asse).</li>
     *   <li><b>SOLO_BUBE:</b> analog Dame-Solo; Buben ersetzen Damen als einzige Trümpfe.
     *       Schwelle: 28.</li>
     *   <li><b>SOLO_FLEISCHLOS:</b> Asse × 6 (Hauptstichquelle ohne Trumpf), hoheFehlkarten × 2
     *       (Zehnen gewinnen nach Ass-Kontrolle), trumpfAnzahl × -1 (Trümpfe sind in diesem
     *       Spieltyp nutzlos und verengen die handlungsfähige Fehlfarbenstruktur).
     *       Schwelle: 30 (≈ 4 Asse + 2 hohe Fehlkarten).</li>
     * </ul>
     */
    int soloWert(VorbehaltAnsage vorbehaltAnsage, KiSpielzustand zustand) {
        int trumpfAnzahl = (int) KiKartenBewertung.anzahlTruepfe(zustand.eigeneHand().karten(), zustand.trumpfOrdnung());
        int asse = (int) zustand.eigeneHand().karten().stream().filter(karte -> karte.wert() == Kartenwert.AS).count();
        int damen = (int) zustand.eigeneHand().karten().stream().filter(karte -> karte.wert() == Kartenwert.DAME).count();
        int buben = (int) zustand.eigeneHand().karten().stream().filter(karte -> karte.wert() == Kartenwert.BUBE).count();
        int hoheFehlkarten = (int) zustand.eigeneHand().karten().stream()
            .filter(karte -> !zustand.trumpfOrdnung().istTrumpf(karte))
            .filter(karte -> karte.wert() == Kartenwert.AS || karte.wert() == Kartenwert.ZEHN)
            .count();
        return switch (vorbehaltAnsage) {
            case SOLO_TRUMPF -> trumpfAnzahl * 4 + asse * 2 + damen * 2 + buben * 2;
            case SOLO_TRUMPF_HERZ -> farbsoloTrumpfAnzahl(Farbe.HERZ, zustand) * 4
                + farbsoloFehlAsse(Farbe.HERZ, zustand) * 2 + damen * 2 + buben * 2;
            case SOLO_TRUMPF_PIK -> farbsoloTrumpfAnzahl(Farbe.PIK, zustand) * 4
                + farbsoloFehlAsse(Farbe.PIK, zustand) * 2 + damen * 2 + buben * 2;
            case SOLO_TRUMPF_KREUZ -> farbsoloTrumpfAnzahl(Farbe.KREUZ, zustand) * 4
                + farbsoloFehlAsse(Farbe.KREUZ, zustand) * 2 + damen * 2 + buben * 2;
            case SOLO_DAME -> damen * 8 + asse * 2 + hoheFehlkarten;
            case SOLO_BUBE -> buben * 8 + asse * 2 + hoheFehlkarten;
            case SOLO_FLEISCHLOS -> asse * 6 + hoheFehlkarten * 2 - trumpfAnzahl;
            default -> Integer.MIN_VALUE;
        };
    }

    private int farbsoloTrumpfAnzahl(Farbe trumpfFarbe, KiSpielzustand zustand) {
        return (int) zustand.eigeneHand().karten().stream()
            .filter(karte -> karte.wert() == Kartenwert.DAME
                || karte.wert() == Kartenwert.BUBE
                || karte.farbe() == trumpfFarbe)
            .count();
    }

    private int farbsoloFehlAsse(Farbe trumpfFarbe, KiSpielzustand zustand) {
        return (int) zustand.eigeneHand().karten().stream()
            .filter(karte -> karte.wert() == Kartenwert.AS && karte.farbe() != trumpfFarbe)
            .count();
    }

    /**
     * Mindestscore aus {@link #soloWert}, ab dem ein Solo angemeldet wird.
     *
     * <p>Kalibrierungsgrundlage:
     * <ul>
     *   <li>SOLO_TRUMPF 46: entspricht ~9 Trümpfen mit guten Begleitkarten.</li>
     *   <li>SOLO_TRUMPF_HERZ/PIK/KREUZ 46: Farbsolo hat dieselbe Trumpfanzahl wie Trumpfsolo
     *       (24 Trumpfkarten im Deck: 8 Damen + 8 Buben + 8 Farbkarten) — gleiche Schwelle.</li>
     *   <li>SOLO_DAME/SOLO_BUBE 28: entspricht ~3 Damen/Buben (3×8=24) + 2 Asse (4) —
     *       Mindest-Trumpfkontrolle für ein realistisch gewinnbares Spezialsolo.</li>
     *   <li>SOLO_FLEISCHLOS 30: entspricht ~4 Asse (4×6=24) + 3 hohe Fehlkarten (3×2=6) —
     *       ohne Trümpfe braucht man mehr Fehlstich-Garantien als in einem Trumpfsolo.</li>
     * </ul>
     */
    int soloSchwelle(VorbehaltAnsage vorbehaltAnsage) {
        return switch (vorbehaltAnsage) {
            case SOLO_TRUMPF, SOLO_TRUMPF_HERZ, SOLO_TRUMPF_PIK, SOLO_TRUMPF_KREUZ -> 46;
            case SOLO_DAME, SOLO_BUBE -> 28;
            case SOLO_FLEISCHLOS -> 30;
            default -> Integer.MAX_VALUE;
        };
    }

    /**
     * Wie {@link #soloSchwelle(VorbehaltAnsage)}, wendet aber kontextabhängige Malusse an:
     * <ul>
     *   <li>+5 Punkte wenn {@code ohneNeunen} aktiv: weniger Karten auf der Hand bedeuten
     *       schlechtere Trumpfkontrolle — Sicherheitsmarge nötig.</li>
     *   <li>+38 % wenn Schweinchen oder 30-Augen-Pflicht aktiv: die Trumpfverteilung wird
     *       ausgeglichener, Solo-Ansagen ohne klare Überlegenheit scheitern häufiger.</li>
     * </ul>
     *
     * <p>Kalibrierung: (46+5) * 1.38 = 70.38 -> 71 (Loco-Blatt Trumpfsolo),
     * 46 * 1.38 = 63.48 -> 64 (nur Sonderregeln), 51 (nur ohneNeunen).
     */
    int soloSchwelle(VorbehaltAnsage vorbehaltAnsage, KiSpielzustand zustand) {
        int basis = soloSchwelle(vorbehaltAnsage);
        if (zustand.spielregeln().ohneNeunen()) {
            basis += 5;
        }
        boolean sonderpunkteAktiv = zustand.spielregeln().schweinchenAktiv()
            || zustand.spielregeln().dreissigAugenPflichtAktiv();
        if (!sonderpunkteAktiv) {
            return basis;
        }
        return (int) Math.ceil(basis * 1.38);
    }
}
