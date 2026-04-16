package de.locodoko.ki;

import de.locodoko.karten.Farbe;
import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartenwert;
import de.locodoko.partie.SpielerPosition;
import de.locodoko.partie.Stich;
import de.locodoko.karten.TrumpfOrdnung;
import de.locodoko.partie.Ansage;
import de.locodoko.partie.Partei;
import de.locodoko.partie.VorbehaltAnsage;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

public class StandardKiStrategie implements KiStrategie {

    private static final Comparator<Ansage> ANSAGEN_ABSTEIGEND = Comparator.comparingInt(Ansage::stufe).reversed();

    @Override
    public VorbehaltAnsage waehleVorbehalt(KiSpielzustand zustand) {
        List<VorbehaltAnsage> moeglicheVorbehalte = zustand.moeglicheVorbehalte();
        if (moeglicheVorbehalte.isEmpty()) {
            return VorbehaltAnsage.GESUND;
        }

        // Schmeissen ist immer die beste Wahl — 5 Koenige sind eine katastrophale Hand
        if (moeglicheVorbehalte.contains(VorbehaltAnsage.SCHMEISSEN)) {
            return VorbehaltAnsage.SCHMEISSEN;
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
            int wert = soloWert(vorbehalt, zustand);
            if (wert > besterSoloWert) {
                besterSoloWert = wert;
                besterSoloVorbehalt = vorbehalt;
            }
        }
        if (besterSoloVorbehalt != null && besterSoloWert >= soloSchwelle(besterSoloVorbehalt)) {
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
            .sorted(vergleicheGewinnKosten(zustand.trumpfOrdnung()))
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
        long eigeneTruepfe = anzahlTruepfe(zustand.eigeneHand().karten(), zustand.trumpfOrdnung());
        // Angebotswert: Basiswert 8 je Karte (jeder Trumpf ist wertvoller als eine Fehlkarte)
        // plus gewinnKosten (Rang der Karte in der Trumpfordnung — starke Trümpfe zählen mehr).
        int angebotWert = zustand.armutStatus().angeboteneTrumpfkarten().stream()
            .mapToInt(karte -> 8 + gewinnKosten(karte, zustand.trumpfOrdnung()))
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
                .sorted(vergleicheAbwurfKosten(zustand.trumpfOrdnung()))
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
                schwelle = (int) Math.ceil(schwelle * 1.18);
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
            return waehleAnspielKarte(zustand);
        }
        return waehleFolgeKarte(zustand);
    }

