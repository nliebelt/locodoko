package de.locodoko.partie;

import de.locodoko.karten.BubensoloTrumpfOrdnung;
import de.locodoko.karten.DamensoloTrumpfOrdnung;
import de.locodoko.karten.Farbe;
import de.locodoko.karten.FleischlosTrumpfOrdnung;
import de.locodoko.karten.Hand;
import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartendeck;
import de.locodoko.karten.Kartenwert;
import de.locodoko.karten.NormaleTrumpfOrdnung;
import de.locodoko.karten.SchweinchenTrumpfOrdnung;
import de.locodoko.karten.VariableTrumpfsoloTrumpfOrdnung;
import de.locodoko.karten.SpielerPosition;
import de.locodoko.karten.Spielregeln;
import de.locodoko.karten.Spieltyp;
import de.locodoko.karten.Stich;
import de.locodoko.karten.TrumpfOrdnung;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

/**
 * Ein einzelnes Doppelkopf-Spiel innerhalb einer Partie.
 *
 * <p>Kapselt den vollstaendigen Spielzustand: aktive {@link Spielphase}, Haende aller Spieler,
 * bisherige Vorbehalte, Parteizuordnung, Ansage-Historie, abgeschlossene und laufende Stiche
 * sowie das Ergebnis nach der Auswertung. Sonderzustaende fuer Hochzeit und Armut werden
 * in eigenen Status-Value-Objects ({@link HochzeitStatus}, {@link ArmutStatus}) verwaltet.</p>
 *
 * <p>Zentraler Domain-Kern: Die gesamte Spiellogik (Stichvalidierung, Vorbehalt-Aufloesung,
 * Ansage-Zeitfenster, Auswertung) liegt hier, damit Backend, KI und Snapshot-Antworten
 * dieselbe serverseitige Wahrheitsquelle nutzen. Unveraenderlich — jede Aktion liefert eine
 * neue Spiel-Instanz.</p>
 */
public final class Spiel {

    private final Spielregeln spielregeln;
    private final Kartendeck kartendeck;
    private final TrumpfOrdnung trumpfOrdnung;
    private final Spieltyp spieltyp;
    private final SpielerPosition geber;
    private final Spielphase phase;
    private final Map<SpielerPosition, Hand> haende;
    private final List<VorbehaltMeldung> vorbehalte;
    private final Parteien parteien;
    private final Ansagen ansagen;
    private final List<Stich> abgeschlosseneStiche;
    private final Spielergebnis ergebnis;
    /** Position des Solisten aus dem vorherigen Spiel; bestimmt den ersten Aufspieler. Null wenn kein Solo vorausging. */
    private final SpielerPosition solistAufspieler;

    private Spiel(
        Spielregeln spielregeln,
        Kartendeck kartendeck,
        TrumpfOrdnung trumpfOrdnung,
        Spieltyp spieltyp,
        SpielerPosition geber,
        Spielphase phase,
        Map<SpielerPosition, Hand> haende,
        List<VorbehaltMeldung> vorbehalte,
        Parteien parteien,
        Ansagen ansagen,
        List<Stich> abgeschlosseneStiche,
        Spielergebnis ergebnis,
        SpielerPosition solistAufspieler
    ) {
        this.spielregeln = Objects.requireNonNull(spielregeln, "spielregeln duerfen nicht null sein");
        this.kartendeck = Objects.requireNonNull(kartendeck, "kartendeck darf nicht null sein");
        this.trumpfOrdnung = Objects.requireNonNull(trumpfOrdnung, "trumpfOrdnung darf nicht null sein");
        this.spieltyp = Objects.requireNonNull(spieltyp, "spieltyp darf nicht null sein");
        this.geber = Objects.requireNonNull(geber, "geber darf nicht null sein");
        this.phase = Objects.requireNonNull(phase, "phase darf nicht null sein");
        this.haende = Map.copyOf(haende);
        this.vorbehalte = List.copyOf(vorbehalte);
        this.parteien = parteien;
        this.ansagen = Objects.requireNonNull(ansagen, "ansagen duerfen nicht null sein");
        this.abgeschlosseneStiche = List.copyOf(abgeschlosseneStiche);
        this.ergebnis = ergebnis;
        this.solistAufspieler = solistAufspieler;
    }

    public static Spiel neu(SpielerPosition geber, Spielregeln spielregeln, Kartendeck kartendeck) {
        Objects.requireNonNull(geber, "geber darf nicht null sein");
        return new SpielBuilder()
            .spielregeln(spielregeln)
            .kartendeck(kartendeck)
            .trumpfOrdnung(new NormaleTrumpfOrdnung(spielregeln))
            .spieltyp(Spieltyp.NORMALSPIEL)
            .geber(geber)
            .phase(Spielphase.KARTEN_AUSTEILEN)
            .haende(Map.of())
            .vorbehalte(List.of())
            .parteien(null)
            .ansagen(Ansagen.leer())
            .abgeschlosseneStiche(List.of())
            .ergebnis(null)
            .solistAufspieler(null)
            .build();
    }

    /** Wie {@link #neu}, aber der Solist des vorherigen Spiels erhaelt das Anspielrecht. */
    public static Spiel neuMitSolistAufspieler(SpielerPosition geber, SpielerPosition solistAufspieler, Spielregeln spielregeln, Kartendeck kartendeck) {
        Objects.requireNonNull(geber, "geber darf nicht null sein");
        Objects.requireNonNull(solistAufspieler, "solistAufspieler darf nicht null sein");
        return new SpielBuilder()
            .spielregeln(spielregeln)
            .kartendeck(kartendeck)
            .trumpfOrdnung(new NormaleTrumpfOrdnung(spielregeln))
            .spieltyp(Spieltyp.NORMALSPIEL)
            .geber(geber)
            .phase(Spielphase.KARTEN_AUSTEILEN)
            .haende(Map.of())
            .vorbehalte(List.of())
            .parteien(null)
            .ansagen(Ansagen.leer())
            .abgeschlosseneStiche(List.of())
            .ergebnis(null)
            .solistAufspieler(solistAufspieler)
            .build();
    }

