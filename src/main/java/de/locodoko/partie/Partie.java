package de.locodoko.partie;

import de.locodoko.karten.Kartendeck;
import de.locodoko.karten.Spielregeln;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/**
 * Eine Partie Doppelkopf — eine geordnete Folge von Einzelspielen.
 *
 * <p>Eine Partie besteht aus einer festen Anzahl von {@link Spiel}-Instanzen. Sie verwaltet
 * die Geberrotation (jeder Spieler gibt einmal pro Runde), den kumulierten Gesamtpunktestand
 * aller Spieler sowie die gemeinsamen {@link Spielregeln}. Jedes abgeschlossene Spiel wird
 * in der Historienliste archiviert; das laufende Spiel ist separat zugreifbar.</p>
 *
 * <p>Aggregate Root des {@code partie}-Bounded-Context. Unveraenderlich: jede Mutation
 * (neues Spiel starten, Spiel abschliessen) liefert eine neue Instanz.</p>
 */
public final class Partie {

    private final int anzahlSpiele;
    private final Spielregeln spielregeln;
    private final SpielerPosition naechsterGeber;
    private final List<Spiel> abgeschlosseneSpiele;
    private final Spiel aktuellesSpiel;
    private final Map<SpielerPosition, Integer> gesamtpunktestand;
    private final int bockrundenZaehler;
    private final SpielerPosition solistDesLetztenSpiels;

    private Partie(
        int anzahlSpiele,
        Spielregeln spielregeln,
        SpielerPosition naechsterGeber,
        List<Spiel> abgeschlosseneSpiele,
        Spiel aktuellesSpiel,
        Map<SpielerPosition, Integer> gesamtpunktestand,
        int bockrundenZaehler,
        SpielerPosition solistDesLetztenSpiels
    ) {
        if (anzahlSpiele < 1) {
            throw new IllegalArgumentException("Eine Partie muss mindestens ein Spiel enthalten");
        }
        this.anzahlSpiele = anzahlSpiele;
        this.spielregeln = Objects.requireNonNull(spielregeln, "spielregeln duerfen nicht null sein");
        this.naechsterGeber = Objects.requireNonNull(naechsterGeber, "naechsterGeber darf nicht null sein");
        this.abgeschlosseneSpiele = List.copyOf(abgeschlosseneSpiele);
        this.aktuellesSpiel = aktuellesSpiel;
        this.gesamtpunktestand = Map.copyOf(gesamtpunktestand);
        if (bockrundenZaehler < 0) {
            throw new IllegalArgumentException("bockrundenZaehler darf nicht negativ sein");
        }
        this.bockrundenZaehler = bockrundenZaehler;
        this.solistDesLetztenSpiels = solistDesLetztenSpiels;
    }

    public static Partie ausPersistiertemStand(
        int anzahlSpiele,
        Spielregeln spielregeln,
        SpielerPosition naechsterGeber,
        List<Spiel> abgeschlosseneSpiele,
        Spiel aktuellesSpiel,
        Map<SpielerPosition, Integer> gesamtpunktestand,
        int bockrundenZaehler,
        SpielerPosition solistDesLetztenSpiels
    ) {
        return new Partie(anzahlSpiele, spielregeln, naechsterGeber, abgeschlosseneSpiele, aktuellesSpiel, gesamtpunktestand, bockrundenZaehler, solistDesLetztenSpiels);
    }

