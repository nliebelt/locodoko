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

    private Partie(
        int anzahlSpiele,
        Spielregeln spielregeln,
        SpielerPosition naechsterGeber,
        List<Spiel> abgeschlosseneSpiele,
        Spiel aktuellesSpiel,
        Map<SpielerPosition, Integer> gesamtpunktestand
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
    }

    public static Partie neu(int anzahlSpiele, SpielerPosition ersterGeber, Spielregeln spielregeln) {
        EnumMap<SpielerPosition, Integer> gesamtpunktestand = new EnumMap<>(SpielerPosition.class);
        for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
            gesamtpunktestand.put(position, 0);
        }
        return new Partie(anzahlSpiele, spielregeln, ersterGeber, List.of(), null, gesamtpunktestand);
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
            gesamtpunktestand
        );
    }

    public Partie mitAktuellemSpiel(Spiel spiel) {
        Objects.requireNonNull(spiel, "spiel darf nicht null sein");
        if (aktuellesSpiel == null) {
            throw new IllegalStateException("Es gibt kein aktuelles Spiel");
        }
        return new Partie(anzahlSpiele, spielregeln, naechsterGeber, abgeschlosseneSpiele, spiel, gesamtpunktestand);
    }

    public Partie schliesseAktuellesSpielAb() {
        Spiel spiel = aktuellesSpiel();
        if (spiel.phase() != Spielphase.GESAMTSTAND_AKTUALISIEREN) {
            throw new IllegalStateException("Nur vollstaendig ausgewertete Spiele duerfen abgeschlossen werden");
        }
        Spielergebnis ergebnis = spiel.ergebnis()
            .orElseThrow(() -> new IllegalStateException("Ein abgeschlossenes Spiel braucht ein Ergebnis"));

        Map<SpielerPosition, Integer> neuerGesamtpunktestand = new EnumMap<>(SpielerPosition.class);
        neuerGesamtpunktestand.putAll(gesamtpunktestand);
        for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
            neuerGesamtpunktestand.merge(position, ergebnis.spielpunkteVon(position), Integer::sum);
        }
        List<Spiel> neueAbgeschlosseneSpiele = new ArrayList<>(abgeschlosseneSpiele);
        neueAbgeschlosseneSpiele.add(spiel);
        return new Partie(
            anzahlSpiele,
            spielregeln,
            spiel.geber().naechsteImUhrzeigersinn(),
            neueAbgeschlosseneSpiele,
            null,
            neuerGesamtpunktestand
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
}
