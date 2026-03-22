package de.locodoko.partie;

import de.locodoko.karten.Spielregeln;

/**
 * Moegliche Ansagen und Absagen im Doppelkopf-Spiel.
 *
 * <p>Grundansagen sind {@code RE} und {@code KONTRA}; sie duerfen als erste Ansage einer Partei
 * gemacht werden, solange genug Handkarten vorhanden sind. Absagen ({@code KEINE_90},
 * {@code KEINE_60}, {@code KEINE_30}, {@code SCHWARZ}) versprechen, der Gegenseite
 * noch weniger Augen zu lassen; sie setzen eine bereits getaetigte Grundansage voraus und
 * verkuerzern das erlaubte Zeitfenster mit jeder Stufe. Das erlaubte Zeitfenster wird
 * durch {@link Spielregeln} konfiguriert.</p>
 */
public enum Ansage {
    RE(0),
    KONTRA(0),
    KEINE_90(1),
    KEINE_60(2),
    KEINE_30(3),
    SCHWARZ(4);

    private final int stufe;

    Ansage(int stufe) {
        this.stufe = stufe;
    }

    public boolean istGrundansage() {
        return this == RE || this == KONTRA;
    }

    public boolean istAbsage() {
        return !istGrundansage();
    }

    public int stufe() {
        return stufe;
    }

    public int mindestkarten(Spielregeln spielregeln) {
        return switch (this) {
            case RE, KONTRA -> spielregeln.mindestkartenReKontra();
            case KEINE_90 -> spielregeln.mindestkartenKeine90();
            case KEINE_60 -> spielregeln.mindestkartenKeine60();
            case KEINE_30 -> spielregeln.mindestkartenKeine30();
            case SCHWARZ -> spielregeln.mindestkartenSchwarz();
        };
    }

    public Partei grundpartei() {
        return switch (this) {
            case RE -> Partei.RE;
            case KONTRA -> Partei.KONTRA;
            default -> throw new IllegalStateException("Absagen haben keine feste Grundpartei");
        };
    }

    public static Ansage grundansageFuer(Partei partei) {
        return switch (partei) {
            case RE -> RE;
            case KONTRA -> KONTRA;
        };
    }

    public Ansage vorherigeStufe() {
        return switch (this) {
            case KEINE_90 -> null;
            case KEINE_60 -> KEINE_90;
            case KEINE_30 -> KEINE_60;
            case SCHWARZ -> KEINE_30;
            case RE, KONTRA -> null;
        };
    }
}
