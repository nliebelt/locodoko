package de.locodoko.ki;

import de.locodoko.karten.Farbe;
import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartenwert;
import de.locodoko.partie.Ansage;
import de.locodoko.partie.Partei;
import de.locodoko.partie.VorbehaltAnsage;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

public class StandardKiStrategie implements KiStrategie {
    private static final Comparator<Ansage> ANSAGEN_ABSTEIGEND = Comparator.comparingInt(Ansage::stufe).reversed();

    private final KiAnspielBewerter anspielBewerter = new KiAnspielBewerter();
    private final KiFolgeBewerter folgeBewerter = new KiFolgeBewerter();
    private final KiVorbehaltBewerter vorbehaltBewerter = new KiVorbehaltBewerter();

    @Override
    public VorbehaltAnsage waehleVorbehalt(KiSpielzustand zustand) {
        List<VorbehaltAnsage> moeglicheVorbehalte = zustand.moeglicheVorbehalte();
        if (moeglicheVorbehalte.isEmpty()) {
            return VorbehaltAnsage.GESUND;
        }

        // Schmeissen ist immer die beste Wahl — katastrophale Hand
        Optional<VorbehaltAnsage> schmeissen = moeglicheVorbehalte.stream().filter(VorbehaltAnsage::istSchmeissen).findFirst();
        if (schmeissen.isPresent()) {
            return schmeissen.get();
        }

        VorbehaltAnsage besterSoloVorbehalt = null;
        int besterSoloWert = Integer.MIN_VALUE;
        for (VorbehaltAnsage vorbehalt : List.of(
            VorbehaltAnsage.SOLO_TRUMPF,
            VorbehaltAnsage.SOLO_TRUMPF_HERZ,
            VorbehaltAnsage.SOLO_TRUMPF_PIK,
            VorbehaltAnsage.SOLO_TRUMPF_KREUZ,
            VorbehaltAnsage.SOLO_DAME,
            VorbehaltAnsage.SOLO_BUBE,
            VorbehaltAnsage.SOLO_FLEISCHLOS
        )) {
            if (!moeglicheVorbehalte.contains(vorbehalt)) {
                continue;
            }
            int wert = vorbehaltBewerter.soloWert(vorbehalt, zustand);
            if (wert > besterSoloWert) {
                besterSoloWert = wert;
                besterSoloVorbehalt = vorbehalt;
            }
        }
        if (besterSoloVorbehalt != null && besterSoloWert >= vorbehaltBewerter.soloSchwelle(besterSoloVorbehalt, zustand)) {
            return besterSoloVorbehalt;
        }
        if (moeglicheVorbehalte.contains(VorbehaltAnsage.HOCHZEIT)) {
            return VorbehaltAnsage.HOCHZEIT;
        }
        if (moeglicheVorbehalte.contains(VorbehaltAnsage.ARMUT)) {
            return VorbehaltAnsage.ARMUT;
        }
        return VorbehaltAnsage.GESUND;
    }

    @Override
    public List<Karte> waehleArmutAngebot(KiSpielzustand zustand) {
        List<Karte> angebot = zustand.eigeneHand().karten().stream()
            .filter(zustand.trumpfOrdnung()::istTrumpf)
            .sorted(KiKartenBewertung.vergleicheGewinnKosten(zustand.trumpfOrdnung()))
            .toList();
        if (angebot.isEmpty()) {
            throw new IllegalStateException("Eine KI darf in der Armut nur mit vorhandenen Truempfen anbieten");
        }
        return angebot;
    }

    @Override
    public KiArmutAntwort waehleArmutAntwort(KiSpielzustand zustand) {
        if (zustand.armutStatus() == null || !zustand.armutStatus().angebotLiegtVor()) {
            return KiArmutAntwort.ablehnen();
        }
        long eigeneTruepfe = KiKartenBewertung.anzahlTruepfe(zustand.eigeneHand().karten(), zustand.trumpfOrdnung());
        // Angebotswert: Basiswert 8 je Karte (jeder Trumpf ist wertvoller als eine Fehlkarte)
        // plus gewinnKosten (Rang der Karte in der Trumpfordnung — starke Trümpfe zählen mehr).
        int angebotWert = zustand.armutStatus().angeboteneTrumpfkarten().stream()
            .mapToInt(karte -> 8 + KiKartenBewertung.gewinnKosten(karte, zustand.trumpfOrdnung()))
            .sum();
        // Ablehnen, wenn die KI selbst stark ist (> 5 Trümpfe = mindestens durchschnittliche Hand)
        // UND das Angebot schwach ist (< 55 Punkte ≈ 3 niedrige Trümpfe).
        // Annahme lohnt sich nur bei eigener Trumpfschwäche oder wertvollem Angebot.
        if (eigeneTruepfe > 5 && angebotWert < 55) {
            return KiArmutAntwort.ablehnen();
        }
        int anzahlRueckgabekarten = zustand.armutStatus().angeboteneTrumpfkarten().size();
        return KiArmutAntwort.annehmen(
            zustand.eigeneHand().karten().stream()
                .sorted(KiKartenBewertung.vergleicheAbwurfKosten(zustand.trumpfOrdnung()))
                .limit(anzahlRueckgabekarten)
                .toList()
        );
    }