    public static Spiel ausPersistiertemStand(
        Spielregeln spielregeln,
        Kartendeck kartendeck,
        Spieltyp spieltyp,
        SpielerPosition geber,
        Spielphase phase,
        Map<SpielerPosition, Hand> haende,
        List<VorbehaltMeldung> vorbehalte,
        Parteien parteien,
        Ansagen ansagen,
        List<Stich> abgeschlosseneStiche,
        Spielergebnis ergebnis,
        boolean schweinchenAktiv,
        SpielerPosition solistAufspieler
    ) {
        return new SpielBuilder()
            .spielregeln(spielregeln)
            .kartendeck(kartendeck)
            .trumpfOrdnung(trumpfOrdnungFuerPersistiertenStand(spielregeln, spieltyp, schweinchenAktiv))
            .spieltyp(spieltyp)
            .geber(geber)
            .phase(phase)
            .haende(haende)
            .vorbehalte(vorbehalte)
            .parteien(parteien)
            .ansagen(ansagen)
            .abgeschlosseneStiche(abgeschlosseneStiche)
            .ergebnis(ergebnis)
            .solistAufspieler(solistAufspieler)
            .build();
    }

    public Spiel teileKartenAus() {
        pruefePhase(Spielphase.KartenAusteilen.class, "Karten austeilen");
        Map<SpielerPosition, Hand> neueHaende = kartendeck.anVierSpielerAusteilen();
        TrumpfOrdnung neueTrumpfOrdnung = hatSchweinchen(spielregeln, neueHaende)
            ? new SchweinchenTrumpfOrdnung(spielregeln)
            : trumpfOrdnung;
        return toBuilder()
            .trumpfOrdnung(neueTrumpfOrdnung)
            .phase(Spielphase.VORBEHALT_ANSAGE)
            .haende(neueHaende)
            .vorbehalte(List.of())
            .parteien(null)
            .ergebnis(null)
            .build();
    }

    public Optional<SpielerPosition> naechsterVorbehaltSpieler() {
        if (!(phase instanceof Spielphase.VorbehaltAnsage) || vorbehalte.size() >= SpielerPosition.standardReihenfolge().size()) {
            return Optional.empty();
        }
        List<SpielerPosition> reihenfolge = SpielerPosition.imUhrzeigersinnAb(geber.naechsteImUhrzeigersinn());
        return Optional.of(reihenfolge.get(vorbehalte.size()));
    }

    public Spiel meldeGesund(SpielerPosition spielerPosition) {
        return meldeVorbehalt(spielerPosition, VorbehaltAnsage.GESUND);
    }

    public Spiel meldeVorbehalt(SpielerPosition spielerPosition, VorbehaltAnsage vorbehaltAnsage) {
        pruefePhase(Spielphase.VorbehaltAnsage.class, "Gesund melden");
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        Objects.requireNonNull(vorbehaltAnsage, "vorbehaltAnsage darf nicht null sein");
        SpielerPosition erwarteterSpieler = naechsterVorbehaltSpieler()
            .orElseThrow(() -> new IllegalStateException("Es werden keine Vorbehalte mehr erwartet"));
        if (spielerPosition != erwarteterSpieler) {
            throw new IllegalStateException("Vorbehalte muessen in Sitzreihenfolge gemeldet werden; erwartet: " + erwarteterSpieler);
        }
        if (!vorbehaltAnsage.istZulaessig(handVon(spielerPosition), spielregeln)) {
            throw new IllegalStateException("Vorbehalt " + vorbehaltAnsage + " ist fuer " + spielerPosition + " nach den Spielregeln nicht zulaessig");
        }
        List<VorbehaltMeldung> neueVorbehalte = new ArrayList<>(vorbehalte);
        neueVorbehalte.add(new VorbehaltMeldung(spielerPosition, vorbehaltAnsage));
        Spielphase naechstePhase = neueVorbehalte.size() == SpielerPosition.standardReihenfolge().size()
            ? Spielphase.VORBEHALT_AUFLOESUNG
            : Spielphase.VORBEHALT_ANSAGE;
        return toBuilder()
            .phase(naechstePhase)
            .vorbehalte(neueVorbehalte)
            .build();
    }

