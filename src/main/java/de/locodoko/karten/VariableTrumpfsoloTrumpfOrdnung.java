package de.locodoko.karten;

import java.util.EnumMap;
import java.util.Map;
import java.util.Objects;

/**
 * Trumpfordnung fuer variable Trumpfsoli (Herz-, Pik- oder Kreuz-Solo).
 *
 * <p>Beim variablen Trumpfsolo waehlt der Solo-Spieler eine Nicht-Karo-Farbe als Trumpffarbe.
 * Die Damen und Buben bleiben in ihrer normalen Rangfolge Trumpf. Die Karten der gewaehlten
 * Farbe (ausser Dame und Bube, die schon Trumpf sind) bilden die unteren Trumpfraenge.
 * Die Dulle (Herz-Zehn) hat in diesem Spieltyp keinen Sonderstatus — beim Herz-Solo ist
 * sie eine normale Herz-Trumpfkarte, beim Pik- oder Kreuz-Solo ist sie eine Fehlkarte.</p>
 *
 * <p>Fuer das Standard-Trumpfsolo (Karo-Trumpf mit Dulle) wird weiterhin
 * {@link NormaleTrumpfOrdnung} verwendet.</p>
 */
public final class VariableTrumpfsoloTrumpfOrdnung implements TrumpfOrdnung {

    /**
     * Rang der Trumpf-Grundkarten (9 → 1, Koenig → 2, Zehn → 3, As → 4).
     * Gilt fuer die Karten der gewaehlten Trumpffarbe.
     */
    private static final Map<Kartenwert, Integer> SUIT_RANG;

    static {
        SUIT_RANG = new EnumMap<>(Kartenwert.class);
        SUIT_RANG.put(Kartenwert.NEUN, 1);
        SUIT_RANG.put(Kartenwert.KOENIG, 2);
        SUIT_RANG.put(Kartenwert.ZEHN, 3);
        SUIT_RANG.put(Kartenwert.AS, 4);
    }

    private final Farbe trumpfFarbe;
    private final Spielregeln spielregeln;

    public VariableTrumpfsoloTrumpfOrdnung(Farbe trumpfFarbe, Spielregeln spielregeln) {
        this.trumpfFarbe = Objects.requireNonNull(trumpfFarbe, "trumpfFarbe darf nicht null sein");
        this.spielregeln = Objects.requireNonNull(spielregeln, "spielregeln duerfen nicht null sein");
    }

    @Override
    public boolean istTrumpf(Karte karte) {
        if (karte.wert() == Kartenwert.DAME || karte.wert() == Kartenwert.BUBE) {
            return true;
        }
        if (karte.farbe() == trumpfFarbe) {
            return karte.wert() != Kartenwert.NEUN || !spielregeln.ohneNeunen();
        }
        // Herz-Zehn ist KEIN Dulle-Sonderfall in variablen Trumpfsoli
        return false;
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
        // Karten der Trumpffarbe (Rang 1–4)
        if (karte.farbe() == trumpfFarbe) {
            Integer rang = SUIT_RANG.get(karte.wert());
            if (rang == null) {
                throw new IllegalArgumentException("Kein Trumpfrang fuer Karte definiert: " + karte);
            }
            return rang;
        }
        // Buben (Rang 5–8): Karo < Herz < Pik < Kreuz
        if (karte.wert() == Kartenwert.BUBE) {
            return 4 + farbenRang(karte.farbe());
        }
        // Damen (Rang 9–12): Karo < Herz < Pik < Kreuz
        if (karte.wert() == Kartenwert.DAME) {
            return 8 + farbenRang(karte.farbe());
        }
        throw new IllegalArgumentException("Kein Trumpfrang fuer Karte definiert: " + karte);
    }

    @Override
    public boolean spaetereGleicheKarteGewinnt(Karte karte) {
        // Kein Dulle-Mechanismus in variablen Trumpfsoli
        return false;
    }

    private static int farbenRang(Farbe farbe) {
        return switch (farbe) {
            case KARO -> 1;
            case HERZ -> 2;
            case PIK -> 3;
            case KREUZ -> 4;
        };
    }
}
