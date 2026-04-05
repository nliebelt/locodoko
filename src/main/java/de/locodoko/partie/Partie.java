package de.locodoko.partie;

import de.locodoko.karten.Kartendeck;
import de.locodoko.karten.SpielerPosition;
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

    private Partie(
        int anzahlSpiele,
        Spielregeln spielregeln,
        SpielerPosition naechsterGeber,
        List<Spiel> abgeschlosseneSpiele,
        Spiel aktuellesSpiel,
        Map<SpielerPosition, Integer> gesamtpunktestand,
        int bockrundenZaehler
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
    }

    public static Partie neu(int anzahlSpiele, SpielerPosition ersterGeber, Spielregeln spielregeln) {
        EnumMap<SpielerPosition, Integer> gesamtpunktestand = new EnumMap<>(SpielerPosition.class);
        for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
            gesamtpunktestand.put(position, 0);
        }
        return new Partie(anzahlSpiele, spielregeln, ersterGeber, List.of(), null, gesamtpunktestand, 0);
    }

    public Partie starteNaechstesSpiel(Kartendeck kartendeck) {
        Objects.requireNonNull(kartendeck, "kartendeck darf nicht null sein");
        if (istBeendet()) {
            throw new IllegalStateException("Die Partie ist bereits beendet");
        }
        if (aktuellesSpiel != null) {
            throw new IllegalStateException("Es laeuft bereits ein Spiel");
        }
        return new Partie(
            anzahlSpiele,
            spielregeln,
            naechsterGeber,
            abgeschlosseneSpiele,
            Spiel.neu(naechsterGeber, spielregeln, kartendeck),
            gesamtpunktestand,
            bockrundenZaehler
        );
    }

    public Partie mitAktuellemSpiel(Spiel spiel) {
        Objects.requireNonNull(spiel, "spiel darf nicht null sein");
        if (aktuellesSpiel == null) {
            throw new IllegalStateException("Es gibt kein aktuelles Spiel");
        }
        return new Partie(anzahlSpiele, spielregeln, naechsterGeber, abgeschlosseneSpiele, spiel, gesamtpunktestand, bockrundenZaehler);
    }

    public Partie schliesseAktuellesSpielAb() {
        Spiel spiel = aktuellesSpiel();
        if (spiel.phase() != Spielphase.GESAMTSTAND_AKTUALISIEREN) {
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
            neuerGesamtpunktestand.merge(position, ergebnis.spielpunkteVon(position) * multiplikator, Integer::sum);
        }

        // Bockrunden-Zaehler aktualisieren: alten Eintrag verbrauchen, neue Trigger ergaenzen
        int neuerBockrundenZaehler = (bockrundenZaehler > 0 ? bockrundenZaehler - 1 : 0) + neueTrigger;
        List<Spiel> neueAbgeschlosseneSpiele = new ArrayList<>(abgeschlosseneSpiele);
        neueAbgeschlosseneSpiele.add(spiel);

        // TODO(solo-nachgeben): Wenn das Spiel ein Solo war (spiel.parteien().spielerVon(RE).size() == 1),
        //   naechsterGeber = spiel.geber() statt spiel.geber().naechsteImUhrzeigersinn().
        //   Ausserdem muss der Solist im naechsten Spiel das Anspielrecht erhalten —
        //   Partie muss dazu den Solisten merken (zusaetzliches Feld) und in
        //   starteNaechstesSpiel() an Spiel.neu() weitergeben.
        return new Partie(
            anzahlSpiele,
            spielregeln,
            spiel.geber().naechsteImUhrzeigersinn(),
            neueAbgeschlosseneSpiele,
            null,
            neuerGesamtpunktestand,
            neuerBockrundenZaehler
        );
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
}