    public Spiel loeseVorbehalteAuf() {
        pruefePhase(Spielphase.VorbehaltAufloesung.class, "Vorbehalte aufloesen");
        VorbehaltMeldung hoechsterVorbehalt = hoechsterVorbehalt().orElse(null);

        // Stilles Solo durch Gesund-Meldung: Ein Spieler besitzt beide Kreuz-Damen ohne Vorbehalt.
        // ausNormalspielHaenden wuerde eine IllegalStateException werfen, da nur 1 RE-Spieler
        // gefunden wird. Stattdessen wird das Spiel als Trumpfsolo fuer diesen Spieler gestartet.
        SpielerPosition ersterAufspieler = solistAufspieler != null ? solistAufspieler : geber.naechsteImUhrzeigersinn();

        if (hoechsterVorbehalt == null) {
            SpielerPosition stillesSoloSpieler = erkenneStillesSoloSpieler();
            if (stillesSoloSpieler != null) {
                return toBuilder()
                    .trumpfOrdnung(new NormaleTrumpfOrdnung(spielregeln))
                    .spieltyp(Spieltyp.SOLO_TRUMPF)
                    .phase(new Spielphase.Stichphase(Stich.neu(ersterAufspieler), Set.of(), null))
                    .parteien(Parteien.ausSolo(stillesSoloSpieler))
                    .ansagen(Ansagen.leer())
                    .abgeschlosseneStiche(List.of())
                    .ergebnis(null)
                    .solistAufspieler(null)
                    .build();
            }
        }

        Parteien neueParteien = hoechsterVorbehalt == null
            ? Parteien.ausNormalspielHaenden(haende)
            : parteienFuer(hoechsterVorbehalt);
        HochzeitStatus neuerHochzeitStatus = hoechsterVorbehalt != null && hoechsterVorbehalt.ansage() == VorbehaltAnsage.HOCHZEIT
            ? HochzeitStatus.gestartet(hoechsterVorbehalt.spielerPosition())
            : null;
        ArmutStatus neuerArmutStatus = hoechsterVorbehalt != null && hoechsterVorbehalt.ansage() == VorbehaltAnsage.ARMUT
            ? ArmutStatus.gestartet(hoechsterVorbehalt.spielerPosition())
            : null;
        Spielphase naechstePhase = neuerArmutStatus != null
            ? new Spielphase.ArmutTausch(neuerArmutStatus)
            : new Spielphase.Stichphase(Stich.neu(ersterAufspieler), Set.of(), neuerHochzeitStatus);
        return toBuilder()
            .trumpfOrdnung(trumpfOrdnungFuer(hoechsterVorbehalt))
            .spieltyp(spieltypFuer(hoechsterVorbehalt))
            .phase(naechstePhase)
            .parteien(neueParteien)
            .ansagen(Ansagen.leer())
            .abgeschlosseneStiche(List.of())
            .ergebnis(null)
            .solistAufspieler(null)
            .build();
    }

    public Spiel legeArmutTrumpfkarten(SpielerPosition spielerPosition, List<Karte> angeboteneTrumpfkarten) {
        if (!(phase instanceof Spielphase.ArmutTausch armutTauschPhase)) {
            throw new IllegalStateException("Armut-Karten anbieten ist nur in Phase ARMUT_TAUSCH erlaubt, war aber " + phase.name());
        }
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        Objects.requireNonNull(angeboteneTrumpfkarten, "angeboteneTrumpfkarten duerfen nicht null sein");
        ArmutStatus status = armutTauschPhase.armutStatus();
        if (spielerPosition != status.armutSpieler()) {
            throw new IllegalStateException("Nur der Armut-Spieler darf Trumpfkarten anbieten");
        }
        if (status.angebotLiegtVor()) {
            throw new IllegalStateException("Die Trumpfkarten fuer die Armut wurden bereits angeboten");
        }
        Hand armutHand = handVon(spielerPosition);
        long anzahlTruepfe = anzahlTruepfe(armutHand);
        if (angeboteneTrumpfkarten.size() != anzahlTruepfe) {
            throw new IllegalStateException("Die Armut muss genau alle eigenen Trumpfkarten anbieten; erwartet: " + anzahlTruepfe);
        }
        for (Karte karte : angeboteneTrumpfkarten) {
            if (!armutHand.enthaelt(karte)) {
                throw new IllegalStateException("Angebotene Karte ist nicht auf der Hand des Armut-Spielers: " + karte);
            }
            if (!trumpfOrdnung.istTrumpf(karte)) {
                throw new IllegalStateException("In der Armut duerfen nur Trumpfkarten angeboten werden: " + karte);
            }
        }
        Map<SpielerPosition, Hand> neueHaende = kopiereHaende();
        neueHaende.put(spielerPosition, armutHand.ohneAlle(angeboteneTrumpfkarten));
        return toBuilder()
            .haende(neueHaende)
            .phase(new Spielphase.ArmutTausch(status.mitAngebot(angeboteneTrumpfkarten)))
            .build();
    }

    public Spiel lehneArmutAb(SpielerPosition spielerPosition) {
        if (!(phase instanceof Spielphase.ArmutTausch armutTauschPhase)) {
            throw new IllegalStateException("Armut ablehnen ist nur in Phase ARMUT_TAUSCH erlaubt, war aber " + phase.name());
        }
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        ArmutStatus status = armutTauschPhase.armutStatus();
        if (!status.angebotLiegtVor()) {
            throw new IllegalStateException("Die Armut kann erst nach dem Trumpf-Angebot abgelehnt werden");
        }
        ArmutStatus neuerStatus = status.mitAblehnung(spielerPosition);
        if (neuerStatus.alleAntwortenErschoepft()) {
            return eingeworfenesSpiel();
        }
        return toBuilder()
            .phase(new Spielphase.ArmutTausch(neuerStatus))
            .build();
    }

