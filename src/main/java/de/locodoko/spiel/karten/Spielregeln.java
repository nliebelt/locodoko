package de.locodoko.spiel.karten;

public record Spielregeln(
    boolean ohneNeunen,
    boolean zweiteDulleSticht,
    int mindestkartenReKontra,
    int mindestkartenKeine90,
    int mindestkartenKeine60,
    int mindestkartenKeine30,
    int mindestkartenSchwarz,
    boolean fuchsAktiv,
    boolean karlchenAktiv,
    boolean doppelkopfAktiv
) {

    public Spielregeln {
        pruefeMindestkarten(mindestkartenReKontra, "mindestkartenReKontra");
        pruefeMindestkarten(mindestkartenKeine90, "mindestkartenKeine90");
        pruefeMindestkarten(mindestkartenKeine60, "mindestkartenKeine60");
        pruefeMindestkarten(mindestkartenKeine30, "mindestkartenKeine30");
        pruefeMindestkarten(mindestkartenSchwarz, "mindestkartenSchwarz");
        if (mindestkartenReKontra < mindestkartenKeine90
            || mindestkartenKeine90 < mindestkartenKeine60
            || mindestkartenKeine60 < mindestkartenKeine30
            || mindestkartenKeine30 < mindestkartenSchwarz) {
            throw new IllegalArgumentException("Ansagegrenzen muessen mit jeder Verschaerfung kleiner oder gleich werden");
        }
    }

    public static Spielregeln standardRegeln() {
        return new Spielregeln(false, true, 11, 10, 9, 8, 7, true, true, true);
    }

    public static Spielregeln ohneNeunenRegeln() {
        return new Spielregeln(true, true, 9, 8, 7, 6, 5, true, true, true);
    }

    public Spielregeln mitAnsagegrenzen(
        int mindestkartenReKontra,
        int mindestkartenKeine90,
        int mindestkartenKeine60,
        int mindestkartenKeine30,
        int mindestkartenSchwarz
    ) {
        return new Spielregeln(
            ohneNeunen,
            zweiteDulleSticht,
            mindestkartenReKontra,
            mindestkartenKeine90,
            mindestkartenKeine60,
            mindestkartenKeine30,
            mindestkartenSchwarz,
            fuchsAktiv,
            karlchenAktiv,
            doppelkopfAktiv
        );
    }

    public Spielregeln mitSonderpunkten(boolean fuchsAktiv, boolean karlchenAktiv, boolean doppelkopfAktiv) {
        return new Spielregeln(
            ohneNeunen,
            zweiteDulleSticht,
            mindestkartenReKontra,
            mindestkartenKeine90,
            mindestkartenKeine60,
            mindestkartenKeine30,
            mindestkartenSchwarz,
            fuchsAktiv,
            karlchenAktiv,
            doppelkopfAktiv
        );
    }

    private static void pruefeMindestkarten(int wert, String feld) {
        if (wert < 1) {
            throw new IllegalArgumentException(feld + " muss mindestens 1 sein");
        }
    }
}
