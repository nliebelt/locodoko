package de.locodoko.karten;

/**
 * Trumpfordnung fuer das Normalspiel mit aktivierter Schweinchen-Regel.
 *
 * <p>Wenn ein Spieler beide Karo-Asse haelt, werden diese zu den staerksten Truempfen:
 * Karo-As exemplarIndex 1 bekommt Rang 14 (oberhalb der Dulle), exemplarIndex 2 bekommt
 * Rang 15 (schlaegt das erste Schweinchen). Alle anderen Regeln entsprechen
 * {@link NormaleTrumpfOrdnung}.</p>
 */
public final class SchweinchenTrumpfOrdnung implements TrumpfOrdnung {

    private final NormaleTrumpfOrdnung basis;

    public SchweinchenTrumpfOrdnung(Spielregeln spielregeln) {
        this.basis = new NormaleTrumpfOrdnung(spielregeln);
    }

    Spielregeln spielregeln() { return basis.spielregeln(); }

    @Override
    public boolean istTrumpf(Karte karte) {
        return basis.istTrumpf(karte);
    }

    @Override
    public Bedienfarbe bedienfarbeVon(Karte karte) {
        return basis.bedienfarbeVon(karte);
    }

    @Override
    public int fehlRang(Karte karte) {
        return basis.fehlRang(karte);
    }

    @Override
    public int trumpfRang(Karte karte) {
        if (karte.farbe() == Farbe.KARO && karte.wert() == Kartenwert.AS) {
            return karte.exemplarIndex() == 1 ? 14 : 15;
        }
        return basis.trumpfRang(karte);
    }

    @Override
    public boolean spaetereGleicheKarteGewinnt(Karte karte) {
        if (karte.farbe() == Farbe.KARO && karte.wert() == Kartenwert.AS) {
            return true;
        }
        return basis.spaetereGleicheKarteGewinnt(karte);
    }
}