    public static Partie neu(int anzahlSpiele, SpielerPosition ersterGeber, Spielregeln spielregeln) {
        EnumMap<SpielerPosition, Integer> gesamtpunktestand = new EnumMap<>(SpielerPosition.class);
        for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
            gesamtpunktestand.put(position, 0);
        }
        return new Partie(anzahlSpiele, spielregeln, ersterGeber, List.of(), null, gesamtpunktestand, 0, null);
    }

    public Partie starteNaechstesSpiel(Kartendeck kartendeck) {
        Objects.requireNonNull(kartendeck, "kartendeck darf nicht null sein");
        if (istBeendet()) {
            throw new IllegalStateException("Die Partie ist bereits beendet");
        }
        if (aktuellesSpiel != null) {
            throw new IllegalStateException("Es laeuft bereits ein Spiel");
        }
        Spiel neuesSpiel = solistDesLetztenSpiels != null
            ? Spiel.neuMitSolistAufspieler(naechsterGeber, solistDesLetztenSpiels, spielregeln, kartendeck)
            : Spiel.neu(naechsterGeber, spielregeln, kartendeck);
        return new Partie(
            anzahlSpiele,
            spielregeln,
            naechsterGeber,
            abgeschlosseneSpiele,
            neuesSpiel,
            gesamtpunktestand,
            bockrundenZaehler,
            null
        );
    }

    public Partie mitAktuellemSpiel(Spiel spiel) {
        Objects.requireNonNull(spiel, "spiel darf nicht null sein");
        if (aktuellesSpiel == null) {
            throw new IllegalStateException("Es gibt kein aktuelles Spiel");
        }
        return new Partie(anzahlSpiele, spielregeln, naechsterGeber, abgeschlosseneSpiele, spiel, gesamtpunktestand, bockrundenZaehler, solistDesLetztenSpiels);
    }

    public Partie schliesseAktuellesSpielAb() {
        Spiel spiel = aktuellesSpiel();
        if (!(spiel.phase() instanceof Spielphase.GesamtstandAktualisieren)) {
            throw new IllegalStateException("Nur vollstaendig ausgewertete Spiele duerfen abgeschlossen werden");
        }
        Spielergebnis ergebnis = spiel.ergebnis()
            .orElseThrow(() -> new IllegalStateException("Ein abgeschlossenes Spiel braucht ein Ergebnis"));

        // Bockrunden: Neue Trigger aus abgeschlossenem Spiel erkennen
        int neueTrigger = 0;
        if (spielregeln.bockrundenAktiv()) {
            if (spiel.hatHerzDurchgegangenenStich()) {
                neueTrigger++;
            }
            if (ergebnis.siegerPartei() == Partei.RE
                    && spiel.ansagen().hatGrundansage(Partei.KONTRA, spiel.parteien())) {
                neueTrigger++;
            }
        }

        // Spielpunkte akkumulieren — mit Bockrunden-Multiplikator falls aktiv
        int multiplikator = (spielregeln.bockrundenAktiv() && bockrundenZaehler > 0) ? 2 : 1;
        Map<SpielerPosition, Integer> neuerGesamtpunktestand = new EnumMap<>(SpielerPosition.class);
        neuerGesamtpunktestand.putAll(gesamtpunktestand);
        for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
            neuerGesamtpunktestand.merge(position, ergebnis.spielpunkteVon(position).wert() * multiplikator, Integer::sum);
        }

        // Bockrunden-Zaehler aktualisieren: alten Eintrag verbrauchen, neue Trigger ergaenzen
        int neuerBockrundenZaehler = (bockrundenZaehler > 0 ? bockrundenZaehler - 1 : 0) + neueTrigger;
        List<Spiel> neueAbgeschlosseneSpiele = new ArrayList<>(abgeschlosseneSpiele);
        neueAbgeschlosseneSpiele.add(spiel);

        // Solo-Nachgeben: nach einem Solo bleibt der Geber gleich und der Solist erhaelt das Anspielrecht
        boolean warSolo = spiel.parteien() != null && spiel.parteien().spielerVon(Partei.RE).size() == 1;
        SpielerPosition neuerGeber = warSolo ? spiel.geber() : spiel.geber().naechsteImUhrzeigersinn();
        SpielerPosition neuerSolist = warSolo ? spiel.parteien().spielerVon(Partei.RE).get(0) : null;
        return new Partie(
            anzahlSpiele,
            spielregeln,
            neuerGeber,
            neueAbgeschlosseneSpiele,
            null,
            neuerGesamtpunktestand,
            neuerBockrundenZaehler,
            neuerSolist
        );
    }

    /**
     * Kombinierte Methode: wertet das aktuelle Spiel aus (falls noetig), schliesst es ab
     * und startet das naechste Spiel — oder markiert die Partie als beendet.
     *
     * <p>Kapselt den vollstaendigen Game-Loop: AUSWERTUNG → Punkteberechnung →
     * Bockrunden-/Solo-Logik → naechstes Spiel starten. Darf in Phase
     * {@link Spielphase#AUSWERTUNG} oder {@link Spielphase#GESAMTSTAND_AKTUALISIEREN}
     * aufgerufen werden.</p>
     */
    public Partie schliesseAktuellesSpielAbUndStarteNaechstes() {
        Spiel spiel = aktuellesSpiel();
        // Auswertung falls noch nicht geschehen
        Partie partieNachAuswertung = spiel.phase() instanceof Spielphase.Auswertung
            ? mitAktuellemSpiel(spiel.werteAus())
            : this;
        // Spiel abschliessen — Bockrunden, Solo-Nachgeben, Gesamtpunktestand
        Partie abgeschlossenePartie = partieNachAuswertung.schliesseAktuellesSpielAb();
        if (abgeschlossenePartie.istBeendet()) {
            return abgeschlossenePartie;
        }
        // Naechstes Spiel mit gemischtem Deck starten und Karten austeilen
        Kartendeck kartendeck = Kartendeck.neu(abgeschlossenePartie.spielregeln()).gemischt();
        Partie partieNaechstesSpiel = abgeschlossenePartie.starteNaechstesSpiel(kartendeck);
        return partieNaechstesSpiel.mitAktuellemSpiel(partieNaechstesSpiel.aktuellesSpiel().teileKartenAus());
    }

    public boolean istBeendet() {
        return abgeschlosseneSpiele.size() >= anzahlSpiele;
    }

    public int anzahlSpiele() {
        return anzahlSpiele;
    }

    public Spielregeln spielregeln() {
        return spielregeln;
    }

    public SpielerPosition naechsterGeber() {
        return naechsterGeber;
    }

    public List<Spiel> abgeschlosseneSpiele() {
        return abgeschlosseneSpiele;
    }

    public Optional<Spiel> aktuellesSpielOptional() {
        return Optional.ofNullable(aktuellesSpiel);
    }

    public Spiel aktuellesSpiel() {
        return Optional.ofNullable(aktuellesSpiel)
            .orElseThrow(() -> new IllegalStateException("Es gibt aktuell kein laufendes Spiel"));
    }

    public Map<SpielerPosition, Integer> gesamtpunktestand() {
        return gesamtpunktestand;
    }

    public int bockrundenZaehler() {
        return bockrundenZaehler;
    }

    public Optional<SpielerPosition> solistDesLetztenSpiels() {
        return Optional.ofNullable(solistDesLetztenSpiels);
    }
}
