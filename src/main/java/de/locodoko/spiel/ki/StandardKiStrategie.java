package de.locodoko.spiel.ki;

import de.locodoko.spiel.karten.Farbe;
import de.locodoko.spiel.karten.Karte;
import de.locodoko.spiel.karten.Kartenwert;
import de.locodoko.spiel.karten.SpielerPosition;
import de.locodoko.spiel.karten.Stich;
import de.locodoko.spiel.karten.TrumpfOrdnung;
import de.locodoko.spiel.partie.Ansage;
import de.locodoko.spiel.partie.Partei;
import de.locodoko.spiel.partie.VorbehaltAnsage;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

@Component
public class StandardKiStrategie implements KiStrategie {

    private static final Comparator<Ansage> ANSAGEN_ABSTEIGEND = Comparator.comparingInt(Ansage::stufe).reversed();

    @Override
    public VorbehaltAnsage waehleVorbehalt(KiSpielzustand zustand) {
        List<VorbehaltAnsage> moeglicheVorbehalte = zustand.moeglicheVorbehalte();
        if (moeglicheVorbehalte.isEmpty()) {
            return VorbehaltAnsage.GESUND;
        }

        VorbehaltAnsage besterSoloVorbehalt = null;
        int besterSoloWert = Integer.MIN_VALUE;
        for (VorbehaltAnsage vorbehalt : List.of(
            VorbehaltAnsage.SOLO_TRUMPF,
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
        int angebotWert = zustand.armutStatus().angeboteneTrumpfkarten().stream()
            .mapToInt(karte -> 8 + gewinnKosten(karte, zustand.trumpfOrdnung()))
            .sum();
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
        for (Ansage ansage : zustand.moeglicheAnsagen().stream().sorted(ANSAGEN_ABSTEIGEND).toList()) {
            if (handstaerke >= ansageSchwelle(ansage, zustand.eigenePartei().orElseThrow())) {
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
        long eigeneTruepfe = anzahlTruepfe(zustand.eigeneHand().karten(), zustand.trumpfOrdnung());
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

        if (eigenePartei != null && sichtbareGewinnerPartei.filter(eigenePartei::equals).isPresent() && aktuellerGewinner != zustand.spielerPosition()) {
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
            return gewinnendeKarten.stream()
                .min(vergleicheGewinnKosten(zustand.trumpfOrdnung()))
                .orElseThrow();
        }

        return zustand.gueltigeKarten().stream()
            .min(vergleicheAbwurfKosten(zustand.trumpfOrdnung()))
            .orElseThrow();
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

    private int handstaerke(KiSpielzustand zustand) {
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

    private int ansageSchwelle(Ansage ansage, Partei eigenePartei) {
        return switch (ansage) {
            case RE -> 28;
            case KONTRA -> eigenePartei == Partei.KONTRA ? 26 : 30;
            case KEINE_90 -> 36;
            case KEINE_60 -> 42;
            case KEINE_30 -> 48;
            case SCHWARZ -> 54;
        };
    }

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
            case SOLO_DAME -> damen * 8 + asse * 2 + hoheFehlkarten;
            case SOLO_BUBE -> buben * 8 + asse * 2 + hoheFehlkarten;
            case SOLO_FLEISCHLOS -> asse * 6 + hoheFehlkarten * 2 - trumpfAnzahl;
            default -> Integer.MIN_VALUE;
        };
    }

    private int soloSchwelle(VorbehaltAnsage vorbehaltAnsage) {
        return switch (vorbehaltAnsage) {
            case SOLO_TRUMPF -> 34;
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

    private int gewinnKosten(Karte karte, TrumpfOrdnung trumpfOrdnung) {
        if (trumpfOrdnung.istTrumpf(karte)) {
            return trumpfOrdnung.trumpfRang(karte);
        }
        return trumpfOrdnung.fehlRang(karte);
    }

    private int abwurfKosten(Karte karte, TrumpfOrdnung trumpfOrdnung) {
        int kosten = karte.augen();
        if (trumpfOrdnung.istTrumpf(karte)) {
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
