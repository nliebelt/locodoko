package de.locodoko.tisch;

import de.locodoko.ki.KiSchwierigkeit;
import de.locodoko.ki.orchestrierung.KiAktionErgebnis;
import de.locodoko.ki.orchestrierung.KiOrchestrierungService;
import de.locodoko.partie.Partie;
import de.locodoko.partie.PartieStatus;
import de.locodoko.partie.Spiel;
import de.locodoko.partie.SpielEreignis;
import de.locodoko.partie.SpielerPosition;
import de.locodoko.partie.Spielphase;
import de.locodoko.partie.SonderpunktEreignis;
import de.locodoko.partie.ereignisse.DoppelkopfGestochen;
import de.locodoko.partie.ereignisse.FuchsGefangen;
import de.locodoko.partie.ereignisse.KarlchenGespielt;
import de.locodoko.partie.ereignisse.NaechsterSpielerErwartet;
import de.locodoko.partie.ereignisse.SchweinchenGemeldet;
import de.locodoko.partie.ereignisse.VorbehaltErwartet;
import de.locodoko.spieler.SpielerEntity;
import de.locodoko.tisch.persistenz.PartieRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.List;
import java.util.Optional;

/**
 * Orchestriert KI-Zuege im Tisch-Kontext.
 *
 * <p>Lauscht auf Spielereignisse ({@link NaechsterSpielerErwartet}, {@link VorbehaltErwartet},
 * {@link KiUebernahmeEreignis}) und fuehrt KI-Zuege synchron in einer Schleife aus, bis
 * ein menschlicher Spieler am Zug ist oder die gesamte Partie beendet ist.</p>
 *
 * <p>Kapselt alle Tisch-Infrastruktur-Abhaengigkeiten (Repository, Echtzeit-Kommunikation,
 * Partie-Lebenszyklus) und delegiert die reine KI-Entscheidungslogik an
 * {@link KiOrchestrierungService}. Wirft die KI-Strategie eine Exception, wird der Fehler
 * geloggt und der Spielstand bleibt unveraendert auf dem letzten persistierten Stand.</p>
 */
@Component
public class KiTischOrchestrator {

    private static final Logger LOGGER = LoggerFactory.getLogger(KiTischOrchestrator.class);
    /** Sicherheitslimit gegen Endlosschleifen (entspricht ca. 2 kompletten Partien). */
    private static final int MAXIMALE_KI_AKTIONEN = 500;

    private final KiOrchestrierungService kiOrchestrierungService;
    private final TischRepository tischRepository;
    private final PartieRepository partieRepository;
    private final TischEchtzeitService tischEchtzeitService;
    private final PartieLifecycleService partieLifecycleService;
    private final ApplicationEventPublisher eventPublisher;

