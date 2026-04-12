package de.locodoko.lobby;

import de.locodoko.partie.ki.KiArmutAntwort;
import de.locodoko.partie.ki.KiSpielzustand;
import de.locodoko.partie.ki.KiStrategie;
import de.locodoko.partie.ki.KiStrategieFactory;
import de.locodoko.karten.Karte;
import de.locodoko.karten.SpielerPosition;
import de.locodoko.partie.Ansage;
import de.locodoko.partie.Partei;
import de.locodoko.partie.Partie;
import de.locodoko.partie.PunkteRechner;
import de.locodoko.partie.Spiel;
import de.locodoko.partie.Spielphase;
import de.locodoko.partie.VorbehaltAnsage;
import de.locodoko.partie.PartieEntity;
import de.locodoko.partie.PartieRepository;
import de.locodoko.partie.PartieStatus;
import de.locodoko.partie.SpielEntity;
import de.locodoko.session.PartieEreignisAntwort;
import de.locodoko.session.PartieEreignisTyp;
import de.locodoko.session.SpielerEntity;
import de.locodoko.session.SpielerRepository;
import de.locodoko.session.TischEchtzeitService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.annotation.PreDestroy;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Orchestriert KI-Zuege nach jeder menschlichen oder KI-Aktion.
 *
 * <p>Haengt in {@link TischService} nach Tischstart und nach jeder spielrelevanten Aktion
 * (Vorbehalt, Armut, Karte, Ansage). Gibt solange KI-Zuege aus, bis ein menschlicher Spieler
 * am Zug ist oder das Spiel endet. Wertet abgeschlossene Spiele aus, startet Folge-Spiele
 * innerhalb der Partie und markiert beendete Partien. Bei KI-Strategie-Exceptions wird
 * die Aktion geloggt und abgebrochen, ohne die Datenbank in einem inkonsistenten Zustand
 * zu hinterlassen.</p>
 */
@Service
public class KiOrchestrierungService {

    // Logger fuer Fehler und Sicherheitslimit-Warnungen
    private static final Logger LOGGER = LoggerFactory.getLogger(KiOrchestrierungService.class);

    private static final int MAXIMALE_KI_AKTIONEN = 512;

    // Mindestwartezeit zwischen zwei KI-Kartenzuegen in der Stichphase (ms)
    private static final long KI_KARTEN_VERZOEGERUNG_MS = 800;

