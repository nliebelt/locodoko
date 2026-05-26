package de.locodoko.partie;

import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartendeck;
import de.locodoko.karten.Spielregeln;

import java.util.List;
import java.util.Objects;

/**
 * Domain-Objekt fuer einen laufenden Spieltisch.
 *
 * <p>Verbindet eine eindeutige Tisch-ID mit der zugehoerigen {@link Partie} und bietet
 * eine duenne Fassade, die alle Spielaktionen (Karten austeilen, Vorbehalte melden,
 * Karte spielen, Ansagen usw.) an das aktuelle Spiel innerhalb der Partie delegiert.
 * Unveraenderlich: jede Aktion liefert einen neuen {@code Tisch}.</p>
 *
 * <p>Dient als Einstiegspunkt fuer den {@code TischService}, der den persistierten
 * {@code TischEntity}-Zustand und dieses Domain-Objekt miteinander synchronisiert.</p>
 */
public final class Tisch {

    private final String tischId;
    private final Partie partie;

    private Tisch(String tischId, Partie partie) {
        this.tischId = Objects.requireNonNull(tischId, "tischId darf nicht null sein");
        this.partie = Objects.requireNonNull(partie, "partie darf nicht null sein");
    }

    public static Tisch neu(String tischId, int anzahlSpiele, SpielerPosition ersterGeber, Spielregeln spielregeln) {
        return new Tisch(tischId, Partie.neu(anzahlSpiele, ersterGeber, spielregeln));
    }

    public Tisch starteNaechstesSpiel(Kartendeck kartendeck) {
        return new Tisch(tischId, partie.starteNaechstesSpiel(kartendeck));
    }

    public Tisch teileKartenAus() {
        partie.aktuellesSpiel().teileKartenAus();
        return this;
    }

    public Tisch meldeGesund(SpielerPosition spielerPosition) {
        partie.aktuellesSpiel().meldeGesund(spielerPosition);
        return this;
    }

    public Tisch meldeVorbehalt(SpielerPosition spielerPosition, VorbehaltAnsage vorbehaltAnsage) {
        partie.aktuellesSpiel().meldeVorbehalt(spielerPosition, vorbehaltAnsage);
        return this;
    }

    public Tisch loeseVorbehalteAuf() {
        partie.aktuellesSpiel().loeseVorbehalteAuf();
        return this;
    }

    public Tisch spieleKarte(SpielerPosition spielerPosition, Karte karte) {
        partie.aktuellesSpiel().spieleKarte(spielerPosition, karte);
        return this;
    }

    public Tisch sageAn(SpielerPosition spielerPosition, Ansage ansage) {
        partie.aktuellesSpiel().sageAn(spielerPosition, ansage);
        return this;
    }

    public Tisch werteAktuellesSpielAus() {
        partie.aktuellesSpiel().werteAus();
        return this;
    }

    public Tisch schliesseAktuellesSpielAb() {
        return new Tisch(tischId, partie.schliesseAktuellesSpielAb());
    }

    public String tischId() {
        return tischId;
    }

    public Partie partie() {
        return partie;
    }

    public List<Karte> gueltigeKartenFuer(SpielerPosition spielerPosition) {
        return partie.aktuellesSpiel().gueltigeKartenFuer(spielerPosition);
    }

    public boolean kannAnsagen(SpielerPosition spielerPosition, Ansage ansage) {
        return partie.aktuellesSpiel().kannAnsagen(spielerPosition, ansage);
    }

}
