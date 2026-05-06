package de.locodoko.tisch;

import de.locodoko.karten.Spielregeln;
import de.locodoko.ki.KiSchwierigkeit;
import de.locodoko.tisch.Tischhintergrund;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Min;

/**
 * Eingebettete Tischkonfiguration.
 * Die Felder werden direkt als Spalten in der 'tisch'-Tabelle gespeichert.
 * Spring Data JDBC unterstuetzt @Embedded nativ ueber das @Embedded-Paket,
 * hier wird die Konfiguration direkt als Felder in TischEntity eingebettet.
 * Kein JPA mehr — alle Persistenz-Annotationen entfernt.
 */
public class TischkonfigurationEmbeddable {

    @Min(1)
    private int anzahlSpiele = 24;

    private boolean ohneNeunen = false;

    private Tischhintergrund tischhintergrund = Tischhintergrund.OVAL_2;

    private boolean hochzeitErlaubt = true;
    private boolean armutErlaubt = true;
    private boolean damensoloErlaubt = true;
    private boolean bubensoloErlaubt = true;
    private boolean fleischlosErlaubt = true;
    private boolean trumpfsoloErlaubt = true;
    private boolean zweiteDulleSticht = true;
    private boolean fuchsGefangenAktiv = true;
    private boolean karlchenAktiv = true;
    private boolean doppelkopfAktiv = true;

    @Min(1)
    private int mindestkartenReKontra = 11;

    @Min(1)
    private int mindestkartenKeine90 = 10;

    @Min(1)
    private int mindestkartenKeine60 = 9;

    @Min(1)
    private int mindestkartenKeine30 = 8;

    @Min(1)
    private int mindestkartenSchwarz = 7;

    private boolean bockrundenAktiv = false;
    private boolean schweinchenAktiv = false;
    private boolean dreissigAugenPflichtAktiv = false;

    private boolean schmeissenAktiv = false;

    /** Herz-durchgegangen-Bockrunde nur bei reinen Herz-As-Stichen ausloesen (striktere Variante). */
    private boolean herzDurchgegangenNurHoch = false;

    /** Schwierigkeitsstufe der KI-Gegner. Standard ist STANDARD. */
    private KiSchwierigkeit kiSchwierigkeit = KiSchwierigkeit.STANDARD;

    protected TischkonfigurationEmbeddable() {
    }

    private TischkonfigurationEmbeddable(
        boolean ohneNeunen,
        int anzahlSpiele,
        Tischhintergrund tischhintergrund,
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
        int mindestkartenSchwarz,
        boolean bockrundenAktiv,
        boolean schweinchenAktiv,
        boolean dreissigAugenPflichtAktiv,
        boolean schmeissenAktiv,
        boolean herzDurchgegangenNurHoch,
        KiSchwierigkeit kiSchwierigkeit
    ) {
        this.ohneNeunen = ohneNeunen;
        this.anzahlSpiele = anzahlSpiele;
        this.tischhintergrund = tischhintergrund;
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
        this.bockrundenAktiv = bockrundenAktiv;
        this.schweinchenAktiv = schweinchenAktiv;
        this.dreissigAugenPflichtAktiv = dreissigAugenPflichtAktiv;
        this.schmeissenAktiv = schmeissenAktiv;
        this.herzDurchgegangenNurHoch = herzDurchgegangenNurHoch;
        this.kiSchwierigkeit = kiSchwierigkeit;
    }

    public static TischkonfigurationEmbeddable standard() {
        return locoBlatRegeln();
    }

    /** Loco-Blatt-Regelkatalog: alle Sonderregeln aktiv, 10-Karten-Spiel ohne Neunen, 24 Runden. Referenz: specs/regelkatalog.md */
    public static TischkonfigurationEmbeddable locoBlatRegeln() {
        return ausSpielregeln(Spielregeln.locoBlatRegeln(), 24);
    }

    /** DKV-Turnier-Regelkatalog: ohne Bockrunden, Schweinchen, 30-Augen-Pflicht und Schmeissen, 24 Runden. */
    public static TischkonfigurationEmbeddable dkvRegeln() {
        return ausSpielregeln(Spielregeln.dkvRegeln(), 24);
    }

    public static TischkonfigurationEmbeddable ausSpielregeln(Spielregeln spielregeln, int anzahlSpiele) {
        return ausSpielregeln(spielregeln, anzahlSpiele, Tischhintergrund.OVAL_2);
    }

    public static TischkonfigurationEmbeddable ausSpielregeln(
        Spielregeln spielregeln,
        int anzahlSpiele,
        Tischhintergrund tischhintergrund
    ) {
        return ausSpielregeln(spielregeln, anzahlSpiele, tischhintergrund, KiSchwierigkeit.STANDARD);
    }

    public static TischkonfigurationEmbeddable ausSpielregeln(
        Spielregeln spielregeln,
        int anzahlSpiele,
        Tischhintergrund tischhintergrund,
        KiSchwierigkeit kiSchwierigkeit
    ) {
        return new TischkonfigurationEmbeddable(
            spielregeln.ohneNeunen(),
            anzahlSpiele,
            tischhintergrund,
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
            spielregeln.mindestkartenSchwarz(),
            spielregeln.bockrundenAktiv(),
            spielregeln.schweinchenAktiv(),
            spielregeln.dreissigAugenPflichtAktiv(),
            spielregeln.schmeissenAktiv(),
            spielregeln.herzDurchgegangenNurHoch(),
            kiSchwierigkeit
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
            hochzeitErlaubt,
            bockrundenAktiv,
            schweinchenAktiv,
            dreissigAugenPflichtAktiv,
            schmeissenAktiv,
            herzDurchgegangenNurHoch
        );
    }

    public boolean ohneNeunen() {
        return ohneNeunen;
    }

    public int anzahlSpiele() {
        return anzahlSpiele;
    }

    public Tischhintergrund tischhintergrund() {
        return tischhintergrund;
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

    public boolean bockrundenAktiv() {
        return bockrundenAktiv;
    }

    public boolean schweinchenAktiv() {
        return schweinchenAktiv;
    }

    public boolean dreissigAugenPflichtAktiv() {
        return dreissigAugenPflichtAktiv;
    }

    public boolean schmeissenAktiv() {
        return schmeissenAktiv;
    }

    public boolean herzDurchgegangenNurHoch() {
        return herzDurchgegangenNurHoch;
    }

    public KiSchwierigkeit kiSchwierigkeit() {
        return kiSchwierigkeit;
    }
}
