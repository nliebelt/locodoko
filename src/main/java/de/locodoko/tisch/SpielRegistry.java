package de.locodoko.tisch;

import de.locodoko.partie.SpielerPosition;
import de.locodoko.partie.Spiel;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;
import java.util.function.Function;

/**
 * In-Memory-Cache fuer laufende Spiele.
 *
 * <p>Haelt das aktuelle {@link Spiel}-Domain-Objekt je Tisch vor, damit bei jeder
 * Spiel-Aktion kein teurer DB-Roundtrip fuer die Rekonstruktion noetig ist.
 * Jede Mutation laeuft ueber {@link #mitSpielGesperrt}, das einen TischId-bezogenen
 * {@link ReentrantLock} haelt — parallele Aktionen auf demselben Tisch werden
 * serialisiert, verschiedene Tische blockieren sich nicht gegenseitig.</p>
 *
 * <p>V1-Scope: rein in-memory. Ein Server-Neustart leert den Cache;
 * {@link #initialisiere()} laedt beim Start alle laufenden Spiele aus der DB nach.</p>
 */
@Component
public class SpielRegistry {

    private static final Logger LOGGER = LoggerFactory.getLogger(SpielRegistry.class);

    private final ConcurrentHashMap<UUID, Spiel> spielCache = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<UUID, ReentrantLock> locks = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<KommandoSchluessel, Object> kommandoCache = new ConcurrentHashMap<>();

    private final TischRepository tischRepository;

    /**
     * Schluessel fuer den Idempotenz-Cache: identifiziert ein Kommando pro Tisch,
     * Spielerposition und Kommando-Hash (z.B. Karten-ID oder Ansage-Typ).
     */
    public record KommandoSchluessel(UUID tischId, SpielerPosition position, String kommandoHash) {}

    public SpielRegistry(TischRepository tischRepository) {
        this.tischRepository = tischRepository;
    }

    /**
     * Laedt beim Server-Start alle laufenden Spiele aus der DB in den Cache.
     * Verhindert eine leere Registry nach einem Neustart bei laufenden Partien.
     */
    @PostConstruct
    void initialisiere() {
        tischRepository.findAllByStatusOrderByErstelltAmAsc(TischStatus.IM_SPIEL).forEach(tisch -> {
            if (tisch.partie() == null) {
                return;
            }
            tisch.partie().spiele().stream()
                .filter(spiel -> spiel.ergebnisEmbeddable() == null)
                .reduce((erstes, zweites) -> zweites)
                .ifPresent(laufendesSpiel -> {
                    laufendesSpiel.hydriere(tisch.konfiguration().alsSpielregeln());
                    spielCache.put(tisch.id(), laufendesSpiel);
                    LOGGER.info("SpielRegistry: Spiel fuer Tisch {} aus DB geladen", tisch.id());
                });
        });
        LOGGER.info("SpielRegistry initialisiert — {} laufende Spiele geladen", spielCache.size());
    }

    /**
     * Fuehrt eine Spiel-Mutation unter TischId-bezogenem Lock aus.
     *
     * <p>Laedt das aktuelle Spiel aus dem Cache, wendet {@code aktion} an,
     * speichert das neue Spiel zurueck und gibt {@code SpielUndErgebnis#wert()} zurueck.</p>
     *
     * @throws IllegalStateException wenn kein Spiel fuer die TischId im Cache liegt
     */
    public <T> T mitSpielGesperrt(TischId tischId, Function<Spiel, SpielUndErgebnis<T>> aktion) {
        UUID id = tischId.wert();
        ReentrantLock lock = locks.computeIfAbsent(id, k -> new ReentrantLock());
        lock.lock();
        try {
            Spiel aktuell = spielCache.get(id);
            if (aktuell == null) {
                throw new IllegalStateException("Kein Spiel fuer TischId " + tischId + " in Registry");
            }
            SpielUndErgebnis<T> ergebnis = aktion.apply(aktuell);
            spielCache.put(id, ergebnis.neuesSpiel());
            return ergebnis.wert();
        } finally {
            lock.unlock();
        }
    }