    public Spiel nimmArmutAn(SpielerPosition spielerPosition, List<Karte> rueckgabekarten) {
        if (!(phase instanceof Spielphase.ArmutTausch armutTauschPhase)) {
            throw new IllegalStateException("Armut annehmen ist nur in Phase ARMUT_TAUSCH erlaubt, war aber " + phase.name());
        }
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        Objects.requireNonNull(rueckgabekarten, "rueckgabekarten duerfen nicht null sein");
        ArmutStatus status = armutTauschPhase.armutStatus();
        if (!status.angebotLiegtVor()) {
            throw new IllegalStateException("Die Armut kann erst nach dem Trumpf-Angebot angenommen werden");
        }
        SpielerPosition erwarteterSpieler = status.aktuellerAntwortspieler()
            .orElseThrow(() -> new IllegalStateException("Es gibt aktuell keinen moeglichen Armut-Partner"));
        if (spielerPosition != erwarteterSpieler) {
            throw new IllegalStateException("Die Armut muss reihum beantwortet werden; erwartet: " + erwarteterSpieler);
        }
        if (rueckgabekarten.size() != status.angeboteneTrumpfkarten().size()) {
            throw new IllegalStateException("Es muessen genau " + status.angeboteneTrumpfkarten().size() + " Karten zurueckgegeben werden");
        }
        Hand partnerHand = handVon(spielerPosition);
        for (Karte karte : rueckgabekarten) {
            if (!partnerHand.enthaelt(karte)) {
                throw new IllegalStateException("Zurueckgegebene Karte ist nicht auf der Hand des annehmenden Spielers: " + karte);
            }
        }
        Map<SpielerPosition, Hand> neueHaende = kopiereHaende();
        neueHaende.put(spielerPosition, partnerHand.ohneAlle(rueckgabekarten).mitAllen(status.angeboteneTrumpfkarten()));
        neueHaende.put(status.armutSpieler(), handVon(status.armutSpieler()).mitAllen(rueckgabekarten));
        Parteien neueParteien = parteien
            .mitPartei(spielerPosition, Partei.RE)
            .mitOffenenParteienFuerAlle(SpielerPosition.standardReihenfolge());
        SpielerPosition ersterAufspieler = solistAufspieler != null ? solistAufspieler : geber.naechsteImUhrzeigersinn();
        return toBuilder()
            .phase(new Spielphase.Stichphase(Stich.neu(ersterAufspieler), Set.of(), null))
            .haende(neueHaende)
            .parteien(neueParteien)
            .ansagen(Ansagen.leer())
            .abgeschlosseneStiche(List.of())
            .ergebnis(null)
            .solistAufspieler(null)
            .build();
    }

    public Optional<SpielerPosition> aktuellerSpieler() {
        if (!(phase instanceof Spielphase.Stichphase stichphase)) {
            return Optional.empty();
        }
        return Optional.of(stichphase.aktuellerStich().erwarteterSpieler());
    }

    public Optional<SpielerPosition> erwarteterSpieler() {
        return switch (phase) {
            case Spielphase.VorbehaltAnsage _ -> naechsterVorbehaltSpieler();
            case Spielphase.ArmutTausch armutTauschPhase -> {
                ArmutStatus status = armutTauschPhase.armutStatus();
                yield status.angebotLiegtVor()
                    ? status.aktuellerAntwortspieler()
                    : Optional.of(status.armutSpieler());
            }
            case Spielphase.Stichphase _ -> aktuellerSpieler();
            default -> Optional.empty();
        };
    }

    public List<Karte> gueltigeKartenFuer(SpielerPosition spielerPosition) {
        if (!(phase instanceof Spielphase.Stichphase stichphase)) {
            throw new IllegalStateException("gueltige Karten abfragen ist nur in Phase STICHPHASE erlaubt, war aber " + phase.name());
        }
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        SpielerPosition erwarteterSpieler = aktuellerSpieler()
            .orElseThrow(() -> new IllegalStateException("Es gibt aktuell keinen erwarteten Spieler"));
        if (spielerPosition != erwarteterSpieler) {
            throw new IllegalStateException("Gueltige Karten koennen nur fuer den aktuellen Spieler abgefragt werden; erwartet: " + erwarteterSpieler);
        }
        return stichphase.aktuellerStich().gueltigeKarten(handVon(spielerPosition), trumpfOrdnung);
    }

    public Spiel spieleKarte(SpielerPosition spielerPosition, Karte karte) {
        if (!(phase instanceof Spielphase.Stichphase stichphase)) {
            throw new IllegalStateException("Karte spielen ist nur in Phase STICHPHASE erlaubt, war aber " + phase.name());
        }
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        Objects.requireNonNull(karte, "karte darf nicht null sein");

        if (!stichphase.pflichtansageAusstehend().isEmpty()) {
            throw new IllegalStateException(
                "Karte spielen ist erst erlaubt wenn alle ausstehenden Pflichtansagen gemacht wurden: " + stichphase.pflichtansageAusstehend()
            );
        }

        Hand hand = handVon(spielerPosition);
        Stich gespielterStich = stichphase.aktuellerStich().spieleKarte(spielerPosition, karte, hand, trumpfOrdnung);
        Map<SpielerPosition, Hand> neueHaende = kopiereHaende();
        neueHaende.put(spielerPosition, hand.ohne(karte));

        if (!gespielterStich.istVollstaendig()) {
            return neuesSpielMitStichfortschritt(neueHaende, abgeschlosseneStiche,
                new Spielphase.Stichphase(gespielterStich, stichphase.pflichtansageAusstehend(), stichphase.hochzeitStatus()),
                parteien);
        }

        List<Stich> neueAbgeschlosseneStiche = new ArrayList<>(abgeschlosseneStiche);
        neueAbgeschlosseneStiche.add(gespielterStich);

        Set<Partei> neuesPflichtansageAusstehend = berechneNeuePflichtansagen(gespielterStich, neueAbgeschlosseneStiche.size());

        HochzeitFortschritt hochzeitFortschritt = fortschrittNachVollstaendigemStich(gespielterStich, stichphase.hochzeitStatus());
        if (neueAbgeschlosseneStiche.size() == kartenProSpieler()) {
            return neuesSpielMitStichfortschritt(
                neueHaende,
                neueAbgeschlosseneStiche,
                Spielphase.AUSWERTUNG,
                hochzeitFortschritt.parteien()
            );
        }

        Stich naechsterStich = Stich.neu(gespielterStich.naechsterAufspieler(trumpfOrdnung));
        return neuesSpielMitStichfortschritt(
            neueHaende,
            neueAbgeschlosseneStiche,
            new Spielphase.Stichphase(naechsterStich, neuesPflichtansageAusstehend, hochzeitFortschritt.status()),
            hochzeitFortschritt.parteien()
        );
    }

