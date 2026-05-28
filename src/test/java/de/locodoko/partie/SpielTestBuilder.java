package de.locodoko.partie;

import de.locodoko.karten.Hand;
import de.locodoko.karten.Spieltyp;

import java.util.List;
import java.util.Map;

/**
 * Fluent-Builder für Spiel-Testszenarien.
 *
 * <p>Nutzt Package-Private Feldzugriff statt Setter im Production-Code,
 * um realistische Spielzustände für Persistenz- und Domain-Tests aufzubauen.
 * Kein Setter im Produktionscode nötig — der Builder lebt ausschließlich in
 * der Test-Quelle.</p>
 */
public class SpielTestBuilder {

    private final Spiel spiel;

    private SpielTestBuilder(Spiel spiel) {
        this.spiel = spiel;
    }

    public static SpielTestBuilder ausNeuePersistenz(int spielNummer, SpielerPosition geber, Spieltyp spieltyp, Spielphase phase) {
        return new SpielTestBuilder(Spiel.neuePersistenz(spielNummer, geber, spieltyp, phase));
    }

    /** Wrapping eines bereits geladenen Spiels — für Integrationstests, die nach DB-Load Felder setzen müssen. */
    public static SpielTestBuilder von(Spiel spiel) {
        return new SpielTestBuilder(spiel);
    }

    public SpielTestBuilder mitHaenden(Map<SpielerPosition, Hand> haende) {
        spiel.haende = Haende.aus(haende);
        return this;
    }

    public SpielTestBuilder mitAbgeschlossenenStichen(List<Stich> stiche) {
        spiel.abgeschlosseneStiche = Stichverlauf.aus(stiche);
        return this;
    }

    public SpielTestBuilder mitErgebnis(Spielergebnis ergebnis) {
        spiel.ergebnis = ergebnis;
        return this;
    }

    public SpielTestBuilder mitAnsagen(Ansagen ansagen) {
        spiel.ansagen = ansagen;
        return this;
    }

    public Spiel bauen() {
        return spiel;
    }
}
