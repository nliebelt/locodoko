package de.locodoko.spielverwaltung.persistenz;

import de.locodoko.spiel.karten.Spielregeln;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Min;

@Embeddable
public class TischkonfigurationEmbeddable {

    @Column(nullable = false)
    private boolean ohneNeunen = false;

    @Min(1)
    @Column(nullable = false)
    private int anzahlSpiele = 24;

    @Column(nullable = false)
    private boolean hochzeitErlaubt = true;

    @Column(nullable = false)
    private boolean armutErlaubt = true;

    @Column(nullable = false)
    private boolean damensoloErlaubt = true;

    @Column(nullable = false)
    private boolean bubensoloErlaubt = true;

    @Column(nullable = false)
    private boolean fleischlosErlaubt = true;

    @Column(nullable = false)
    private boolean trumpfsoloErlaubt = true;

    @Column(nullable = false)
    private boolean zweiteDulleSticht = true;

    @Column(nullable = false)
    private boolean fuchsGefangenAktiv = true;

    @Column(nullable = false)
    private boolean karlchenAktiv = true;

    @Column(nullable = false)
    private boolean doppelkopfAktiv = true;

    @Min(1)
    @Column(nullable = false)
    private int mindestkartenReKontra = 11;

    @Min(1)
    @Column(nullable = false)
    private int mindestkartenKeine90 = 10;

    @Min(1)
    @Column(nullable = false)
    private int mindestkartenKeine60 = 9;

    @Min(1)
    @Column(nullable = false)
    private int mindestkartenKeine30 = 8;

    @Min(1)
    @Column(nullable = false)
    private int mindestkartenSchwarz = 7;

    protected TischkonfigurationEmbeddable() {
    }

    private TischkonfigurationEmbeddable(
        boolean ohneNeunen,
        int anzahlSpiele,
        boolean hochzeitErlaubt,
        boolean armutErlaubt,
        boolean damensoloErlaubt,
        boolean bubensoloErlaubt,
        boolean fleischlosErlaubt,
        boolean trumpfsoloErlaubt,
        boolean zweiteDulleSticht,
        boolean fuchsGefangenAktiv,
        boolean karlchenAktiv,
        boolean doppelkopfAktiv,
        int mindestkartenReKontra,
        int mindestkartenKeine90,
        int mindestkartenKeine60,
        int mindestkartenKeine30,
        int mindestkartenSchwarz
    ) {
        this.ohneNeunen = ohneNeunen;
        this.anzahlSpiele = anzahlSpiele;
        this.hochzeitErlaubt = hochzeitErlaubt;
        this.armutErlaubt = armutErlaubt;
        this.damensoloErlaubt = damensoloErlaubt;
        this.bubensoloErlaubt = bubensoloErlaubt;
        this.fleischlosErlaubt = fleischlosErlaubt;
        this.trumpfsoloErlaubt = trumpfsoloErlaubt;
        this.zweiteDulleSticht = zweiteDulleSticht;
        this.fuchsGefangenAktiv = fuchsGefangenAktiv;
        this.karlchenAktiv = karlchenAktiv;
        this.doppelkopfAktiv = doppelkopfAktiv;
        this.mindestkartenReKontra = mindestkartenReKontra;
        this.mindestkartenKeine90 = mindestkartenKeine90;
        this.mindestkartenKeine60 = mindestkartenKeine60;
        this.mindestkartenKeine30 = mindestkartenKeine30;
        this.mindestkartenSchwarz = mindestkartenSchwarz;
    }

    public static TischkonfigurationEmbeddable standard() {
        return ausSpielregeln(Spielregeln.standardRegeln(), 24);
    }

    public static TischkonfigurationEmbeddable ausSpielregeln(Spielregeln spielregeln, int anzahlSpiele) {
        return new TischkonfigurationEmbeddable(
            spielregeln.ohneNeunen(),
            anzahlSpiele,
            spielregeln.hochzeitAktiv(),
            spielregeln.armutAktiv(),
            spielregeln.soloDameAktiv(),
            spielregeln.soloBubeAktiv(),
            spielregeln.soloFleischlosAktiv(),
            spielregeln.soloTrumpfAktiv(),
            spielregeln.zweiteDulleSticht(),
            spielregeln.fuchsAktiv(),
            spielregeln.karlchenAktiv(),
            spielregeln.doppelkopfAktiv(),
            spielregeln.mindestkartenReKontra(),
            spielregeln.mindestkartenKeine90(),
            spielregeln.mindestkartenKeine60(),
            spielregeln.mindestkartenKeine30(),
            spielregeln.mindestkartenSchwarz()
        );
    }

    @AssertTrue(message = "Die Ansagegrenzen muessen ein gueltiges Regelwerk bilden.")
    boolean sindAnsagegrenzenGueltig() {
        try {
            alsSpielregeln();
            return true;
        } catch (IllegalArgumentException ausnahme) {
            return false;
        }
    }

    public Spielregeln alsSpielregeln() {
        return new Spielregeln(
            ohneNeunen,
            zweiteDulleSticht,
            mindestkartenReKontra,
            mindestkartenKeine90,
            mindestkartenKeine60,
            mindestkartenKeine30,
            mindestkartenSchwarz,
            fuchsGefangenAktiv,
            karlchenAktiv,
            doppelkopfAktiv,
            armutErlaubt,
            damensoloErlaubt,
            bubensoloErlaubt,
            trumpfsoloErlaubt,
            fleischlosErlaubt,
            hochzeitErlaubt
        );
    }

    public boolean ohneNeunen() {
        return ohneNeunen;
    }

    public int anzahlSpiele() {
        return anzahlSpiele;
    }

    public boolean hochzeitErlaubt() {
        return hochzeitErlaubt;
    }

    public boolean armutErlaubt() {
        return armutErlaubt;
    }

    public boolean damensoloErlaubt() {
        return damensoloErlaubt;
    }

    public boolean bubensoloErlaubt() {
        return bubensoloErlaubt;
    }

    public boolean fleischlosErlaubt() {
        return fleischlosErlaubt;
    }

    public boolean trumpfsoloErlaubt() {
        return trumpfsoloErlaubt;
    }

    public boolean zweiteDulleSticht() {
        return zweiteDulleSticht;
    }

    public boolean fuchsGefangenAktiv() {
        return fuchsGefangenAktiv;
    }

    public boolean karlchenAktiv() {
        return karlchenAktiv;
    }

    public boolean doppelkopfAktiv() {
        return doppelkopfAktiv;
    }

    public int mindestkartenReKontra() {
        return mindestkartenReKontra;
    }

    public int mindestkartenKeine90() {
        return mindestkartenKeine90;
    }

    public int mindestkartenKeine60() {
        return mindestkartenKeine60;
    }

    public int mindestkartenKeine30() {
        return mindestkartenKeine30;
    }

    public int mindestkartenSchwarz() {
        return mindestkartenSchwarz;
    }
}
