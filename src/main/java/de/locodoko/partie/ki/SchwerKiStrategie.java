package de.locodoko.partie.ki;

import de.locodoko.partie.Ansage;
import de.locodoko.partie.Partei;

/**
 * Schwere KI-Strategie mit aggressiveren Ansage-Schwellenwerten (Schwierigkeitsstufe SCHWER).
 *
 * <p>Erbt die gesamte Spiellogik von {@link StandardKiStrategie} (Kartenauswahl, Vorbehalt,
 * Armut, Schmier-Logik, Sonderpunkt-Bewusstsein) und ueberschreibt nur die Ansage-Schwellenwerte.
 * Niedrigere Schwellen bedeuten, dass die KI haeufiger Re/Kontra ansagt und schneller
 * Verschaerfungen ausruft — das erhoeht den Druck auf menschliche Gegner.</p>
 *
 * <p>Kalibrierung gegenueber Standard:
 * <ul>
 *   <li>RE: 24 statt 28 (-4) — aggressivere Parteideklaration</li>
 *   <li>KONTRA: 22/26 statt 26/30 (-4) — fruehere Gegnermarkierung</li>
 *   <li>KEINE_90 bis SCHWARZ: je -4 — haeutigere Verschaerfungen bei starker Hand</li>
 * </ul>
 * </p>
 */
public class SchwerKiStrategie extends StandardKiStrategie {

    @Override
    protected int ansageSchwelle(Ansage ansage, Partei eigenePartei) {
        // Niedrigere Schwellenwerte als Standard: KI sagt oeufiger an
        return switch (ansage) {
            case RE -> 24;
            case KONTRA -> eigenePartei == Partei.KONTRA ? 22 : 26;
            case KEINE_90 -> 32;
            case KEINE_60 -> 38;
            case KEINE_30 -> 44;
            case SCHWARZ -> 50;
        };
    }
}
