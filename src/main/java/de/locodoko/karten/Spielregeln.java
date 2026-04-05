package de.locodoko.karten;

/**
 * Konfigurierbare Spielregeln fuer eine Doppelkopf-Partie.
 *
 * <p>Kapselt alle regelbaren Parameter: Deckgroesse (mit/ohne Neunen), Dulle-Regel,
 * Ansagegrenzen (Mindestanzahl Handkarten fuer Re/Kontra/Keine90 usw.), aktive
 * Sonderpunkte (Fuchs, Karlchen, Doppelkopf) und aktivierte Sonderspiele
 * (Armut, Soli, Hochzeit). Alle Felder sind unveraenderlich (Value Object).</p>
 *
 * <p>Standardkonfiguration liefert {@link #standardRegeln()}, die "Ohne Neunen"-Variante
 * liefert {@link #ohneNeunenRegeln()}. Einzelne Parameter koennen per {@code mit*}-Methoden
 * unveraendernd ueberschrieben werden (Builder-Stil).</p>
 *
 * <p>TODO(regelkatalog): Neue Factory-Methoden ergaenzen — {@code locoBlatRegeln()} und
 * {@code dkvRegeln()} — gemaess specs/regelkatalog.md. {@code standardRegeln()} kann
 * danach auf {@code locoBlatRegeln()} delegieren.</p>
 *
 */
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
    boolean doppelkopfAktiv,
    boolean armutAktiv,
    boolean soloDameAktiv,
    boolean soloBubeAktiv,
    boolean soloTrumpfAktiv,
    boolean soloFleischlosAktiv,
    boolean hochzeitAktiv,
    boolean bockrundenAktiv,
    boolean schweinchenAktiv,
    boolean dreissigAugenPflichtAktiv
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
        return new Spielregeln(false, true, 11, 10, 9, 8, 7, true, true, true, true, true, true, true, true, true, false, false, false);
    }

    public static Spielregeln ohneNeunenRegeln() {
        return new Spielregeln(true, true, 9, 8, 7, 6, 5, true, true, true, true, true, true, true, true, true, false, false, false);
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
            doppelkopfAktiv,
            armutAktiv,
            soloDameAktiv,
            soloBubeAktiv,
            soloTrumpfAktiv,
            soloFleischlosAktiv,
            hochzeitAktiv,
            bockrundenAktiv,
            schweinchenAktiv,
            dreissigAugenPflichtAktiv
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
            doppelkopfAktiv,
            armutAktiv,
            soloDameAktiv,
            soloBubeAktiv,
            soloTrumpfAktiv,
            soloFleischlosAktiv,
            hochzeitAktiv,
            bockrundenAktiv,
            schweinchenAktiv,
            dreissigAugenPflichtAktiv
        );
    }

    public Spielregeln mitArmutAktiv(boolean armutAktiv) {
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
            doppelkopfAktiv,
            armutAktiv,
            soloDameAktiv,
            soloBubeAktiv,
            soloTrumpfAktiv,
            soloFleischlosAktiv,
            hochzeitAktiv,
            bockrundenAktiv,
            schweinchenAktiv,
            dreissigAugenPflichtAktiv
        );
    }

    public Spielregeln mitSoloDameAktiv(boolean soloDameAktiv) {
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
            doppelkopfAktiv,
            armutAktiv,
            soloDameAktiv,
            soloBubeAktiv,
            soloTrumpfAktiv,
            soloFleischlosAktiv,
            hochzeitAktiv,
            bockrundenAktiv,
            schweinchenAktiv,
            dreissigAugenPflichtAktiv
        );
    }

    public Spielregeln mitSoloBubeAktiv(boolean soloBubeAktiv) {
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
            doppelkopfAktiv,
            armutAktiv,
            soloDameAktiv,
            soloBubeAktiv,
            soloTrumpfAktiv,
            soloFleischlosAktiv,
            hochzeitAktiv,
            bockrundenAktiv,
            schweinchenAktiv,
            dreissigAugenPflichtAktiv
        );
    }

    public Spielregeln mitSoloTrumpfAktiv(boolean soloTrumpfAktiv) {
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
            doppelkopfAktiv,
            armutAktiv,
            soloDameAktiv,
            soloBubeAktiv,
            soloTrumpfAktiv,
            soloFleischlosAktiv,
            hochzeitAktiv,
            bockrundenAktiv,
            schweinchenAktiv,
            dreissigAugenPflichtAktiv
        );
    }

    public Spielregeln mitSoloFleischlosAktiv(boolean soloFleischlosAktiv) {
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
            doppelkopfAktiv,
            armutAktiv,
            soloDameAktiv,
            soloBubeAktiv,
            soloTrumpfAktiv,
            soloFleischlosAktiv,
            hochzeitAktiv,
            bockrundenAktiv,
            schweinchenAktiv,
            dreissigAugenPflichtAktiv
        );
    }

    public Spielregeln mitHochzeitAktiv(boolean hochzeitAktiv) {
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
            doppelkopfAktiv,
            armutAktiv,
            soloDameAktiv,
            soloBubeAktiv,
            soloTrumpfAktiv,
            soloFleischlosAktiv,
            hochzeitAktiv,
            bockrundenAktiv,
            schweinchenAktiv,
            dreissigAugenPflichtAktiv
        );
    }

    public Spielregeln mitBockrundenAktiv(boolean bockrundenAktiv) {
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
            doppelkopfAktiv,
            armutAktiv,
            soloDameAktiv,
            soloBubeAktiv,
            soloTrumpfAktiv,
            soloFleischlosAktiv,
            hochzeitAktiv,
            bockrundenAktiv,
            schweinchenAktiv,
            dreissigAugenPflichtAktiv
        );
    }

    public Spielregeln mitSchweinchenAktiv(boolean schweinchenAktiv) {
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
            doppelkopfAktiv,
            armutAktiv,
            soloDameAktiv,
            soloBubeAktiv,
            soloTrumpfAktiv,
            soloFleischlosAktiv,
            hochzeitAktiv,
            bockrundenAktiv,
            schweinchenAktiv,
            dreissigAugenPflichtAktiv
        );
    }

    public Spielregeln mitDreissigAugenPflichtAktiv(boolean dreissigAugenPflichtAktiv) {
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
            doppelkopfAktiv,
            armutAktiv,
            soloDameAktiv,
            soloBubeAktiv,
            soloTrumpfAktiv,
            soloFleischlosAktiv,
            hochzeitAktiv,
            bockrundenAktiv,
            schweinchenAktiv,
            dreissigAugenPflichtAktiv
        );
    }

    private static void pruefeMindestkarten(int wert, String feld) {
        if (wert < 1) {
            throw new IllegalArgumentException(feld + " muss mindestens 1 sein");
        }
    }
}
