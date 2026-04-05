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
    private final Stich aktuellerStich;
    private final Spielergebnis ergebnis;
    private final HochzeitStatus hochzeitStatus;
    private final ArmutStatus armutStatus;
    private final Set<Partei> pflichtansageAusstehend;

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
        Stich aktuellerStich,
        Spielergebnis ergebnis,
        HochzeitStatus hochzeitStatus,
        ArmutStatus armutStatus,
        Set<Partei> pflichtansageAusstehend
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
        this.aktuellerStich = aktuellerStich;
        this.ergebnis = ergebnis;
        this.hochzeitStatus = hochzeitStatus;
        this.armutStatus = armutStatus;
        this.pflichtansageAusstehend = Objects.requireNonNull(pflichtansageAusstehend, "pflichtansageAusstehend darf nicht null sein").isEmpty()
            ? Set.of()
            : Set.copyOf(pflichtansageAusstehend);
    }

    public static Spiel neu(SpielerPosition geber, Spielregeln spielregeln, Kartendeck kartendeck) {
        Objects.requireNonNull(geber, "geber darf nicht null sein");
        return new Spiel(
            spielregeln,
            kartendeck,
            new NormaleTrumpfOrdnung(spielregeln),
            Spieltyp.NORMALSPIEL,
            geber,
            Spielphase.KARTEN_AUSTEILEN,
            Map.of(),
            List.of(),
            null,
            Ansagen.leer(),
            List.of(),
            null,
            null,
            null,
            null,
            Set.of()
        );
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
        Stich aktuellerStich,
        Spielergebnis ergebnis,
        HochzeitStatus hochzeitStatus,
        ArmutStatus armutStatus,
        Set<Partei> pflichtansageAusstehend
    ) {
        return new Spiel(
            spielregeln,
            kartendeck,
            trumpfOrdnungFuerPersistiertenStand(spielregeln, spieltyp),
            spieltyp,
            geber,
            phase,
            haende,
            vorbehalte,
            parteien,
            ansagen,
            abgeschlosseneStiche,
            aktuellerStich,
            ergebnis,
            hochzeitStatus,
            armutStatus,
            pflichtansageAusstehend
        );
    }

    public Spiel teileKartenAus() {
        pruefePhase(Spielphase.KARTEN_AUSTEILEN, "Karten austeilen");
        // TODO(schweinchen): Nach dem Austeilen pruefen ob ein Spieler beide Karo-Asse haelt
        //   (Farbe.KARO, Kartenwert.AS, exemplarIndex 1 und 2 auf derselben Hand).
        //   Falls ja, spielregeln.schweinchenAktiv() == true und Spieltyp ist NORMALSPIEL
        //   oder SOLO_TRUMPF: trumpfOrdnung durch SchweinchenTrumpfOrdnung ersetzen
        //   (Decorator ueber NormaleTrumpfOrdnung mit Rang 14/15 fuer Karo-Asse).
        return new Spiel(
            spielregeln,
            kartendeck,
            trumpfOrdnung,
            spieltyp,
            geber,
            Spielphase.VORBEHALT_ANSAGE,
            kartendeck.anVierSpielerAusteilen(),
            List.of(),
            null,
            ansagen,
            abgeschlosseneStiche,
            null,
            null,
            null,
            null,
            Set.of()
        );
    }

    public Optional<SpielerPosition> naechsterVorbehaltSpieler() {
        if (phase != Spielphase.VORBEHALT_ANSAGE || vorbehalte.size() >= SpielerPosition.standardReihenfolge().size()) {
            return Optional.empty();
        }
        List<SpielerPosition> reihenfolge = SpielerPosition.imUhrzeigersinnAb(geber.naechsteImUhrzeigersinn());
        return Optional.of(reihenfolge.get(vorbehalte.size()));
    }

    public Spiel meldeGesund(SpielerPosition spielerPosition) {
        return meldeVorbehalt(spielerPosition, VorbehaltAnsage.GESUND);
    }

    public Spiel meldeVorbehalt(SpielerPosition spielerPosition, VorbehaltAnsage vorbehaltAnsage) {
        pruefePhase(Spielphase.VORBEHALT_ANSAGE, "Gesund melden");
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
        return new Spiel(
            spielregeln,
            kartendeck,
            trumpfOrdnung,
            spieltyp,
            geber,
            naechstePhase,
            haende,
            neueVorbehalte,
            parteien,
            ansagen,
            abgeschlosseneStiche,
            aktuellerStich,
            ergebnis,
            hochzeitStatus,
            armutStatus,
            Set.of()
        );
    }

    public Spiel loeseVorbehalteAuf() {
        pruefePhase(Spielphase.VORBEHALT_AUFLOESUNG, "Vorbehalte aufloesen");
        VorbehaltMeldung hoechsterVorbehalt = hoechsterVorbehalt().orElse(null);

        // Stilles Solo durch Gesund-Meldung: Ein Spieler besitzt beide Kreuz-Damen ohne Vorbehalt.
        // ausNormalspielHaenden wuerde eine IllegalStateException werfen, da nur 1 RE-Spieler
        // gefunden wird. Stattdessen wird das Spiel als Trumpfsolo fuer diesen Spieler gestartet.
        if (hoechsterVorbehalt == null) {
            SpielerPosition stillesSoloSpieler = erkenneStillesSoloSpieler();
            if (stillesSoloSpieler != null) {
                return new Spiel(
                    spielregeln, kartendeck, new NormaleTrumpfOrdnung(spielregeln),
                    Spieltyp.SOLO_TRUMPF, geber, Spielphase.STICHPHASE,
                    haende, vorbehalte, Parteien.ausSolo(stillesSoloSpieler),
                    Ansagen.leer(), List.of(),
                    Stich.neu(geber.naechsteImUhrzeigersinn()), null, null, null,
                    Set.of()
                );
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
        Spielphase naechstePhase = neuerArmutStatus == null ? Spielphase.STICHPHASE : Spielphase.ARMUT_TAUSCH;
        Stich ersterStich = naechstePhase == Spielphase.STICHPHASE ? Stich.neu(geber.naechsteImUhrzeigersinn()) : null;
        return new Spiel(
            spielregeln,
            kartendeck,
            trumpfOrdnungFuer(hoechsterVorbehalt),
            spieltypFuer(hoechsterVorbehalt),
            geber,
            naechstePhase,
            haende,
            vorbehalte,
            neueParteien,
            Ansagen.leer(),
            List.of(),
            ersterStich,
            null,
            neuerHochzeitStatus,
            neuerArmutStatus,
            Set.of()
        );
    }

    public Spiel legeArmutTrumpfkarten(SpielerPosition spielerPosition, List<Karte> angeboteneTrumpfkarten) {
        pruefePhase(Spielphase.ARMUT_TAUSCH, "Armut-Karten anbieten");
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        Objects.requireNonNull(angeboteneTrumpfkarten, "angeboteneTrumpfkarten duerfen nicht null sein");
        ArmutStatus status = armutStatus()
            .orElseThrow(() -> new IllegalStateException("Es gibt keinen aktiven Armut-Status"));
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
        return new Spiel(
            spielregeln,
            kartendeck,
            trumpfOrdnung,
            spieltyp,
            geber,
            phase,
            neueHaende,
            vorbehalte,
            parteien,
            ansagen,
            abgeschlosseneStiche,
            aktuellerStich,
            ergebnis,
            hochzeitStatus,
            status.mitAngebot(angeboteneTrumpfkarten),
            pflichtansageAusstehend
        );
    }

    public Spiel lehneArmutAb(SpielerPosition spielerPosition) {
        pruefePhase(Spielphase.ARMUT_TAUSCH, "Armut ablehnen");
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        ArmutStatus status = armutStatus()
            .orElseThrow(() -> new IllegalStateException("Es gibt keinen aktiven Armut-Status"));
        if (!status.angebotLiegtVor()) {
            throw new IllegalStateException("Die Armut kann erst nach dem Trumpf-Angebot abgelehnt werden");
        }
        ArmutStatus neuerStatus = status.mitAblehnung(spielerPosition);
        if (neuerStatus.alleAntwortenErschoepft()) {
            return eingeworfenesSpiel();
        }
        return new Spiel(
            spielregeln,
            kartendeck,
            trumpfOrdnung,
            spieltyp,
            geber,
            phase,
            haende,
            vorbehalte,
            parteien,
            ansagen,
            abgeschlosseneStiche,
            aktuellerStich,
            ergebnis,
            hochzeitStatus,
            neuerStatus,
            pflichtansageAusstehend
        );
    }

    public Spiel nimmArmutAn(SpielerPosition spielerPosition, List<Karte> rueckgabekarten) {
        pruefePhase(Spielphase.ARMUT_TAUSCH, "Armut annehmen");
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        Objects.requireNonNull(rueckgabekarten, "rueckgabekarten duerfen nicht null sein");
        ArmutStatus status = armutStatus()
            .orElseThrow(() -> new IllegalStateException("Es gibt keinen aktiven Armut-Status"));
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
        return new Spiel(
            spielregeln,
            kartendeck,
            trumpfOrdnung,
            spieltyp,
            geber,
            Spielphase.STICHPHASE,
            neueHaende,
            vorbehalte,
            neueParteien,
            Ansagen.leer(),
            List.of(),
            Stich.neu(geber.naechsteImUhrzeigersinn()),
            null,
            hochzeitStatus,
            status.mitPartner(spielerPosition),
            Set.of()
        );
    }

    public Optional<SpielerPosition> aktuellerSpieler() {
        if (phase != Spielphase.STICHPHASE || aktuellerStich == null) {
            return Optional.empty();
        }
        return Optional.of(aktuellerStich.erwarteterSpieler());
    }

    public Optional<SpielerPosition> erwarteterSpieler() {
        return switch (phase) {
            case VORBEHALT_ANSAGE -> naechsterVorbehaltSpieler();
            case ARMUT_TAUSCH -> armutStatus()
                .map(status -> status.angebotLiegtVor()
                    ? status.aktuellerAntwortspieler().orElse(null)
                    : status.armutSpieler());
            case STICHPHASE -> aktuellerSpieler();
            default -> Optional.empty();
        };
    }

    public List<Karte> gueltigeKartenFuer(SpielerPosition spielerPosition) {
        pruefePhase(Spielphase.STICHPHASE, "gueltige Karten abfragen");
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        SpielerPosition erwarteterSpieler = aktuellerSpieler()
            .orElseThrow(() -> new IllegalStateException("Es gibt aktuell keinen erwarteten Spieler"));
        if (spielerPosition != erwarteterSpieler) {
            throw new IllegalStateException("Gueltige Karten koennen nur fuer den aktuellen Spieler abgefragt werden; erwartet: " + erwarteterSpieler);
        }
        return aktuellerStich.gueltigeKarten(handVon(spielerPosition), trumpfOrdnung);
    }

    public Spiel spieleKarte(SpielerPosition spielerPosition, Karte karte) {
        pruefePhase(Spielphase.STICHPHASE, "Karte spielen");
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        Objects.requireNonNull(karte, "karte darf nicht null sein");

        if (!pflichtansageAusstehend.isEmpty()) {
            throw new IllegalStateException(
                "Karte spielen ist erst erlaubt wenn alle ausstehenden Pflichtansagen gemacht wurden: " + pflichtansageAusstehend
            );
        }

        Hand hand = handVon(spielerPosition);
        Stich gespielterStich = aktuellerStich.spieleKarte(spielerPosition, karte, hand, trumpfOrdnung);
        Map<SpielerPosition, Hand> neueHaende = kopiereHaende();
        neueHaende.put(spielerPosition, hand.ohne(karte));

        if (!gespielterStich.istVollstaendig()) {
            return neuesSpielMitStichfortschritt(neueHaende, abgeschlosseneStiche, gespielterStich, phase, parteien, hochzeitStatus, pflichtansageAusstehend);
        }

        List<Stich> neueAbgeschlosseneStiche = new ArrayList<>(abgeschlosseneStiche);
        neueAbgeschlosseneStiche.add(gespielterStich);

        Set<Partei> neuesPflichtansageAusstehend = berechneNeuePflichtansagen(gespielterStich, neueAbgeschlosseneStiche.size());

        HochzeitFortschritt hochzeitFortschritt = fortschrittNachVollstaendigemStich(gespielterStich);
        if (neueAbgeschlosseneStiche.size() == kartenProSpieler()) {
            return neuesSpielMitStichfortschritt(
                neueHaende,
                neueAbgeschlosseneStiche,
                null,
                Spielphase.AUSWERTUNG,
                hochzeitFortschritt.parteien(),
                hochzeitFortschritt.status(),
                Set.of()
            );
        }

        Stich naechsterStich = Stich.neu(gespielterStich.naechsterAufspieler(trumpfOrdnung));
        return neuesSpielMitStichfortschritt(
            neueHaende,
            neueAbgeschlosseneStiche,
            naechsterStich,
            Spielphase.STICHPHASE,
            hochzeitFortschritt.parteien(),
            hochzeitFortschritt.status(),
            neuesPflichtansageAusstehend
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
        if (abgeschlossenerStich.augen() <= 30) {
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
        if (phase != Spielphase.STICHPHASE || aktuellerStich == null || spielerPosition != aktuellerStich.erwarteterSpieler()) {
            return false;
        }
        if (hochzeitStatus != null && hochzeitStatus.suchtPartner() && spielerPosition != hochzeitStatus.hochzeitSpieler()) {
            return false;
        }
        // Pflichtansage: Mindestkartenanzahl wird ignoriert
        Partei partei = parteien().parteiVon(spielerPosition);
        boolean istPflichtansage = !pflichtansageAusstehend.isEmpty()
            && pflichtansageAusstehend.contains(partei)
            && ansage.istGrundansage();
        int effektiveKartenAnzahl = istPflichtansage ? Integer.MAX_VALUE : handVon(spielerPosition).karten().size();
        return ansagen.kannAnsagen(spielerPosition, ansage, parteien(), spielregeln, effektiveKartenAnzahl);
    }

    public Spiel sageAn(SpielerPosition spielerPosition, Ansage ansage) {
        pruefePhase(Spielphase.STICHPHASE, "Ansage taetigen");
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        Objects.requireNonNull(ansage, "ansage darf nicht null sein");
        SpielerPosition erwarteterSpieler = aktuellerSpieler()
            .orElseThrow(() -> new IllegalStateException("Es gibt aktuell keinen erwarteten Spieler"));
        if (spielerPosition != erwarteterSpieler) {
            throw new IllegalStateException("Ansagen duerfen nur vom aktuellen Spieler kommen; erwartet: " + erwarteterSpieler);
        }
        if (hochzeitStatus != null && hochzeitStatus.suchtPartner() && spielerPosition != hochzeitStatus.hochzeitSpieler()) {
            throw new IllegalStateException("Vor der Klaerung der Hochzeit darf nur der Hochzeits-Spieler Ansagen taetigen");
        }
        // Pflichtansage: Mindestkartenanzahl wird ignoriert (gleiches Prinzip wie in kannAnsagen)
        Partei ansagenPartei = parteien().parteiVon(spielerPosition);
        boolean istPflichtansage = !pflichtansageAusstehend.isEmpty()
            && pflichtansageAusstehend.contains(ansagenPartei)
            && ansage.istGrundansage();
        int effektiveKartenAnzahlFuerAnsage = istPflichtansage ? Integer.MAX_VALUE : handVon(spielerPosition).karten().size();
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
        Set<Partei> aktualisiertesPflichtansageAusstehend = pflichtansageAusstehend;
        if (ansage.istGrundansage() && !pflichtansageAusstehend.isEmpty()) {
            Partei partei = parteien.parteiVon(spielerPosition);
            if (pflichtansageAusstehend.contains(partei)) {
                EnumSet<Partei> neuesMenge = EnumSet.copyOf(pflichtansageAusstehend);
                neuesMenge.remove(partei);
                aktualisiertesPflichtansageAusstehend = neuesMenge.isEmpty() ? Set.of() : Set.copyOf(neuesMenge);
            }
        }
        return new Spiel(
            spielregeln,
            kartendeck,
            trumpfOrdnung,
            spieltyp,
            geber,
            phase,
            haende,
            vorbehalte,
            aktualisierteParteien,
            neueAnsagen,
            abgeschlosseneStiche,
            aktuellerStich,
            ergebnis,
            hochzeitStatus,
            armutStatus,
            aktualisiertesPflichtansageAusstehend
        );
    }

    public Spiel werteAus(PunkteRechner punkteRechner) {
        pruefePhase(Spielphase.AUSWERTUNG, "Spiel auswerten");
        Objects.requireNonNull(punkteRechner, "punkteRechner darf nicht null sein");
        Spielergebnis neuesErgebnis = punkteRechner.berechneNormalspielErgebnis(
            abgeschlosseneStiche,
            parteien(),
            trumpfOrdnung,
            ansagen,
            spielregeln
        );
        return new Spiel(
            spielregeln,
            kartendeck,
            trumpfOrdnung,
            spieltyp,
            geber,
            Spielphase.GESAMTSTAND_AKTUALISIEREN,
            haende,
            vorbehalte,
            parteien,
            ansagen,
            abgeschlosseneStiche,
            null,
            neuesErgebnis,
            hochzeitStatus,
            armutStatus,
            Set.of()
        );
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
        return Optional.ofNullable(aktuellerStich);
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
        return Optional.ofNullable(hochzeitStatus);
    }

    public Optional<ArmutStatus> armutStatus() {
        return Optional.ofNullable(armutStatus);
    }

    public Set<Partei> pflichtansageAusstehend() {
        return pflichtansageAusstehend;
    }

    public TrumpfOrdnung trumpfOrdnung() {
        return trumpfOrdnung;
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

    private void pruefePhase(Spielphase erwartetePhase, String aktion) {
        if (phase != erwartetePhase) {
            throw new IllegalStateException(aktion + " ist nur in Phase " + erwartetePhase + " erlaubt, war aber " + phase);
        }
    }

    private Spiel neuesSpielMitStichfortschritt(
        Map<SpielerPosition, Hand> neueHaende,
        List<Stich> neueAbgeschlosseneStiche,
        Stich neuerAktuellerStich,
        Spielphase neuePhase,
        Parteien neueParteien,
        HochzeitStatus neuerHochzeitStatus,
        Set<Partei> neuesPflichtansageAusstehend
    ) {
        return new Spiel(
            spielregeln,
            kartendeck,
            trumpfOrdnung,
            spieltyp,
            geber,
            neuePhase,
            neueHaende,
            vorbehalte,
            neueParteien,
            ansagen,
            neueAbgeschlosseneStiche,
            neuerAktuellerStich,
            ergebnis,
            neuerHochzeitStatus,
            armutStatus,
            neuesPflichtansageAusstehend
        );
    }

    private HochzeitFortschritt fortschrittNachVollstaendigemStich(Stich gespielterStich) {
        if (hochzeitStatus == null || !hochzeitStatus.suchtPartner()) {
            return new HochzeitFortschritt(parteien, hochzeitStatus);
        }
        HochzeitStatus neuerStatus = hochzeitStatus.mitGeklaertemStich(gespielterStich.gewinner(trumpfOrdnung).spieler());
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
        return new Spiel(
            spielregeln,
            neuesDeck,
            new NormaleTrumpfOrdnung(spielregeln),
            Spieltyp.NORMALSPIEL,
            geber,
            Spielphase.VORBEHALT_ANSAGE,
            neuesDeck.anVierSpielerAusteilen(),
            List.of(),
            null,
            Ansagen.leer(),
            List.of(),
            null,
            null,
            null,
            null,
            Set.of()
        );
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

    private record HochzeitFortschritt(Parteien parteien, HochzeitStatus status) {
    }

    private static TrumpfOrdnung trumpfOrdnungFuerPersistiertenStand(Spielregeln spielregeln, Spieltyp spieltyp) {
        return switch (Objects.requireNonNull(spieltyp, "spieltyp darf nicht null sein")) {
            case NORMALSPIEL, HOCHZEIT, ARMUT, SOLO_TRUMPF -> new NormaleTrumpfOrdnung(spielregeln);
            case SOLO_TRUMPF_HERZ -> new VariableTrumpfsoloTrumpfOrdnung(Farbe.HERZ, spielregeln);
            case SOLO_TRUMPF_PIK -> new VariableTrumpfsoloTrumpfOrdnung(Farbe.PIK, spielregeln);
            case SOLO_TRUMPF_KREUZ -> new VariableTrumpfsoloTrumpfOrdnung(Farbe.KREUZ, spielregeln);
            case SOLO_DAME -> new DamensoloTrumpfOrdnung();
            case SOLO_BUBE -> new BubensoloTrumpfOrdnung();
            case SOLO_FLEISCHLOS -> new FleischlosTrumpfOrdnung();
        };
    }
}