    KiTischOrchestrator(
            KiOrchestrierungService kiOrchestrierungService,
            TischRepository tischRepository,
            PartieRepository partieRepository,
            TischEchtzeitService tischEchtzeitService,
            PartieLifecycleService partieLifecycleService,
            ApplicationEventPublisher eventPublisher) {
        this.kiOrchestrierungService = kiOrchestrierungService;
        this.tischRepository = tischRepository;
        this.partieRepository = partieRepository;
        this.tischEchtzeitService = tischEchtzeitService;
        this.partieLifecycleService = partieLifecycleService;
        this.eventPublisher = eventPublisher;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    void beiNaechsterSpielerErwartet(NaechsterSpielerErwartet ereignis) {
        tischRepository.findById(TischId.von(ereignis.tischId()))
                .ifPresent(this::automatisiereTisch);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    void beiVorbehaltErwartet(VorbehaltErwartet ereignis) {
        tischRepository.findById(TischId.von(ereignis.tischId()))
                .ifPresent(this::automatisiereTisch);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    void beiKiUebernahme(KiUebernahmeEreignis ereignis) {
        tischRepository.findById(ereignis.tischId())
                .ifPresent(this::automatisiereTisch);
    }

    /**
     * Fuehrt KI-Zuege synchron aus, bis ein menschlicher Spieler am Zug ist oder
     * die gesamte Partie beendet ist.
     *
     * <p>Direkt aufrufbar fuer Tests. Im Produktivbetrieb wird diese Methode
     * ueber die Event-Listener getriggert.</p>
     *
     * @param tisch der aktive Tisch mit laufender Partie
     */
    public void automatisiereTisch(TischEntity tisch) {
        MDC.put("tischId", tisch.id().toString());
        try {
            if (tisch.partie() == null || tisch.partie().statusAusDb() == PartieStatus.BEENDET) {
                return;
            }
            boolean hatMenschlichenSpieler = tisch.spieler().stream()
                    .anyMatch(s -> !s.istKi() && !s.istKiUebernommen());

            int anzahlAktionen = 0;
            while (anzahlAktionen++ < MAXIMALE_KI_AKTIONEN) {
                if (tisch.partie().statusAusDb() == PartieStatus.BEENDET) {
                    return;
                }
                Partie partie = tisch.partie();
                Spiel laufendesSpiel = findeLaufendesSpiel(partie);
                if (laufendesSpiel == null) {
                    return;
                }
                if (laufendesSpiel.phase() instanceof Spielphase.Auswertung
                        || laufendesSpiel.phase() instanceof Spielphase.GesamtstandAktualisieren) {
                    if (!verarbeiteSpielabschluss(tisch, partie, laufendesSpiel, hatMenschlichenSpieler)) {
                        return;
                    }
                    continue;
                }

                Optional<SpielerPosition> erwarteterSpielerOpt = laufendesSpiel.erwarteterSpieler();
                if (erwarteterSpielerOpt.isEmpty()) {
                    return;
                }
                SpielerPosition position = erwarteterSpielerOpt.get();
                SpielerEntity spielerAmZug = spielerFuerPosition(tisch, position);

                if (!spielerAmZug.istKi() && !spielerAmZug.istKiUebernommen()) {
                    return;
                }
                if (!fuehreKiZugAus(tisch, partie, laufendesSpiel, position, hatMenschlichenSpieler)) {
                    return;
                }
            }
            LOGGER.error("KI-Orchestrierung hat Sicherheitslimit von {} Aktionen erreicht [tischId={}]",
                    MAXIMALE_KI_AKTIONEN, tisch.id());
        } finally {
            MDC.clear();
        }
    }

    /**
     * Schliesst das laufende Spiel ab und startet das naechste.
     *
     * @return true = Schleife fortsetzen, false = Orchestrierung abbrechen
     */
    private boolean verarbeiteSpielabschluss(TischEntity tisch, Partie partie, Spiel laufendesSpiel,
            boolean hatMenschlichenSpieler) {
        try {
            Partie neuePartie = partie.schliesseAktuellesSpielAbUndStarteNaechstes();
            partieLifecycleService.uebernehmeDomainPartieAbschluss(tisch, laufendesSpiel, neuePartie);
            partieRepository.saveAndFlush(partie);
            if (neuePartie.istBeendet()) {
                return false;
            }
            // Menschliche Spieler erhalten Zeit fuer die Rundenauswertung.
            if (hatMenschlichenSpieler) {
                partieLifecycleService.veroeffentlicheSpielGestartet(tisch);
                eventPublisher.publishEvent(new VorbehaltErwartet(tisch.id()));
                return false;
            }
        } catch (Exception e) {
            LOGGER.error("Fehler beim Spielabschluss [tischId={}]: {}",
                    tisch.id(), e.getMessage(), e);
            return false;
        }
        return true;
    }

    /**
     * Fuehrt den naechsten KI-Zug aus und veroeffentlicht Echtzeit-Ereignisse.
     *
     * @return true = Schleife fortsetzen, false = Orchestrierung abbrechen (Fehler oder Sperr-Konflikt)
     */
    private boolean fuehreKiZugAus(TischEntity tisch, Partie partie, Spiel laufendesSpiel,
            SpielerPosition position, boolean hatMenschlichenSpieler) {
        KiSchwierigkeit schwierigkeit = tisch.konfiguration().kiSchwierigkeit();
        int einwurfZaehlerVorher = laufendesSpiel.einwurfZaehler();
        try {
            KiAktionErgebnis ergebnis = kiOrchestrierungService.fuehreAktionAus(
                    laufendesSpiel, position, schwierigkeit);
            partieRepository.saveAndFlush(partie);

            if (hatMenschlichenSpieler) {
                if (ergebnis.ereignisse().isEmpty()) {
                    // Vorbehalt-, Armut- oder Ansage-Aktion: Snapshot senden
                    if (ergebnis.naechsterStand().einwurfZaehler() > einwurfZaehlerVorher) {
                        veroeffentlicheEinwurfEreignisse(tisch);
                    } else {
                        veroeffentlicheAnsageEreignisse(tisch);
                    }
                } else {
                    veroeffentlicheKiEreignisse(tisch, ergebnis.ereignisse());
                }
            }
        } catch (OptimisticLockingFailureException e) {
            // Erwarteter Konflikt: gleichzeitiger Mensch-Zug hat gewonnen.
            // Das naechste AFTER_COMMIT-Event startet automatisch einen neuen Versuch.
            LOGGER.warn("Optimistischer Sperr-Konflikt bei KI-Zug [position={}, tischId={}] — erneuter Versuch folgt mit naechstem Event",
                    position, tisch.id());
            return false;
        } catch (Exception e) {
            LOGGER.error("KI-Strategie-Fehler [position={}, tischId={}]: {}",
                    position, tisch.id(), e.getMessage(), e);
            return false;
        }
        return true;
    }

    private Spiel findeLaufendesSpiel(Partie partie) {
        return partie.spiele().stream()
                .filter(s -> s.ergebnis().isEmpty())
                .reduce((a, b) -> b)
                .orElse(null);
    }

    private void veroeffentlicheKiEreignisse(TischEntity tisch, List<SpielEreignis> ereignisse) {
        // Domain-Events fuer Statistiken separat veroeffentlichen
        for (SpielEreignis ereignis : ereignisse) {
            switch (ereignis) {
                case SpielEreignis.StichAbgeschlossenEreignis sa -> {
                    for (SonderpunktEreignis sp : sa.sonderpunkte()) {
                        switch (sp.art()) {
                            case FUCHS_GEFANGEN ->
                                    eventPublisher.publishEvent(new FuchsGefangen(tisch.id(), sp.taeter(), sp.opfer()));
                            case KARLCHEN ->
                                    eventPublisher.publishEvent(new KarlchenGespielt(tisch.id(), sp.taeter()));
                            case DOPPELKOPF ->
                                    eventPublisher.publishEvent(new DoppelkopfGestochen(tisch.id(), sp.taeter()));
                        }
                    }
                }
                case SpielEreignis.SchweinchenGemeldet sg ->
                        eventPublisher.publishEvent(new SchweinchenGemeldet(tisch.id(), sg.spielerPosition()));
                default -> {} // KarteGespielt, HochzeitPartnerGefunden: keine Domain-Events
            }
        }
        // Pro Spieler: Einen Batch mit allen Ereignissen senden
        tisch.spieler().stream()
                .filter(s -> !s.istKi() && !s.istKiUebernommen() && s.sessionId() != null)
                .forEach(s -> {
                    PartieStandAntwort stand = PartieStandAntwort.aus(tisch, s.id());
                    List<PartieEreignisAntwort> partieEreignisse = ereignisse.stream()
                            .map(ereignis -> switch (ereignis) {
                                case SpielEreignis.KarteGespielt kg ->
                                        PartieEreignisAntwort.karteGespielt(stand, kg.position(), kg.karte().karteId());
                                case SpielEreignis.StichAbgeschlossenEreignis sa ->
                                        PartieEreignisAntwort.stichAbgeschlossen(stand, sa.sonderpunkte().stream()
                                                .map(sp -> new SonderpunktEreignisAntwort(sp.art().name(), sp.taeter(), sp.opfer()))
                                                .toList());
                                case SpielEreignis.SchweinchenGemeldet sg ->
                                        PartieEreignisAntwort.schweinchenGemeldet(stand, sg.spielerPosition());
                                case SpielEreignis.HochzeitPartnerGefunden hpg ->
                                        PartieEreignisAntwort.hochzeitPartnerGefunden(stand, hpg.partner());
                            })
                            .toList();
                    tischEchtzeitService.planeAnBenutzer(
                            s.sessionId(),
                            "/queue/partie/" + tisch.partie().id(),
                            new PartieEreignisBatch(stand.version(), partieEreignisse)
                    );
                });
    }

    private void veroeffentlicheAnsageEreignisse(TischEntity tisch) {
        if (tisch.partie() == null) {
            return;
        }
        tisch.spieler().stream()
                .filter(s -> !s.istKi() && !s.istKiUebernommen() && s.sessionId() != null)
                .forEach(s -> {
                    PartieStandAntwort stand = PartieStandAntwort.aus(tisch, s.id());
                    tischEchtzeitService.planeAnBenutzer(
                            s.sessionId(),
                            "/queue/partie/" + tisch.partie().id(),
                            new PartieEreignisBatch(stand.version(), List.of(PartieEreignisAntwort.ansageErfolgt(stand)))
                    );
                });
    }

    private void veroeffentlicheEinwurfEreignisse(TischEntity tisch) {
        if (tisch.partie() == null) {
            return;
        }
        tisch.spieler().stream()
                .filter(s -> !s.istKi() && !s.istKiUebernommen() && s.sessionId() != null)
                .forEach(s -> {
                    PartieStandAntwort stand = PartieStandAntwort.aus(tisch, s.id());
                    tischEchtzeitService.planeAnBenutzer(
                            s.sessionId(),
                            "/queue/partie/" + tisch.partie().id(),
                            new PartieEreignisBatch(stand.version(), List.of(PartieEreignisAntwort.spielGestartet(stand)))
                    );
                });
    }

    private SpielerEntity spielerFuerPosition(TischEntity tisch, SpielerPosition position) {
        List<SpielerPosition> positionen = SpielerPosition.standardReihenfolge();
        int index = positionen.indexOf(position);
        return tisch.spieler().get(index);
    }
}