    /**
     * Berechnet nach Abschluss eines Stichs, welche Parteien eine Pflichtansage machen muessen.
     *
     * <p>Bedingungen (alle muessen zutreffen): dreissigAugenPflichtAktiv, Stich 1 oder 2,
     * Spieltyp NORMALSPIEL oder HOCHZEIT, Stich hat mehr als 30 Augen, die gewinnende Partei
     * hat noch keine Grundansage gemacht.</p>
     */
    private Set<Partei> berechneNeuePflichtansagen(Stich abgeschlossenerStich, int stichNummer) {
        if (!spielregeln.dreissigAugenPflichtAktiv()) {
            return Set.of();
        }
        if (stichNummer > 2) {
            return Set.of();
        }
        if (spieltyp != Spieltyp.NORMALSPIEL && spieltyp != Spieltyp.HOCHZEIT) {
            return Set.of();
        }
        if (!abgeschlossenerStich.augen().ueberschreitet(30)) {
            return Set.of();
        }
        Partei gewinnendePflichtpartei = parteien.parteiVon(abgeschlossenerStich.gewinner(trumpfOrdnung).spieler());
        if (ansagen.hatGrundansage(gewinnendePflichtpartei, parteien)) {
            return Set.of();
        }
        EnumSet<Partei> ergebnis = EnumSet.noneOf(Partei.class);
        ergebnis.add(gewinnendePflichtpartei);
        return Set.copyOf(ergebnis);
    }

    public boolean kannAnsagen(SpielerPosition spielerPosition, Ansage ansage) {
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        Objects.requireNonNull(ansage, "ansage darf nicht null sein");
        if (!(phase instanceof Spielphase.Stichphase stichphase)) {
            return false;
        }
        if (spielerPosition != stichphase.aktuellerStich().erwarteterSpieler()) {
            return false;
        }
        if (stichphase.hochzeitStatus() != null && stichphase.hochzeitStatus().suchtPartner() && spielerPosition != stichphase.hochzeitStatus().hochzeitSpieler()) {
            return false;
        }
        int effektiveKartenAnzahl = effektiveKartenAnzahlFuer(spielerPosition, ansage, stichphase.pflichtansageAusstehend());
        return ansagen.kannAnsagen(spielerPosition, ansage, parteien(), spielregeln, effektiveKartenAnzahl);
    }

    public Spiel sageAn(SpielerPosition spielerPosition, Ansage ansage) {
        if (!(phase instanceof Spielphase.Stichphase stichphase)) {
            throw new IllegalStateException("Ansage taetigen ist nur in Phase STICHPHASE erlaubt, war aber " + phase.name());
        }
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        Objects.requireNonNull(ansage, "ansage darf nicht null sein");
        SpielerPosition erwarteterSpieler = aktuellerSpieler()
            .orElseThrow(() -> new IllegalStateException("Es gibt aktuell keinen erwarteten Spieler"));
        if (spielerPosition != erwarteterSpieler) {
            throw new IllegalStateException("Ansagen duerfen nur vom aktuellen Spieler kommen; erwartet: " + erwarteterSpieler);
        }
        if (stichphase.hochzeitStatus() != null && stichphase.hochzeitStatus().suchtPartner() && spielerPosition != stichphase.hochzeitStatus().hochzeitSpieler()) {
            throw new IllegalStateException("Vor der Klaerung der Hochzeit darf nur der Hochzeits-Spieler Ansagen taetigen");
        }
        int effektiveKartenAnzahlFuerAnsage = effektiveKartenAnzahlFuer(spielerPosition, ansage, stichphase.pflichtansageAusstehend());
        Ansagen neueAnsagen = ansagen.fuegeHinzu(
            spielerPosition,
            ansage,
            parteien(),
            spielregeln,
            effektiveKartenAnzahlFuerAnsage
        );
        // Grundansagen (Re/Kontra) offenbaren die Parteizugehoerigkeit serverseitig — das Backend
        // ist einzige Wahrheitsquelle, daher wird offenFuerAlle im Domainmodell aktualisiert.
        Parteien aktualisierteParteien = ansage.istGrundansage()
            ? parteien.mitOffenenParteienFuerAlle(List.of(spielerPosition))
            : parteien;
        // Pflichtansage erfuellt: betroffene Partei aus ausstehenden Pflichtansagen entfernen
        Set<Partei> aktualisiertesPflichtansageAusstehend = stichphase.pflichtansageAusstehend();
        if (ansage.istGrundansage() && !stichphase.pflichtansageAusstehend().isEmpty()) {
            Partei partei = parteien.parteiVon(spielerPosition);
            if (stichphase.pflichtansageAusstehend().contains(partei)) {
                EnumSet<Partei> neuesMenge = EnumSet.copyOf(stichphase.pflichtansageAusstehend());
                neuesMenge.remove(partei);
                aktualisiertesPflichtansageAusstehend = neuesMenge.isEmpty() ? Set.of() : Set.copyOf(neuesMenge);
            }
        }
        return toBuilder()
            .parteien(aktualisierteParteien)
            .ansagen(neueAnsagen)
            .phase(new Spielphase.Stichphase(stichphase.aktuellerStich(), aktualisiertesPflichtansageAusstehend, stichphase.hochzeitStatus()))
            .solistAufspieler(null)
            .build();
    }