    private Karte waehleAnspielKarte(KiSpielzustand zustand) {
        // Hochzeit-Phase "sucht Partner": Der Hochzeit-Spieler spielt offensiv mit dem stärksten
        // Trumpf, um Klärungsstiche aktiv zu gewinnen. So behält er die Kontrolle darüber, ob er
        // einen schwachen oder starken Partner bekommt — oder das stille Solo erzwingt.
        if (zustand.hochzeitStatus() != null && zustand.hochzeitStatus().suchtPartner()
                && zustand.hochzeitStatus().hochzeitSpieler() == zustand.spielerPosition()) {
            Optional<Karte> staerksterTrumpf = zustand.gueltigeKarten().stream()
                .filter(zustand.trumpfOrdnung()::istTrumpf)
                .max(vergleicheGewinnKosten(zustand.trumpfOrdnung()));
            if (staerksterTrumpf.isPresent()) {
                return staerksterTrumpf.orElseThrow();
            }
        }

        long eigeneTruepfe = anzahlTruepfe(zustand.eigeneHand().karten(), zustand.trumpfOrdnung());
        // Ab 6 Trümpfen besitzt die KI genug Trumpfübergewicht (Mehrheit des 26-Trumpf-Stapels),
        // um gezielt mit kleinen Trümpfen zu ziehen — Gegner werden zur Abgabe guter Trümpfe gezwungen.
        if (eigeneTruepfe >= 6) {
            Optional<Karte> kleinerTrumpf = zustand.gueltigeKarten().stream()
                .filter(zustand.trumpfOrdnung()::istTrumpf)
                .min(vergleicheGewinnKosten(zustand.trumpfOrdnung()));
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
            .min(vergleicheAbwurfKosten(zustand.trumpfOrdnung()))
            .orElseThrow();
    }

    private Karte waehleFolgeKarte(KiSpielzustand zustand) {
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
                    .thenComparing(karte -> istFuchs(karte) ? 1 : 0)
                    .thenComparing(karte -> istKarlchen(karte) ? 1 : 0));
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
                    .max(vergleicheGewinnKosten(zustand.trumpfOrdnung()))
                    .orElseThrow();
            }
            // Hochzeit-Phase "sucht Partner": Als Nicht-Hochzeit-Spieler versuche ich, den
            // aktuellen Stich zu gewinnen, wenn der Hochzeit-Spieler ihn gerade führt — so werde
            // ich der Re-Partner, bevor jemand anderes diese Chance bekommt.
            if (zustand.hochzeitStatus() != null && zustand.hochzeitStatus().suchtPartner()
                    && zustand.hochzeitStatus().hochzeitSpieler() != zustand.spielerPosition()
                    && aktuellerGewinner == zustand.hochzeitStatus().hochzeitSpieler()) {
                return gewinnendeKarten.stream()
                    .min(vergleicheGewinnKosten(zustand.trumpfOrdnung()))
                    .orElseThrow();
            }
            return gewinnendeKarten.stream()
                .min(vergleicheGewinnKosten(zustand.trumpfOrdnung()))
                .orElseThrow();
        }

        return zustand.gueltigeKarten().stream()
            .min(vergleicheAbwurfKosten(zustand.trumpfOrdnung()))
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
        int trumpfAnzahl = (int) anzahlTruepfe(zustand.eigeneHand().karten(), zustand.trumpfOrdnung());
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
    private int soloWert(VorbehaltAnsage vorbehaltAnsage, KiSpielzustand zustand) {
        int trumpfAnzahl = (int) anzahlTruepfe(zustand.eigeneHand().karten(), zustand.trumpfOrdnung());
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
     *   <li>SOLO_TRUMPF_HERZ/PIK/KREUZ 46: Farbsolo hat dieselbe Trupfanzahl wie Trumpfsolo
     *       (24 Trumpfkarten im Deck: 8 Damen + 8 Buben + 8 Farbkarten) — gleiche Schwelle.</li>
     *   <li>SOLO_DAME/SOLO_BUBE 28: entspricht ~3 Damen/Buben (3×8=24) + 2 Asse (4) —
     *       Mindest-Trumpfkontrolle für ein realistisch gewinnbares Spezialsolo.</li>
     *   <li>SOLO_FLEISCHLOS 30: entspricht ~4 Asse (4×6=24) + 3 hohe Fehlkarten (3×2=6) —
     *       ohne Trümpfe braucht man mehr Fehlstich-Garantien als in einem Trumpfsolo.</li>
     * </ul>
     */
    private int soloSchwelle(VorbehaltAnsage vorbehaltAnsage) {
        return switch (vorbehaltAnsage) {
            case SOLO_TRUMPF, SOLO_TRUMPF_HERZ, SOLO_TRUMPF_PIK, SOLO_TRUMPF_KREUZ -> 46;
            case SOLO_DAME, SOLO_BUBE -> 28;
            case SOLO_FLEISCHLOS -> 30;
            default -> Integer.MAX_VALUE;
        };
    }

    private long anzahlTruepfe(List<Karte> karten, TrumpfOrdnung trumpfOrdnung) {
        return karten.stream().filter(trumpfOrdnung::istTrumpf).count();
    }

    private int laengeDerFehlfarbe(KiSpielzustand zustand, Farbe farbe) {
        return (int) zustand.eigeneHand().karten().stream()
            .filter(karte -> karte.farbe() == farbe)
            .filter(karte -> !zustand.trumpfOrdnung().istTrumpf(karte))
            .count();
    }

    private Comparator<Karte> vergleicheGewinnKosten(TrumpfOrdnung trumpfOrdnung) {
        return Comparator.<Karte>comparingInt(karte -> gewinnKosten(karte, trumpfOrdnung))
            .thenComparing(Karte::augen)
            .thenComparingInt(Karte::exemplarIndex);
    }

    private Comparator<Karte> vergleicheAbwurfKosten(TrumpfOrdnung trumpfOrdnung) {
        return Comparator.<Karte>comparingInt(karte -> abwurfKosten(karte, trumpfOrdnung))
            .thenComparingInt(Karte::augen)
            .thenComparingInt(Karte::exemplarIndex);
    }

    /**
     * Stärke einer Karte zum Gewinnen eines Stichs (niedrigerer Wert = billiger zu gewinnen).
     * Wird als Sortierschlüssel genutzt, um die schwächste gewinnende Karte zu finden (Prinzip:
     * "mit möglichst wenig Trumpf gewinnen").
     */
    private int gewinnKosten(Karte karte, TrumpfOrdnung trumpfOrdnung) {
        if (trumpfOrdnung.istTrumpf(karte)) {
            return trumpfOrdnung.trumpfRang(karte);
        }
        return trumpfOrdnung.fehlRang(karte);
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
    private int abwurfKosten(Karte karte, TrumpfOrdnung trumpfOrdnung) {
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

    private boolean istFuchs(Karte karte) {
        return karte.farbe() == Farbe.KARO && karte.wert() == Kartenwert.AS;
    }

    private boolean istKarlchen(Karte karte) {
        return karte.farbe() == Farbe.KREUZ && karte.wert() == Kartenwert.BUBE;
    }
}
