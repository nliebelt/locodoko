package de.locodoko.partie;

/**
 * Die zwei Parteien im Doppelkopf-Spiel: Re und Kontra.
 *
 * <p>Im Normalspiel gehoeren die Spieler mit den beiden Kreuz-Damen zur Re-Partei,
 * die anderen beiden zur Kontra-Partei. Diese Zuordnung ist anfangs verdeckt.
 * Bei Soli (z.B. Trumpfsolo) ist der Solo-Spieler allein in der Re-Partei (1 gegen 3).</p>
 */
public enum Partei {
    RE,
    KONTRA;

    public Partei gegenpartei() {
        return this == RE ? KONTRA : RE;
    }
}