    private int effektiveKartenAnzahlFuer(SpielerPosition position, Ansage ansage, Set<Partei> pflichtansageAusstehend) {
        Partei partei = parteien().parteiVon(position);
        boolean istPflichtansage = !pflichtansageAusstehend.isEmpty()
            && pflichtansageAusstehend.contains(partei)
            && ansage.istGrundansage();
        return istPflichtansage ? Integer.MAX_VALUE : handVon(position).karten().size();
    }

    public Spiel werteAus() {
        pruefePhase(Spielphase.Auswertung.class, "Spiel auswerten");
        Spielergebnis neuesErgebnis = new PunkteRechner().berechneNormalspielErgebnis(
            abgeschlosseneStiche,
            parteien(),
            trumpfOrdnung,
            ansagen,
            spielregeln
        );
        return toBuilder()
            .phase(Spielphase.GESAMTSTAND_AKTUALISIEREN)
            .ergebnis(neuesErgebnis)
            .solistAufspieler(null)
            .build();
    }

    public Spielregeln spielregeln() {
        return spielregeln;
    }

    public Spieltyp spieltyp() {
        return spieltyp;
    }

    public SpielerPosition geber() {
        return geber;
    }

    public Spielphase phase() {
        return phase;
    }

    public List<VorbehaltMeldung> vorbehalte() {
        return vorbehalte;
    }

    public Map<SpielerPosition, Hand> haende() {
        return haende;
    }

    public Hand handVon(SpielerPosition spielerPosition) {
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        Hand hand = haende.get(spielerPosition);
        if (hand == null) {
            throw new IllegalArgumentException("Es gibt keine Hand fuer " + spielerPosition);
        }
        return hand;
    }

    public List<Stich> abgeschlosseneStiche() {
        return abgeschlosseneStiche;
    }

    public Optional<Stich> aktuellerStich() {
        return phase instanceof Spielphase.Stichphase s ? Optional.of(s.aktuellerStich()) : Optional.empty();
    }

    public Parteien parteien() {
        if (parteien == null) {
            throw new IllegalStateException("Die Parteien sind erst nach der Vorbehaltsaufloesung bekannt");
        }
        return parteien;
    }

    public Ansagen ansagen() {
        return ansagen;
    }

    public Optional<Spielergebnis> ergebnis() {
        return Optional.ofNullable(ergebnis);
    }

    public Optional<HochzeitStatus> hochzeitStatus() {
        return phase instanceof Spielphase.Stichphase s ? Optional.ofNullable(s.hochzeitStatus()) : Optional.empty();
    }

    public Optional<ArmutStatus> armutStatus() {
        return phase instanceof Spielphase.ArmutTausch a ? Optional.of(a.armutStatus()) : Optional.empty();
    }

    public Set<Partei> pflichtansageAusstehend() {
        return phase instanceof Spielphase.Stichphase s ? s.pflichtansageAusstehend() : Set.of();
    }

    public TrumpfOrdnung trumpfOrdnung() {
        return trumpfOrdnung;
    }

    public boolean schweinchenAktiv() {
        return trumpfOrdnung instanceof SchweinchenTrumpfOrdnung;
    }

    /**
     * Prueft ob mindestens ein abgeschlossener Stich "Herz durchgegangen" ist.
     *
     * <p>Ein Stich gilt als Herz-durchgegangen, wenn alle vier gespielte Karten
     * die Farbe Herz haben und keine von ihnen Trumpf gemaess der aktuellen
     * Trumpfordnung ist. Dies loest einen Bockrunden-Trigger aus.</p>
     */
    public boolean hatHerzDurchgegangenenStich() {
        return abgeschlosseneStiche.stream().anyMatch(this::istHerzDurchgegangen);
    }

    private boolean istHerzDurchgegangen(Stich stich) {
        if (!stich.istVollstaendig()) {
            return false;
        }
        return stich.gespielteKarten().stream().allMatch(gespielteKarte ->
            gespielteKarte.karte().farbe() == Farbe.HERZ
                && !trumpfOrdnung.istTrumpf(gespielteKarte.karte())
        );
    }

    private SpielBuilder toBuilder() {
        return new SpielBuilder()
            .spielregeln(spielregeln)
            .kartendeck(kartendeck)
            .trumpfOrdnung(trumpfOrdnung)
            .spieltyp(spieltyp)
            .geber(geber)
            .phase(phase)
            .haende(haende)
            .vorbehalte(vorbehalte)
            .parteien(parteien)
            .ansagen(ansagen)
            .abgeschlosseneStiche(abgeschlosseneStiche)
            .ergebnis(ergebnis)
            .solistAufspieler(solistAufspieler);
    }

    private Map<SpielerPosition, Hand> kopiereHaende() {
        EnumMap<SpielerPosition, Hand> kopie = new EnumMap<>(SpielerPosition.class);
        kopie.putAll(haende);
        return kopie;
    }

