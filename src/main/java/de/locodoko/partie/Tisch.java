package de.locodoko.partie;

import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartendeck;
import de.locodoko.karten.SpielerPosition;
import de.locodoko.karten.Spielregeln;

import java.util.List;
import java.util.Objects;

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
        return mitAktuellemSpiel(partie.aktuellesSpiel().teileKartenAus());
    }

    public Tisch meldeGesund(SpielerPosition spielerPosition) {
        return mitAktuellemSpiel(partie.aktuellesSpiel().meldeGesund(spielerPosition));
    }

    public Tisch meldeVorbehalt(SpielerPosition spielerPosition, VorbehaltAnsage vorbehaltAnsage) {
        return mitAktuellemSpiel(partie.aktuellesSpiel().meldeVorbehalt(spielerPosition, vorbehaltAnsage));
    }

    public Tisch loeseVorbehalteAuf() {
        return mitAktuellemSpiel(partie.aktuellesSpiel().loeseVorbehalteAuf());
    }

    public Tisch spieleKarte(SpielerPosition spielerPosition, Karte karte) {
        return mitAktuellemSpiel(partie.aktuellesSpiel().spieleKarte(spielerPosition, karte));
    }

    public Tisch sageAn(SpielerPosition spielerPosition, Ansage ansage) {
        return mitAktuellemSpiel(partie.aktuellesSpiel().sageAn(spielerPosition, ansage));
    }

    public Tisch werteAktuellesSpielAus(PunkteRechner punkteRechner) {
        return mitAktuellemSpiel(partie.aktuellesSpiel().werteAus(punkteRechner));
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

    private Tisch mitAktuellemSpiel(Spiel spiel) {
        return new Tisch(tischId, partie.mitAktuellemSpiel(spiel));
    }
}
