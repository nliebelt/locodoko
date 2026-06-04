package de.locodoko.betrieb;

import de.locodoko.partie.ereignisse.SpielBeendet;
import de.locodoko.partie.ereignisse.SpielBeendet.SpielerSpielDaten;
import io.micrometer.core.instrument.DistributionSummary;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.Optional;

/**
 * Aggregierte Domain-Metriken ("Locodoko in Zahlen") fuer Prometheus/Grafana.
 *
 * <p>Lauscht auf dasselbe {@link SpielBeendet}-Event wie die Spieler-Statistik und zaehlt
 * niedrig-kardinale Spiel-Kennzahlen. <strong>Bewusst ohne {@code spieler_id}-Label</strong> —
 * Per-Spieler-Statistik bleibt in Postgres; ein Spieler-Label wuerde die Prometheus-Kardinalitaet
 * sprengen. Alle Label-Werte stammen aus Enums/festen Kategorien (Regelvariante, Spieltyp, Partei,
 * Sonderpunkt-Typ) und sind damit niedrig-kardinal.</p>
 *
 * <p>Liegt im eigenen Blatt-Modul {@code betrieb} (nicht in {@code system}): das Lauschen auf das
 * Domain-Event erzeugt eine Abhaengigkeit auf {@code partie}; im Basis-Modul {@code system} ergaebe
 * das einen Modul-Zyklus, da {@code partie} bereits auf {@code system} aufbaut.</p>
 */
@Component
class SpielMetriken {

    private final MeterRegistry registry;
    private final DistributionSummary reAugen;

    SpielMetriken(MeterRegistry registry) {
        this.registry = registry;
        this.reAugen = DistributionSummary.builder("locodoko.spiel.re_augen")
            .description("Augen der Re-Partei pro abgeschlossenem Spiel")
            .baseUnit("augen")
            .register(registry);
    }

    @ApplicationModuleListener
    void beiSpielBeendet(SpielBeendet ereignis) {
        registry.counter("locodoko.spiele.abgeschlossen", "regelvariante", ereignis.regelvariante().name()).increment();
        if (ereignis.partieBeendet()) {
            registry.counter("locodoko.partien.beendet").increment();
        }

        Collection<SpielerSpielDaten> alle = ereignis.spielerDaten().values();
        registry.counter("locodoko.spieltyp", "typ", ermittleSpieltyp(alle)).increment();
        ermittleSiegerPartei(alle).ifPresent(partei ->
            registry.counter("locodoko.sieger.partei", "partei", partei).increment());
        zaehleSonderpunkte(alle);
        ermittleReAugen(alle).ifPresent(augen -> reAugen.record(augen));
        if (alle.stream().anyMatch(SpielerSpielDaten::hatArmutAngesagt)) {
            registry.counter("locodoko.armut.angesagt").increment();
        }
    }

    /** Spieltyp des Spiels: erster nicht-leerer Solo-/Sondertyp, sonst NORMALSPIEL. */
    private String ermittleSpieltyp(Collection<SpielerSpielDaten> alle) {
        return alle.stream()
            .map(SpielerSpielDaten::spieltypName)
            .filter(name -> name != null && !name.isBlank())
            .findFirst()
            .orElse("NORMALSPIEL");
    }

    /** Gewinner-Partei (RE/KONTRA) anhand des ersten Siegers. */
    private Optional<String> ermittleSiegerPartei(Collection<SpielerSpielDaten> alle) {
        return alle.stream()
            .filter(SpielerSpielDaten::sieger)
            .findFirst()
            .map(daten -> daten.istReSpieler() ? "RE" : "KONTRA");
    }

    private void zaehleSonderpunkte(Collection<SpielerSpielDaten> alle) {
        int fuchs = alle.stream().mapToInt(SpielerSpielDaten::fuchsGefangen).sum();
        int karlchen = alle.stream().mapToInt(SpielerSpielDaten::karlchenGespielt).sum();
        int doppelkopf = alle.stream().mapToInt(SpielerSpielDaten::doppelkoepfe).sum();
        if (fuchs > 0) registry.counter("locodoko.sonderpunkt", "typ", "fuchs").increment(fuchs);
        if (karlchen > 0) registry.counter("locodoko.sonderpunkt", "typ", "karlchen").increment(karlchen);
        if (doppelkopf > 0) registry.counter("locodoko.sonderpunkt", "typ", "doppelkopf").increment(doppelkopf);
    }

    /** Augen der Re-Partei in diesem Spiel (von einem beliebigen Re-Spieler). */
    private Optional<Integer> ermittleReAugen(Collection<SpielerSpielDaten> alle) {
        return alle.stream()
            .filter(SpielerSpielDaten::istReSpieler)
            .findFirst()
            .map(SpielerSpielDaten::teamAugen);
    }
}