    /**
     * Ermittelt den Vorbehalt mit der hoechsten Prioritaet aus der Vorbehaltsliste.
     *
     * <p>Tiebreaker bei gleicher Prioritaet (z.B. zwei verschiedene Soli): Die {@code vorbehalte}-Liste
     * ist in Sitzreihenfolge aufgebaut (links vom Geber beginnend, im Uhrzeigersinn). Der strikte
     * Groesser-als-Vergleich ({@code >} statt {@code >=}) stellt sicher, dass bei Gleichstand
     * der fruehste Spieler in der Sitzreihenfolge gewinnt — d.h. die erste Meldung mit dieser
     * Prioritaet bleibt unveraendert in {@code hoechsterVorbehalt} stehen.
     *
     * <p>Regelgrundlage: specs/spielablauf.md — "Bei mehreren Soli entscheidet die Sitzreihenfolge;
     * es gibt keine Rangfolge zwischen den Solo-Typen."
     *
     * @return den Vorbehalt mit hoechster Prioritaet, oder leer wenn alle Spieler gesund sind
     */
    private Optional<VorbehaltMeldung> hoechsterVorbehalt() {
        VorbehaltMeldung hoechsterVorbehalt = null;
        for (VorbehaltMeldung meldung : vorbehalte) {
            if (!meldung.istVorbehalt()) {
                continue;
            }
            // Strikter Vergleich (>): Bei gleicher Prioritaet bleibt der erste Eintrag
            // (= fruehere Sitzposition) erhalten — das ist der Sitzreihenfolge-Tiebreaker.
            if (hoechsterVorbehalt == null || meldung.ansage().prioritaet() > hoechsterVorbehalt.ansage().prioritaet()) {
                hoechsterVorbehalt = meldung;
            }
        }
        return Optional.ofNullable(hoechsterVorbehalt);
    }

    private Spieltyp spieltypFuer(VorbehaltMeldung hoechsterVorbehalt) {
        return hoechsterVorbehalt == null
            ? Spieltyp.NORMALSPIEL
            : hoechsterVorbehalt.ansage().spieltyp()
                .orElseThrow(() -> new IllegalStateException("Vorbehalt ohne Spieltyp kann nicht aufgeloest werden"));
    }

    private TrumpfOrdnung trumpfOrdnungFuer(VorbehaltMeldung hoechsterVorbehalt) {
        return hoechsterVorbehalt == null ? trumpfOrdnung : switch (hoechsterVorbehalt.ansage()) {
            case SOLO_DAME -> new DamensoloTrumpfOrdnung();
            case SOLO_BUBE -> new BubensoloTrumpfOrdnung();
            case SOLO_TRUMPF, HOCHZEIT, ARMUT -> new NormaleTrumpfOrdnung(spielregeln);
            case SOLO_TRUMPF_HERZ -> new VariableTrumpfsoloTrumpfOrdnung(Farbe.HERZ, spielregeln);
            case SOLO_TRUMPF_PIK -> new VariableTrumpfsoloTrumpfOrdnung(Farbe.PIK, spielregeln);
            case SOLO_TRUMPF_KREUZ -> new VariableTrumpfsoloTrumpfOrdnung(Farbe.KREUZ, spielregeln);
            case SOLO_FLEISCHLOS -> new FleischlosTrumpfOrdnung();
            case GESUND -> throw new IllegalStateException("GESUND ist kein aufloesbarer Vorbehalt");
        };
    }

    private Parteien parteienFuer(VorbehaltMeldung hoechsterVorbehalt) {
        return switch (hoechsterVorbehalt.ansage()) {
            case SOLO_DAME, SOLO_BUBE, SOLO_TRUMPF,
                 SOLO_TRUMPF_HERZ, SOLO_TRUMPF_PIK, SOLO_TRUMPF_KREUZ,
                 SOLO_FLEISCHLOS -> Parteien.ausSolo(hoechsterVorbehalt.spielerPosition());
            case HOCHZEIT -> Parteien.ausHochzeit(hoechsterVorbehalt.spielerPosition());
            case ARMUT -> Parteien.ausArmut(hoechsterVorbehalt.spielerPosition());
            case GESUND -> throw new IllegalStateException("GESUND ist kein aufloesbarer Vorbehalt");
        };
    }

    private int kartenProSpieler() {
        return kartendeck.karten().size() / SpielerPosition.standardReihenfolge().size();
    }

    private <T extends Spielphase> void pruefePhase(Class<T> erwartetePhase, String aktion) {
        if (!erwartetePhase.isInstance(phase)) {
            throw new IllegalStateException(aktion + " ist nur in Phase " + erwartetePhase.getSimpleName() + " erlaubt, war aber " + phase.name());
        }
    }

    private Spiel neuesSpielMitStichfortschritt(
        Map<SpielerPosition, Hand> neueHaende,
        List<Stich> neueAbgeschlosseneStiche,
        Spielphase neuePhase,
        Parteien neueParteien
    ) {
        return toBuilder()
            .phase(neuePhase)
            .haende(neueHaende)
            .parteien(neueParteien)
            .abgeschlosseneStiche(neueAbgeschlosseneStiche)
            .solistAufspieler(null)
            .build();
    }

    private HochzeitFortschritt fortschrittNachVollstaendigemStich(Stich gespielterStich, HochzeitStatus aktuellerHochzeitStatus) {
        if (aktuellerHochzeitStatus == null || !aktuellerHochzeitStatus.suchtPartner()) {
            return new HochzeitFortschritt(parteien, aktuellerHochzeitStatus);
        }
        HochzeitStatus neuerStatus = aktuellerHochzeitStatus.mitGeklaertemStich(gespielterStich.gewinner(trumpfOrdnung).spieler());
        if (neuerStatus.partner().isPresent()) {
            Parteien neueParteien = parteien
                .mitPartei(neuerStatus.partner().orElseThrow(), Partei.RE)
                .mitOffenenParteienFuerAlle(SpielerPosition.standardReihenfolge());
            return new HochzeitFortschritt(neueParteien, neuerStatus);
        }
        if (neuerStatus.stillesSolo()) {
            return new HochzeitFortschritt(Parteien.ausSolo(neuerStatus.hochzeitSpieler()), neuerStatus);
        }
        return new HochzeitFortschritt(parteien, neuerStatus);
    }