    @Override
    public Optional<Ansage> waehleAnsage(KiSpielzustand zustand) {
        if (zustand.moeglicheAnsagen().isEmpty() || zustand.eigenePartei().isEmpty()) {
            return Optional.empty();
        }
        int handstaerke = handstaerke(zustand);
        boolean sonderpunkteAktiv = zustand.spielregeln().schweinchenAktiv()
            || zustand.spielregeln().dreissigAugenPflichtAktiv();
        for (Ansage ansage : zustand.moeglicheAnsagen().stream().sorted(ANSAGEN_ABSTEIGEND).toList()) {
            int schwelle = ansageSchwelle(ansage, zustand.eigenePartei().orElseThrow());
            // Mit Schweinchen oder 30-Augen-Pflicht sind Trumpfverteilungen ausgeglichener —
            // die KI soll vorsichtiger ansagen und braucht eine stärkere Hand.
            if (sonderpunkteAktiv) {
                schwelle = (int) Math.ceil(schwelle * 1.38);
            }
            if (handstaerke >= schwelle) {
                return Optional.of(ansage);
            }
        }
        return Optional.empty();
    }

    @Override
    public Karte waehleKarte(KiSpielzustand zustand) {
        if (zustand.gueltigeKarten().isEmpty()) {
            throw new IllegalStateException("Ohne gueltige Karten kann keine KI-Aktion bestimmt werden");
        }
        if (zustand.gueltigeKarten().size() == 1) {
            return zustand.gueltigeKarten().getFirst();
        }
        if (zustand.aktuellerStich() == null || zustand.aktuellerStich().gespielteKarten().isEmpty()) {
            return anspielBewerter.waehleAnspielKarte(zustand);
        }
        return folgeBewerter.waehleFolgeKarte(zustand);
    }

    /**
     * Berechnet einen Handstärke-Score für Ansage-Entscheidungen.
     *
     * <p>Kalibrierungsgrundlage: Eine durchschnittliche Hand (6 Trümpfe, 0 Asse, 0 Dullen, 1 Kreuz-Dame)
     * ergibt 6*3 + 0 + 0 + 1*4 = 22. Eine sehr starke Hand (8 Trümpfe, 2 Asse, 1 Dulle, 2 Kreuz-Damen)
     * ergibt 8*3 + 2*3 + 1*5 + 2*4 = 43. Ansagen werden ab 28 (RE) bis 54 (SCHWARZ) ausgelöst.
     *
     * <p>Gewichtungslogik:
     * <ul>
     *   <li>Trümpfe × 3: Jeder Trumpf trägt zur Stichkontrolle bei; 3 Punkte bilanzieren den
     *       Durchschnitt zwischen billigem Neuntrumpf und kostbarer Dulle.</li>
     *   <li>Asse × 3: Fehl-Asse gewinnen nach Trumpf-Auszug garantiert, daher gleichwertig zu Trümpfen.</li>
     *   <li>Dullen (Herz-10) × 5: Höchste Trümpfe im Normalspiel; Übergewicht gegenüber normalen
     *       Trümpfen wegen Doppel-Stechwert und 10 Augen.</li>
     *   <li>Kreuz-Damen × 4: Zweit- und dritthöchste Trümpfe, die zusätzlich die Re-Partei definieren;
     *       1 Punkt Bonus gegenüber gewöhnlichem Trumpf.</li>
     * </ul>
     */
    protected int handstaerke(KiSpielzustand zustand) {
        int trumpfAnzahl = (int) KiKartenBewertung.anzahlTruepfe(zustand.eigeneHand().karten(), zustand.trumpfOrdnung());
        int asse = (int) zustand.eigeneHand().karten().stream().filter(karte -> karte.wert() == Kartenwert.AS).count();
        int dullen = (int) zustand.eigeneHand().karten().stream()
            .filter(karte -> karte.farbe() == Farbe.HERZ && karte.wert() == Kartenwert.ZEHN)
            .count();
        int kreuzDamen = (int) zustand.eigeneHand().karten().stream()
            .filter(karte -> karte.farbe() == Farbe.KREUZ && karte.wert() == Kartenwert.DAME)
            .count();
        return trumpfAnzahl * 3 + asse * 3 + dullen * 5 + kreuzDamen * 4;
    }

    /**
     * Mindest-Handstärke für eine Ansage.
     *
     * <p>Kalibrierungsgrundlage (basiert auf {@link #handstaerke}):
     * <ul>
     *   <li>RE/KONTRA ab 28: entspricht ~7 Trümpfen + 1 Ass oder 8 Trümpfen allein — eine überdurchschnittliche
     *       Hand, mit der man realistisch 121+ Augen holen kann.</li>
     *   <li>KONTRA-Partei bekommt 2 Punkte Rabatt (Schwelle 26): Kontra-Spieler kennen sich nicht
     *       (keine Kreuz-Dame als Signal) und profitieren von frühzeitiger Parteideklaration.</li>
     *   <li>KONTRA als Re-Partei (Schwelle 30): Ungewöhnliche Konstellation — höhere Sicherheit
     *       nötig, um nicht aus einer bereits führenden Position unnötig zu riskieren.</li>
     *   <li>Jede Verschärfung (KEINE_90 → KEINE_60 → KEINE_30 → SCHWARZ) erfordert +6 Punkte:
     *       entspricht ~2 weiteren Trümpfen oder einem zusätzlichen Ass, die nötig sind, um
     *       das strengere Ziel (≤ 90 / 60 / 30 / 0 Gegneaugen) glaubwürdig zu erfüllen.</li>
     * </ul>
     */
    protected int ansageSchwelle(Ansage ansage, Partei eigenePartei) {
        return switch (ansage) {
            case RE -> 28;
            case KONTRA -> eigenePartei == Partei.KONTRA ? 26 : 30;
            case KEINE_90 -> 36;
            case KEINE_60 -> 42;
            case KEINE_30 -> 48;
            case SCHWARZ -> 54;
        };
    }
}