    /**
     * Fuehrt eine Spiel-Mutation unter TischId-bezogenem Lock aus und aktualisiert dabei
     * den Cache zuerst mit dem uebergebenen {@code frischesSpiel} (aus der Persistenzschicht).
     *
     * <p>Dieser Overload wird in {@link SpielAktionsService} genutzt: Da jeder Service-Aufruf
     * zuerst die Entity aus der DB laedt, stellt diese Methode sicher, dass der Cache immer
     * den letzten persistierten Zustand widerspiegelt — auch wenn ein Test oder ein anderer
     * Adapter die Entity direkt geaendert hat.</p>
     */
    public <T> T mitSpielGesperrt(TischId tischId, Spiel frischesSpiel, Function<Spiel, SpielUndErgebnis<T>> aktion) {
        UUID id = tischId.wert();
        ReentrantLock lock = locks.computeIfAbsent(id, k -> new ReentrantLock());
        lock.lock();
        try {
            // Innerhalb des Locks: Cache mit frischem Entity-Stand aktualisieren,
            // damit kein veralteter Cache-Eintrag als Basis fuer die Mutation dient.
            spielCache.put(id, frischesSpiel);
            SpielUndErgebnis<T> ergebnis = aktion.apply(frischesSpiel);
            spielCache.put(id, ergebnis.neuesSpiel());
            return ergebnis.wert();
        } finally {
            lock.unlock();
        }
    }

    /** Registriert oder ersetzt das laufende Spiel eines Tisches. */
    public void registriere(TischId tischId, Spiel spiel) {
        spielCache.put(tischId.wert(), spiel);
    }

    /**
     * Fuehrt eine Spiel-Mutation unter TischId-bezogenem Lock aus — mit Idempotenz-Schutz.
     *
     * <p>Falls derselbe {@code schluessel} bereits erfolgreich verarbeitet wurde, wird das
     * gecachte Ergebnis zurueckgegeben, ohne die Mutation erneut auszufuehren. So fuehren
     * Netzwerk-Duplikate (z.B. doppelter Klick, Reconnect-Replay) nicht zu einem Fehler.</p>
     */
    @SuppressWarnings("unchecked")
    public <T> T mitSpielGesperrtIdempotent(TischId tischId, Spiel frischesSpiel,
                                             KommandoSchluessel schluessel,
                                             Function<Spiel, SpielUndErgebnis<T>> aktion) {
        UUID id = tischId.wert();
        ReentrantLock lock = locks.computeIfAbsent(id, k -> new ReentrantLock());
        lock.lock();
        try {
            Object gecachtes = kommandoCache.get(schluessel);
            if (gecachtes != null) {
                LOGGER.debug("Idempotenz-Cache-Hit fuer {}", schluessel);
                return (T) gecachtes;
            }
            spielCache.put(id, frischesSpiel);
            SpielUndErgebnis<T> ergebnis = aktion.apply(frischesSpiel);
            spielCache.put(id, ergebnis.neuesSpiel());
            kommandoCache.put(schluessel, ergebnis.wert());
            return ergebnis.wert();
        } finally {
            lock.unlock();
        }
    }

    /**
     * Fuehrt eine Aktion unter TischId-bezogenem Lock aus.
     * Ermoeglicht die Serialisierung von Aktionen (z.B. KI-Orchestrierung), die nicht
     * direkt ueber die Spiel-Mutationen laufen.
     */
    public void mitLock(TischId tischId, Runnable aktion) {
        UUID id = tischId.wert();
        ReentrantLock lock = locks.computeIfAbsent(id, k -> new ReentrantLock());
        lock.lock();
        try {
            aktion.run();
        } finally {
            lock.unlock();
        }
    }

    /** Entfernt das laufende Spiel eines Tisches aus dem Cache (z.B. bei Neustart). */
    public void leere(TischId tischId) {
        spielCache.remove(tischId.wert());
        LOGGER.info("SpielRegistry: Cache fuer Tisch {} geleert", tischId);
    }

    /** Entfernt Spiel, Lock und Kommando-Cache eines beendeten Tisches. */
    public void entferne(TischId tischId) {
        spielCache.remove(tischId.wert());
        locks.remove(tischId.wert());
        kommandoCache.keySet().removeIf(k -> k.tischId().equals(tischId.wert()));
    }

    /** Liefert das gecachte Spiel eines Tisches, falls vorhanden. */
    public Optional<Spiel> finde(TischId tischId) {
        return Optional.ofNullable(spielCache.get(tischId.wert()));
    }

    /** Gibt die Anzahl der gecachten Spiele zurueck (fuer Tests und Monitoring). */
    public int groesse() {
        return spielCache.size();
    }
}