    private long anzahlTruepfe(Hand hand) {
        return hand.karten().stream().filter(trumpfOrdnung::istTrumpf).count();
    }

    private Spiel eingeworfenesSpiel() {
        Kartendeck neuesDeck = kartendeck.gemischt();
        return toBuilder()
            .kartendeck(neuesDeck)
            .trumpfOrdnung(new NormaleTrumpfOrdnung(spielregeln))
            .spieltyp(Spieltyp.NORMALSPIEL)
            .phase(Spielphase.VORBEHALT_ANSAGE)
            .haende(neuesDeck.anVierSpielerAusteilen())
            .vorbehalte(List.of())
            .parteien(null)
            .ansagen(Ansagen.leer())
            .abgeschlosseneStiche(List.of())
            .ergebnis(null)
            .solistAufspieler(null)
            .build();
    }

    /**
     * Erkennt das stille Solo durch Gesund-Meldung: Ein Spieler haelt beide Kreuz-Damen.
     * Gibt den Spieler zurueck, oder null wenn das kein stilles Solo ist.
     */
    private SpielerPosition erkenneStillesSoloSpieler() {
        for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
            Hand hand = haende.get(position);
            if (hand != null) {
                long anzahlKreuzDamen = hand.karten().stream()
                    .filter(k -> k.farbe() == Farbe.KREUZ && k.wert() == Kartenwert.DAME)
                    .count();
                if (anzahlKreuzDamen >= 2) {
                    return position;
                }
            }
        }
        return null;
    }

    private static boolean hatSchweinchen(Spielregeln spielregeln, Map<SpielerPosition, Hand> haende) {
        if (!spielregeln.schweinchenAktiv()) {
            return false;
        }
        return haende.values().stream().anyMatch(hand ->
            hand.karten().stream()
                .filter(k -> k.farbe() == Farbe.KARO && k.wert() == Kartenwert.AS)
                .count() == 2
        );
    }

    private record HochzeitFortschritt(Parteien parteien, HochzeitStatus status) {
    }

    private static TrumpfOrdnung trumpfOrdnungFuerPersistiertenStand(Spielregeln spielregeln, Spieltyp spieltyp, boolean schweinchenAktiv) {
        return switch (Objects.requireNonNull(spieltyp, "spieltyp darf nicht null sein")) {
            case NORMALSPIEL, HOCHZEIT, ARMUT, SOLO_TRUMPF -> {
                if (schweinchenAktiv) {
                    yield new SchweinchenTrumpfOrdnung(spielregeln);
                }
                yield new NormaleTrumpfOrdnung(spielregeln);
            }
            case SOLO_TRUMPF_HERZ -> new VariableTrumpfsoloTrumpfOrdnung(Farbe.HERZ, spielregeln);
            case SOLO_TRUMPF_PIK -> new VariableTrumpfsoloTrumpfOrdnung(Farbe.PIK, spielregeln);
            case SOLO_TRUMPF_KREUZ -> new VariableTrumpfsoloTrumpfOrdnung(Farbe.KREUZ, spielregeln);
            case SOLO_DAME -> new DamensoloTrumpfOrdnung();
            case SOLO_BUBE -> new BubensoloTrumpfOrdnung();
            case SOLO_FLEISCHLOS -> new FleischlosTrumpfOrdnung();
        };
    }

    private static final class SpielBuilder {
        private Spielregeln spielregeln;
        private Kartendeck kartendeck;
        private TrumpfOrdnung trumpfOrdnung;
        private Spieltyp spieltyp;
        private SpielerPosition geber;
        private Spielphase phase;
        private Map<SpielerPosition, Hand> haende;
        private List<VorbehaltMeldung> vorbehalte;
        private Parteien parteien;
        private Ansagen ansagen;
        private List<Stich> abgeschlosseneStiche;
        private Spielergebnis ergebnis;
        private SpielerPosition solistAufspieler;

        SpielBuilder spielregeln(Spielregeln spielregeln) { this.spielregeln = spielregeln; return this; }
        SpielBuilder kartendeck(Kartendeck kartendeck) { this.kartendeck = kartendeck; return this; }
        SpielBuilder trumpfOrdnung(TrumpfOrdnung trumpfOrdnung) { this.trumpfOrdnung = trumpfOrdnung; return this; }
        SpielBuilder spieltyp(Spieltyp spieltyp) { this.spieltyp = spieltyp; return this; }
        SpielBuilder geber(SpielerPosition geber) { this.geber = geber; return this; }
        SpielBuilder phase(Spielphase phase) { this.phase = phase; return this; }
        SpielBuilder haende(Map<SpielerPosition, Hand> haende) { this.haende = haende; return this; }
        SpielBuilder vorbehalte(List<VorbehaltMeldung> vorbehalte) { this.vorbehalte = vorbehalte; return this; }
        SpielBuilder parteien(Parteien parteien) { this.parteien = parteien; return this; }
        SpielBuilder ansagen(Ansagen ansagen) { this.ansagen = ansagen; return this; }
        SpielBuilder abgeschlosseneStiche(List<Stich> abgeschlosseneStiche) { this.abgeschlosseneStiche = abgeschlosseneStiche; return this; }
        SpielBuilder ergebnis(Spielergebnis ergebnis) { this.ergebnis = ergebnis; return this; }
        SpielBuilder solistAufspieler(SpielerPosition solistAufspieler) { this.solistAufspieler = solistAufspieler; return this; }

        Spiel build() {
            return new Spiel(
                spielregeln, kartendeck, trumpfOrdnung, spieltyp, geber, phase,
                haende, vorbehalte, parteien, ansagen, abgeschlosseneStiche,
                ergebnis, solistAufspieler
            );
        }
    }
}
