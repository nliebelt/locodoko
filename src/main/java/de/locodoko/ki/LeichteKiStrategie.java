package de.locodoko.ki;

import de.locodoko.karten.Karte;
import de.locodoko.partie.Ansage;
import de.locodoko.partie.VorbehaltAnsage;

import java.util.List;
import java.util.Optional;

/**
 * Einfache KI-Strategie ohne strategische Ueberlegungen (Schwierigkeitsstufe LEICHT).
 *
 * <p>Diese Strategie ist bewusst schwach gehalten, damit menschliche Spieler leicht gewinnen:
 * <ul>
 *   <li>Kein Vorbehalt — immer GESUND, kein Solo, keine Hochzeit, keine Armut.</li>
 *   <li>Keine Ansagen — kein Re, kein Kontra, keine Verschaerfungen.</li>
 *   <li>Armut wird immer abgelehnt — keine Auswertung des Angebotswerts.</li>
 *   <li>Kartenauswahl: immer die erste gueltige Karte (kein strategischer Vergleich).</li>
 * </ul>
 * </p>
 *
 * <p>Das Armut-Angebot wird korrekt befuellt (alle Truempfe), weil das Spiel sonst
 * in einem ungueltigem Zustand hängenbleibt — auch eine schwache KI muss
 * regelkonforme Armut-Angebote machen.</p>
 */
public class LeichteKiStrategie implements KiStrategie {

    @Override
    public VorbehaltAnsage waehleVorbehalt(KiSpielzustand zustand) {
        // Keine Solo-, Hochzeit- oder Armut-Anmeldung — immer Gesund
        return VorbehaltAnsage.GESUND;
    }

    @Override
    public List<Karte> waehleArmutAngebot(KiSpielzustand zustand) {
        // Alle Truempfe anbieten — muss korrekt sein, damit das Spiel nicht haengt
        List<Karte> truempfe = zustand.eigeneHand().karten().stream()
            .filter(zustand.trumpfOrdnung()::istTrumpf)
            .toList();
        if (truempfe.isEmpty()) {
            throw new IllegalStateException("Eine KI darf in der Armut nur mit vorhandenen Truempfen anbieten");
        }
        return truempfe;
    }

    @Override
    public KiArmutAntwort waehleArmutAntwort(KiSpielzustand zustand) {
        // Armut-Angebote werden immer abgelehnt — keine Auswertung
        return KiArmutAntwort.ablehnen();
    }

    @Override
    public Optional<Ansage> waehleAnsage(KiSpielzustand zustand) {
        // Keine Ansagen — kein Re, kein Kontra
        return Optional.empty();
    }

    @Override
    public Karte waehleKarte(KiSpielzustand zustand) {
        if (zustand.gueltigeKarten().isEmpty()) {
            throw new IllegalStateException("Ohne gueltige Karten kann keine KI-Aktion bestimmt werden");
        }
        // Erste gueltige Karte spielen — keine strategische Ueberlegung
        return zustand.gueltigeKarten().getFirst();
    }
}