    // Einzel-Thread-Scheduler fuer zeitverzoegerte KI-Zuege (Daemon-Thread, lebt nur solange die JVM laeuft)
    private final ScheduledExecutorService kiScheduler = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "ki-timing");
        t.setDaemon(true);
        return t;
    });

    private final KiStrategieFactory kiStrategieFactory;
    private final SpielerRepository spielerRepository;
    private final TischRepository tischRepository;
    private final PartieRepository partieRepository;
    private final TischEchtzeitService tischEchtzeitService;
    private final SpielRegistry spielRegistry;
    private final PunkteRechner punkteRechner = new PunkteRechner();

    public KiOrchestrierungService(
        KiStrategieFactory kiStrategieFactory,
        SpielerRepository spielerRepository,
        TischRepository tischRepository,
        PartieRepository partieRepository,
        TischEchtzeitService tischEchtzeitService,
        SpielRegistry spielRegistry
    ) {
        this.kiStrategieFactory = kiStrategieFactory;
        this.spielerRepository = spielerRepository;
        this.tischRepository = tischRepository;
        this.partieRepository = partieRepository;
        this.tischEchtzeitService = tischEchtzeitService;
        this.spielRegistry = spielRegistry;
    }

    public void automatisiereTisch(TischEntity tisch) {
        Objects.requireNonNull(tisch, "tisch darf nicht null sein");
        if (tisch.partie() == null || tisch.partie().status() == PartieStatus.BEENDET) {
            return;
        }
        SpielEntity startSpiel = findeLaufendesSpiel(tisch.partie());
        Spielphase startPhase = startSpiel != null ? startSpiel.phase() : null;
        LOGGER.info("KI-Orchestrierung gestartet [tischId={}, spielphase={}]", tisch.id(), startPhase);
        int anzahlAktionen = 0;
        while (anzahlAktionen++ < MAXIMALE_KI_AKTIONEN) {
            if (tisch.partie().status() == PartieStatus.BEENDET) {
                return;
            }
            SpielEntity laufendesSpielEntity = findeLaufendesSpiel(tisch.partie());
            if (laufendesSpielEntity == null) {
                return;
            }
            Spiel laufendesSpiel = SpielPersistenzAdapter.zuDomainSpiel(laufendesSpielEntity);
            if (laufendesSpiel.phase() == Spielphase.AUSWERTUNG
                    || laufendesSpiel.phase() == Spielphase.GESAMTSTAND_AKTUALISIEREN) {
                LOGGER.info("Spiel abschliessen und naechstes starten [spielNr={}, tischId={}]",
                    laufendesSpielEntity.spielNummer(), tisch.id());
                Partie partie = rekonstruierePartieDomain(tisch, laufendesSpielEntity, laufendesSpiel);
                Partie neuePartie = partie.schliesseAktuellesSpielAbUndStarteNaechstes(punkteRechner);
                uebernehmeDomainPartieAbschluss(tisch, laufendesSpielEntity, neuePartie);
                continue;
            }
            SpielerPosition erwarteterSpieler = laufendesSpiel.erwarteterSpieler().orElse(null);
            if (erwarteterSpieler == null) {
                return;
            }
            SpielerEntity spielerEntity = spielerNachPosition(tisch).get(erwarteterSpieler);
            // Normale KI-Spieler oder menschliche Spieler, deren Steuerung nach einem
            // Verbindungsabbruch an die KI übergeben wurde, werden weiter orchestriert
            if (spielerEntity == null || (!spielerEntity.istKi() && !spielerEntity.istKiUebernommen())) {
                return;
            }
            LOGGER.info("KI-Spielzug [spielerId={}, phase={}]", erwarteterSpieler, laufendesSpiel.phase());
            // KI-Strategie-Exceptions abfangen: Die Partie bleibt im letzten konsistenten
            // Datenbankstand, weil uebernehmeDomainSpiel erst nach dem KI-Aufruf aufgerufen wird.
            // Ohne diesen Schutz haengt die Partie permanent, weil jeder folgende Aufruf
            // dieselbe Exception erzeugen wuerde.
            try {
                KiStrategie strategie = kiStrategieFactory.erzeuge(tisch.konfiguration().kiSchwierigkeit());
                Spielphase phaseVorAktion = laufendesSpiel.phase();
                Spiel naechsterStand = fuehreKiAktionAus(laufendesSpiel, erwarteterSpieler, strategie);
                SpielPersistenzAdapter.uebernehmeDomainSpiel(laufendesSpielEntity, naechsterStand);
                // Stichphase-Zug: naechsten KI-Zug zeitverzoegert ausloesen, damit jede
                // KI-Karte einzeln animiert im Frontend erscheint (Timing-Feature).
                // Nur wenn ein menschlicher Spieler am Tisch sitzt – bei reinen KI-Partien
                // bleibt der synchrone Durchlauf erhalten.
                boolean hatMenschlichenSpieler = tisch.spieler().stream()
                    .anyMatch(s -> !s.istKi());
                if (hatMenschlichenSpieler
                        && phaseVorAktion == Spielphase.STICHPHASE
                        && naechsterStand.phase() == Spielphase.STICHPHASE) {
                    SpielerPosition naechster = naechsterStand.erwarteterSpieler().orElse(null);
                    SpielerEntity naechsterSpielerEntity =
                        naechster != null ? spielerNachPosition(tisch).get(naechster) : null;
                if (naechsterSpielerEntity != null
                        && (naechsterSpielerEntity.istKi() || naechsterSpielerEntity.istKiUebernommen())
                        && !naechster.equals(erwarteterSpieler)) {
                    final TischId tischId = TischId.von(tisch.id());
                    kiScheduler.schedule(
                        () -> verzoegerteKiAktionAusfuehren(tischId),
                        KI_KARTEN_VERZOEGERUNG_MS,
                        TimeUnit.MILLISECONDS
                    );
                    return;
                }
                }
            } catch (Exception e) {
                LOGGER.error(
                    "KI-Strategie-Fehler fuer Spieler {} in Phase {} an Tisch {} – Partie bleibt im letzten konsistenten Stand: {}",
                    erwarteterSpieler, laufendesSpiel.phase(), tisch.id(), e.getMessage(), e
                );
                return;
            }
        }
        LOGGER.error("KI-Orchestrierung hat das Sicherheitslimit von {} Aktionen an Tisch {} erreicht – moegliche Endlosschleife.",
            MAXIMALE_KI_AKTIONEN, tisch.id());
        throw new IllegalStateException("Die KI-Orchestrierung hat das Sicherheitslimit erreicht.");
    }

    @PreDestroy
    public void beende() {
        kiScheduler.shutdownNow();
    }

    /**
     * Laedt den Tisch neu aus der Datenbank und fuehrt genau einen verzoegerten KI-Zug aus.
     * Wird zeitverzoegert vom {@link #kiScheduler} aufgerufen, damit jede KI-Karte einzeln
     * im Frontend animiert werden kann. Falls der naechste Spieler danach ebenfalls eine KI
     * ist, wird ein weiterer Delay geplant.
     */
    @Transactional
    public void verzoegerteKiAktionAusfuehren(TischId tischId) {
        TischEntity tisch = tischRepository.findById(tischId).orElse(null);
        if (tisch == null || tisch.partie() == null || tisch.partie().status() == PartieStatus.BEENDET) {
            return;
        }
        fuehreVerzoegertenKiZugAus(tisch);
        partieRepository.saveAndFlush(tisch.partie());
        synchronisiereRegistry(tischId, tisch);
        veroeffentlichePartieStand(tisch);
    }

    /**
     * Fuehrt exakt einen KI-Zug in der Stichphase aus. Falls danach erneut eine KI
     * an der Reihe ist (und Menschen am Tisch sitzen), wird ein weiterer Delay geplant.
     * Andernfalls wird automatisiereTisch aufgerufen um etwaige Folgephasen abzuschliessen.
     */
    private void fuehreVerzoegertenKiZugAus(TischEntity tisch) {
        if (tisch.partie() == null || tisch.partie().status() == PartieStatus.BEENDET) {
            return;
        }
        SpielEntity laufendesSpielEntity = findeLaufendesSpiel(tisch.partie());
        if (laufendesSpielEntity == null) {
            return;
        }
        Spiel laufendesSpiel = SpielPersistenzAdapter.zuDomainSpiel(laufendesSpielEntity);
        if (laufendesSpiel.phase() != Spielphase.STICHPHASE) {
            // Nicht-Stichphase: vollstaendige Orchestrierung uebergeben
            automatisiereTisch(tisch);
            return;
        }
        SpielerPosition erwarteterSpieler = laufendesSpiel.erwarteterSpieler().orElse(null);
        if (erwarteterSpieler == null) {
            return;
        }
        SpielerEntity spielerEntity = spielerNachPosition(tisch).get(erwarteterSpieler);
        if (spielerEntity == null || (!spielerEntity.istKi() && !spielerEntity.istKiUebernommen())) {
            // Human ist dran – kein KI-Zug
            return;
        }
        LOGGER.info("KI-Spielzug (verzoegert) [spielerId={}, phase=STICHPHASE]", erwarteterSpieler);
        try {
            KiStrategie strategie = kiStrategieFactory.erzeuge(tisch.konfiguration().kiSchwierigkeit());
            Spiel naechsterStand = fuehreKiAktionAus(laufendesSpiel, erwarteterSpieler, strategie);
            SpielPersistenzAdapter.uebernehmeDomainSpiel(laufendesSpielEntity, naechsterStand);
            // Pruefen ob noch eine KI folgt (und Menschen am Tisch sind)
            boolean hatMenschlichenSpieler = tisch.spieler().stream().anyMatch(s -> !s.istKi());
            if (hatMenschlichenSpieler && naechsterStand.phase() == Spielphase.STICHPHASE) {
                SpielerPosition naechster = naechsterStand.erwarteterSpieler().orElse(null);
                SpielerEntity naechsterSpielerEntity = naechster != null ? spielerNachPosition(tisch).get(naechster) : null;
                if (naechsterSpielerEntity != null
                        && (naechsterSpielerEntity.istKi() || naechsterSpielerEntity.istKiUebernommen())) {
                    // Wenn derselbe KI-Spieler wieder dran ist (nach Ansage), direkt weiter ohne Delay
                    if (naechster.equals(erwarteterSpieler)) {
                        fuehreVerzoegertenKiZugAus(tisch);
                        return;
                    }
                    final TischId tischId = TischId.von(tisch.id());
                    kiScheduler.schedule(
                        () -> verzoegerteKiAktionAusfuehren(tischId),
                        KI_KARTEN_VERZOEGERUNG_MS,
                        TimeUnit.MILLISECONDS
                    );
                    return;
                }
            }
            // Naechster ist kein KI-Stichphase-Spieler: vollstaendige Orchestrierung fuer Folgephasen
            automatisiereTisch(tisch);
        } catch (Exception e) {
            LOGGER.error(
                "KI-Strategie-Fehler (verzoegert) fuer Spieler {} an Tisch {} – Partie bleibt im letzten konsistenten Stand: {}",
                erwarteterSpieler, tisch.id(), e.getMessage(), e
            );
        }
    }

    private Spiel fuehreKiAktionAus(Spiel laufendesSpiel, SpielerPosition spielerPosition, KiStrategie strategie) {
        KiSpielzustand zustand = KiSpielzustand.aus(laufendesSpiel, spielerPosition);
        return switch (laufendesSpiel.phase()) {
            case VORBEHALT_ANSAGE -> {
                VorbehaltAnsage vorbehalt = strategie.waehleVorbehalt(zustand);
                Spiel spielNachVorbehalt = laufendesSpiel.meldeVorbehalt(spielerPosition, vorbehalt);
                yield spielNachVorbehalt.phase() == Spielphase.VORBEHALT_AUFLOESUNG
                    ? spielNachVorbehalt.loeseVorbehalteAuf()
                    : spielNachVorbehalt;
            }
            case ARMUT_TAUSCH -> {
                if (laufendesSpiel.armutStatus().filter(status -> status.armutSpieler() == spielerPosition && !status.angebotLiegtVor()).isPresent()) {
                    yield laufendesSpiel.legeArmutTrumpfkarten(spielerPosition, strategie.waehleArmutAngebot(zustand));
                }
                KiArmutAntwort armutAntwort = strategie.waehleArmutAntwort(zustand);
                yield armutAntwort.angenommen()
                    ? laufendesSpiel.nimmArmutAn(spielerPosition, armutAntwort.rueckgabekarten())
                    : laufendesSpiel.lehneArmutAb(spielerPosition);
            }
            case STICHPHASE -> {
                // Pflichtansage hat absoluten Vorrang vor Kartenspielen (dreissigAugenPflicht)
                if (!laufendesSpiel.pflichtansageAusstehend().isEmpty()) {
                    Partei eigenePartei = laufendesSpiel.parteien().parteiVon(spielerPosition);
                    if (laufendesSpiel.pflichtansageAusstehend().contains(eigenePartei)) {
                        Ansage pflichtansage = eigenePartei == Partei.RE ? Ansage.RE : Ansage.KONTRA;
                        yield laufendesSpiel.sageAn(spielerPosition, pflichtansage);
                    }
                }
                Ansage ansage = strategie.waehleAnsage(zustand).orElse(null);
                if (ansage != null) {
                    yield laufendesSpiel.sageAn(spielerPosition, ansage);
                }
                Karte karte = strategie.waehleKarte(zustand);
                LOGGER.debug("KI spielt Karte [karte={}, spielerId={}]", karte, spielerPosition);
                yield laufendesSpiel.spieleKarte(spielerPosition, karte);
            }
            default -> laufendesSpiel;
        };
    }

    /**
     * Rekonstruiert das Domain-{@link Partie}-Objekt aus den persistierten Entities.
     * Wird benoetigt, um {@link Partie#schliesseAktuellesSpielAbUndStarteNaechstes(PunkteRechner)}
     * aufzurufen und die Domain-Logik sauber von der Persistenz zu trennen.
     */
    private Partie rekonstruierePartieDomain(TischEntity tisch, SpielEntity laufendesSpielEntity, Spiel laufendesSpiel) {
        PartieEntity partie = tisch.partie();
        List<Spiel> abgeschlosseneSpiele = partie.spiele().stream()
            .filter(s -> !s.equals(laufendesSpielEntity))
            .map(SpielPersistenzAdapter::zuDomainSpiel)
            .toList();
        return Partie.ausPersistiertemStand(
            partie.anzahlSpiele(),
            tisch.konfiguration().alsSpielregeln(),
            laufendesSpiel.geber(),
            abgeschlosseneSpiele,
            laufendesSpiel,
            partie.gesamtpunktestand(),
            partie.bockrundenZaehler(),
            partie.solistDesLetztenSpiels()
        );
    }

    /**
     * Uebertraegt das Ergebnis von {@link Partie#schliesseAktuellesSpielAbUndStarteNaechstes(PunkteRechner)}
     * in die persistierbaren Entities. Entkoppelt die Domain-Logik von der Persistenzkarte.
     */
    private void uebernehmeDomainPartieAbschluss(TischEntity tisch, SpielEntity abgeschlossenesSpielEntity, Partie neuePartie) {
        PartieEntity partie = tisch.partie();
        // Gesamtpunktestand, Bockrunden und Solist aus Domain uebernehmen
        for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
            partie.setzeGesamtpunktestand(position, neuePartie.gesamtpunktestand().get(position));
        }
        partie.setzeBockrundenZaehler(neuePartie.bockrundenZaehler());
        partie.setzeSolistDesLetztenSpiels(neuePartie.solistDesLetztenSpiels().orElse(null));
        // Abgeschlossenes Spiel in Entity uebernehmen (enthaelt Ergebnis, Punkte usw.)
        SpielPersistenzAdapter.uebernehmeDomainSpiel(
            abgeschlossenesSpielEntity, neuePartie.abgeschlosseneSpiele().getLast());
        if (neuePartie.istBeendet()) {
            partie.markiereAlsBeendet();
            return;
        }
        // Beim Start eines neuen Spiels: KI-Uebernahme fuer alle Spieler aufheben,
        // damit reconnectete Spieler wieder selbst spielen koennen
        tisch.spieler().stream()
            .filter(s -> !s.istKi() && s.istKiUebernommen())
            .forEach(s -> {
                s.hebeKiUebernahmeAuf();
                spielerRepository.save(s);
            });
        // Naechstes Spiel als Entity anlegen
        Spiel neuesSpiel = neuePartie.aktuellesSpiel();
        SpielEntity neuesSpielEntity = SpielEntity.neu(
            partie.aktuellesSpielNummer() + 1,
            neuesSpiel.geber(),
            neuesSpiel.spieltyp(),
            neuesSpiel.phase()
        );
        SpielPersistenzAdapter.uebernehmeDomainSpiel(neuesSpielEntity, neuesSpiel);
        partie.fuegeSpielHinzu(neuesSpielEntity);
        LOGGER.info("Naechstes Spiel gestartet [tischId={}, spielNr={}]", tisch.id(), neuesSpielEntity.spielNummer());
    }

    private SpielEntity findeLaufendesSpiel(PartieEntity partie) {
        return partie.spiele().stream()
            .reduce((erstes, zweites) -> zweites)
            .orElse(null);
    }

    private Map<SpielerPosition, SpielerEntity> spielerNachPosition(TischEntity tisch) {
        EnumMap<SpielerPosition, SpielerEntity> spielerNachPosition = new EnumMap<>(SpielerPosition.class);
        for (int index = 0; index < tisch.spieler().size() && index < SpielerPosition.standardReihenfolge().size(); index++) {
            spielerNachPosition.put(SpielerPosition.standardReihenfolge().get(index), tisch.spieler().get(index));
        }
        return Map.copyOf(spielerNachPosition);
    }

    /**
     * Sicherheitsnetz fuer haengende KI-Zuege.
     *
     * <p>Prueft alle 15 Sekunden ob ein aktiver Tisch auf einen KI-Spieler wartet,
     * der nicht von alleine agiert (z.B. nach einer Exception im letzten Zug).
     * Falls ja, wird automatisiereTisch() erneut aufgerufen und der aktuelle Stand
     * an alle Beteiligten gebroadcastet, damit die UI nicht eingefroren bleibt.</p>
     */
    @Scheduled(fixedDelay = 15_000)
    @Transactional
    public void behebeFestgefahreneKiTische() {
        List<TischEntity> aktiveTische = tischRepository.findAllByStatusOrderByErstelltAmAsc(TischStatus.IM_SPIEL);
        for (TischEntity tisch : aktiveTische) {
            try {
                SpielEntity laufendesSpielEntity = findeLaufendesSpiel(tisch.partie());
                if (laufendesSpielEntity == null) {
                    continue;
                }
                Spiel spiel = SpielPersistenzAdapter.zuDomainSpiel(laufendesSpielEntity);
                SpielerPosition erwartet = spiel.erwarteterSpieler().orElse(null);
                if (erwartet == null) {
                    continue;
                }
                SpielerEntity spielerEntity = spielerNachPosition(tisch).get(erwartet);
                if (spielerEntity == null || (!spielerEntity.istKi() && !spielerEntity.istKiUebernommen())) {
                    continue;
                }
                // KI ist dran, aber hat offensichtlich nicht agiert — erneut versuchen
                LOGGER.warn("Festgefahrener KI-Tisch entdeckt, starte Wiederherstellung [tischId={}, spieler={}]",
                    tisch.id(), erwartet);
                automatisiereTisch(tisch);
                partieRepository.saveAndFlush(tisch.partie());
                synchronisiereRegistry(TischId.von(tisch.id()), tisch);
                veroeffentlichePartieStand(tisch);
            } catch (Exception e) {
                LOGGER.error("Fehler beim Wiederherstellen von Tisch {} — wird uebersprungen: {}",
                    tisch.id(), e.getMessage(), e);
            }
        }
    }

    private void synchronisiereRegistry(TischId tischId, TischEntity tisch) {
        if (tisch.partie() == null) {
            spielRegistry.entferne(tischId);
            return;
        }
        tisch.partie().spiele().stream()
            .filter(s -> s.ergebnis() == null)
            .reduce((a, b) -> b)
            .ifPresentOrElse(
                s -> spielRegistry.registriere(tischId, SpielPersistenzAdapter.zuDomainSpiel(s)),
                () -> spielRegistry.entferne(tischId)
            );
    }

    private void veroeffentlichePartieStand(TischEntity tisch) {
        PartieStandAntwort broadcastStand = PartieStandAntwort.aus(tisch.partie());
        tischEchtzeitService.planePartieEreignis(
            PartieEreignisAntwort.aktualisiert(PartieEreignisTyp.PARTIE_AKTUALISIERT, broadcastStand));
        tisch.spieler().stream()
            .filter(s -> !s.istKi() && s.sessionId() != null)
            .forEach(s -> tischEchtzeitService.planeAnBenutzer(
                s.sessionId(),
                "/queue/partie/" + tisch.partie().id(),
                PartieEreignisAntwort.snapshot(PartieStandAntwort.aus(tisch.partie(), s.id()))
            ));
    }
}
