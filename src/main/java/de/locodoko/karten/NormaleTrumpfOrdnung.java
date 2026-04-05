package de.locodoko.karten;

import java.util.Map;

/**
 * Trumpfordnung fuer das Normalspiel und Trumpfsolo.
 *
 * <p>Im Normalspiel sind alle Damen, alle Buben, alle Karo-Karten sowie die Herz-Zehn
 * (die Dulle, hoechster Trumpf) Trumpf. Die Trumpfhierarchie von unten nach oben lautet:
 * Karo-Neun, Karo-Koenig, Karo-Zehn, Karo-As, Karo-Bube, Herz-Bube, Pik-Bube,
 * Kreuz-Bube, Karo-Dame, Herz-Dame, Pik-Dame, Kreuz-Dame, Herz-Zehn (Dulle).</p>
 *
 * <p>Ob die zweite Dulle die erste sticht, wird durch {@link Spielregeln#zweiteDulleSticht()}
 * gesteuert. Karo-Neunen werden bei aktiviertem "Ohne Neunen"-Modus nicht als Trumpf gewertet.</p>
 */
public final class NormaleTrumpfOrdnung implements TrumpfOrdnung {

    // TODO(schweinchen): Neue Unterklasse SchweinchenTrumpfOrdnung (oder Decorator)
    //   erstellen, die TRUMPF_RANG fuer Karo-As exemplarIndex 1 auf Rang 14 und
    //   exemplarIndex 2 auf Rang 15 setzt (oberhalb aller bestehenden Eintraege).
    //   spaetereGleicheKarteGewinnt(Karte) muss true fuer Karo-As zurueckgeben
    //   (zweites Schweinchen schlaegt erstes, analog zur Dulle-Regel).
    //   NormaleTrumpfOrdnung selbst bleibt unveraendert.

    private static final Map<Karte, Integer> TRUMPF_RANG = Map.ofEntries(
        Map.entry(new Karte(Farbe.KARO, Kartenwert.NEUN, 1), 1),
        Map.entry(new Karte(Farbe.KARO, Kartenwert.KOENIG, 1), 2),
        Map.entry(new Karte(Farbe.KARO, Kartenwert.ZEHN, 1), 3),
        Map.entry(new Karte(Farbe.KARO, Kartenwert.AS, 1), 4),
        Map.entry(new Karte(Farbe.KARO, Kartenwert.BUBE, 1), 5),
        Map.entry(new Karte(Farbe.HERZ, Kartenwert.BUBE, 1), 6),
        Map.entry(new Karte(Farbe.PIK, Kartenwert.BUBE, 1), 7),
        Map.entry(new Karte(Farbe.KREUZ, Kartenwert.BUBE, 1), 8),
        Map.entry(new Karte(Farbe.KARO, Kartenwert.DAME, 1), 9),
        Map.entry(new Karte(Farbe.HERZ, Kartenwert.DAME, 1), 10),
        Map.entry(new Karte(Farbe.PIK, Kartenwert.DAME, 1), 11),
        Map.entry(new Karte(Farbe.KREUZ, Kartenwert.DAME, 1), 12),
        Map.entry(new Karte(Farbe.HERZ, Kartenwert.ZEHN, 1), 13)
    );

    private final Spielregeln spielregeln;

    public NormaleTrumpfOrdnung(Spielregeln spielregeln) {
        this.spielregeln = spielregeln;
    }

    @Override
    public boolean istTrumpf(Karte karte) {
        if (karte.wert() == Kartenwert.DAME || karte.wert() == Kartenwert.BUBE) {
            return true;
        }
        if (karte.farbe() == Farbe.KARO) {
            return karte.wert() != Kartenwert.NEUN || !spielregeln.ohneNeunen();
        }
        return karte.farbe() == Farbe.HERZ && karte.wert() == Kartenwert.ZEHN;
    }

    @Override
    public Bedienfarbe bedienfarbeVon(Karte karte) {
        return istTrumpf(karte) ? Bedienfarbe.alsTrumpf() : Bedienfarbe.fehl(karte.farbe());
    }

    @Override
    public int fehlRang(Karte karte) {
        if (istTrumpf(karte)) {
            throw new IllegalArgumentException("Trumpfkarten haben keinen Fehlrang: " + karte);
        }
        return karte.wert().fehlRang();
    }

    @Override
    public int trumpfRang(Karte karte) {
        if (!istTrumpf(karte)) {
            throw new IllegalArgumentException("Fehlkarten haben keinen Trumpfrang: " + karte);
        }
        Integer rang = TRUMPF_RANG.get(new Karte(karte.farbe(), karte.wert(), 1));
        if (rang == null) {
            throw new IllegalArgumentException("Kein Trumpfrang fuer Karte definiert: " + karte);
        }
        return rang;
    }

    @Override
    public boolean spaetereGleicheKarteGewinnt(Karte karte) {
        return spielregeln.zweiteDulleSticht() && karte.farbe() == Farbe.HERZ && karte.wert() == Kartenwert.ZEHN;
    }
}
