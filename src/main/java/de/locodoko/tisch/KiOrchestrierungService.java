package de.locodoko.tisch;

import de.locodoko.ki.KiArmutAntwort;
import de.locodoko.ki.KiSpielzustand;
import de.locodoko.ki.KiStrategie;
import de.locodoko.ki.KiStrategieFactory;
import de.locodoko.karten.Karte;
import de.locodoko.karten.Spielregeln;
import de.locodoko.partie.SpielerPosition;
import de.locodoko.partie.Ansage;
import de.locodoko.partie.Partei;
import de.locodoko.partie.Partie;
import de.locodoko.partie.Spiel;
import de.locodoko.partie.Spielergebnis;
import de.locodoko.partie.Spielphase;
import de.locodoko.partie.Sonderpunkt;
import de.locodoko.partie.SonderpunktEreignis;
import de.locodoko.partie.VorbehaltAnsage;
import de.locodoko.partie.ereignisse.SpielBeendet;
import de.locodoko.tisch.persistenz.PartieRepository;
import de.locodoko.partie.PartieStatus;
import de.locodoko.spieler.SpielerEntity;
import de.locodoko.spieler.SpielerRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

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

    private final KiStrategieFactory kiStrategieFactory;
    private final SpielerRepository spielerRepository;
    private final TischRepository tischRepository;
    private final PartieRepository partieRepository;
    private final TischEchtzeitService tischEchtzeitService;
    private final SpielRegistry spielRegistry;
    private final ApplicationEventPublisher eventPublisher;

    public KiOrchestrierungService(
        KiStrategieFactory kiStrategieFactory,
        SpielerRepository spielerRepository,
        TischRepository tischRepository,
        PartieRepository partieRepository,
        TischEchtzeitService tischEchtzeitService,
        SpielRegistry spielRegistry,
        ApplicationEventPublisher eventPublisher
    ) {
        this.kiStrategieFactory = kiStrategieFactory;
        this.spielerRepository = spielerRepository;
        this.tischRepository = tischRepository;
        this.partieRepository = partieRepository;
        this.tischEchtzeitService = tischEchtzeitService;
        this.spielRegistry = spielRegistry;
        this.eventPublisher = eventPublisher;
    }

    public void automatisiereTisch(TischEntity tisch) {
        Objects.requireNonNull(tisch, "tisch darf nicht null sein");
        if (tisch.partie() == null || tisch.partie().statusAusDb() == PartieStatus.BEENDET) {
            return;
        }
        Spiel startSpiel = findeLaufendesSpiel(tisch.partie());
        String startPhase = startSpiel != null ? startSpiel.phasenName() : null;
        LOGGER.info("KI-Orchestrierung gestartet [tischId={}, spielphase={}]", tisch.id(), startPhase);
        int anzahlAktionen = 0;
        while (anzahlAktionen++ < MAXIMALE_KI_AKTIONEN) {
            if (tisch.partie().statusAusDb() == PartieStatus.BEENDET) {
                return;
            }
            Spiel laufendesSpiel = findeLaufendesSpiel(tisch.partie());
            if (laufendesSpiel == null) {
                return;
            }
            laufendesSpiel.hydriere(tisch.konfiguration().alsSpielregeln());
            if (laufendesSpiel.phase() instanceof Spielphase.Auswertung
                    || laufendesSpiel.phase() instanceof Spielphase.GesamtstandAktualisieren) {
                LOGGER.info("Spiel abschliessen und naechstes starten [spielNr={}, tischId={}]",
                    laufendesSpiel.spielNummer(), tisch.id());
                try {
                    Partie persistentePartie = tisch.partie();
                    persistentePartie.hydriere(tisch.konfiguration().alsSpielregeln());
                    Partie neuePartie = persistentePartie.schliesseAktuellesSpielAbUndStarteNaechstes();
                    veroeffentlicheSpielBeendet(tisch, laufendesSpiel);
                    uebernehmeDomainPartieAbschluss(tisch, laufendesSpiel, neuePartie);
                } catch (Exception e) {
                    LOGGER.error(
                        "Fehler beim Abschliessen von Spiel {} an Tisch {} – Partie bleibt im letzten konsistenten Stand: {}",
                        laufendesSpiel.spielNummer(), tisch.id(), e.getMessage(), e
                    );
                    return;
                }
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
                laufendesSpiel.uebernehmeDomainStand(naechsterStand);
                // Stichphase-Zug: nach jedem KI-Zug sofort speichern und an den Client senden,
                // damit der Client jede Karte mit 800ms Verzoegerung einzeln animieren kann.
                // Nur bei Tischen mit menschlichen Spielern – bei reinen KI-Partien laueft
                // die Orchestrierung ohne Zwischensaves durch.
                boolean hatMenschlichenSpieler = tisch.spieler().stream()
                    .anyMatch(s -> !s.istKi() && !s.istKiUebernommen());
                if (hatMenschlichenSpieler
                        && phaseVorAktion instanceof Spielphase.Stichphase
                        && naechsterStand.phase() instanceof Spielphase.Stichphase) {
                    partieRepository.saveAndFlush(tisch.partie());
                    synchronisiereRegistry(TischId.von(tisch.id()), tisch);
                    veroeffentlichePartieStand(tisch);
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

    private Spiel fuehreKiAktionAus(Spiel laufendesSpiel, SpielerPosition spielerPosition, KiStrategie strategie) {
        KiSpielzustand zustand = KiSpielzustand.aus(laufendesSpiel, spielerPosition);
        return switch (laufendesSpiel.phase()) {
            case Spielphase.VorbehaltAnsage _ -> {
                VorbehaltAnsage vorbehalt = strategie.waehleVorbehalt(zustand);
                LOGGER.info("KI meldet Vorbehalt [spielerId={}, vorbehalt={}]", spielerPosition, vorbehalt);
                Spiel spielNachVorbehalt = laufendesSpiel.meldeVorbehalt(spielerPosition, vorbehalt);
                yield spielNachVorbehalt.phase() instanceof Spielphase.VorbehaltAufloesung
                    ? spielNachVorbehalt.loeseVorbehalteAuf()
                    : spielNachVorbehalt;
            }
            case Spielphase.ArmutTausch _ -> {
                if (laufendesSpiel.armutStatus().filter(status -> status.armutSpieler() == spielerPosition && !status.angebotLiegtVor()).isPresent()) {
                    yield laufendesSpiel.legeArmutTrumpfkarten(spielerPosition, strategie.waehleArmutAngebot(zustand));
                }
                KiArmutAntwort armutAntwort = strategie.waehleArmutAntwort(zustand);
                yield armutAntwort.angenommen()
                    ? laufendesSpiel.nimmArmutAn(spielerPosition, armutAntwort.rueckgabekarten())
                    : laufendesSpiel.lehneArmutAb(spielerPosition);
            }
            case Spielphase.Stichphase _ -> {
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
     * Uebertraegt das Ergebnis von {@link Partie#schliesseAktuellesSpielAbUndStarteNaechstes()}
     * in die persistierte Partie.
     */
    private void uebernehmeDomainPartieAbschluss(TischEntity tisch, Spiel abgeschlossenesSpiel, Partie neuePartie) {
        Partie partie = tisch.partie();
        for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
            partie.setzeGesamtpunktestand(position, neuePartie.gesamtpunktestand().get(position));
        }
        partie.setzeBockrundenZaehlerDb(neuePartie.bockrundenZaehler());
        partie.setzeSolistDesLetztenSpielsDb(neuePartie.solistDesLetztenSpiels().orElse(null));
        abgeschlossenesSpiel.uebernehmeDomainStand(neuePartie.abgeschlosseneSpiele().getLast());
        if (neuePartie.istBeendet()) {
            partie.markiereAlsBeendet();
            return;
        }
        tisch.spieler().stream()
            .filter(s -> !s.istKi() && s.istKiUebernommen())
            .forEach(s -> {
                s.hebeKiUebernahmeAuf();
                spielerRepository.save(s);
            });
        Spiel neuesSpiel = neuePartie.aktuellesSpiel();
        neuesSpiel.setzeSpielNummer(partie.aktuellesSpielNummer() + 1);
        partie.fuegeSpielHinzu(neuesSpiel);
        LOGGER.info("Naechstes Spiel gestartet [tischId={}, spielNr={}]", tisch.id(), neuesSpiel.spielNummer());
    }

    private Spiel findeLaufendesSpiel(Partie partie) {
        return partie.spiele().stream()
            .reduce((erstes, zweites) -> zweites)
            .orElse(null);
    }

    private void veroeffentlicheSpielBeendet(TischEntity tisch, Spiel abgeschlossenesSpiel) {
        Spielergebnis ergebnis = abgeschlossenesSpiel.ergebnis().orElse(null);
        if (ergebnis == null) return;

        Map<SpielerPosition, SpielerEntity> positionZuSpieler = spielerNachPosition(tisch);
        boolean istSolo = abgeschlossenesSpiel.parteien() != null
            && abgeschlossenesSpiel.parteien().spielerVon(Partei.RE).size() == 1;

        Map<java.util.UUID, SpielBeendet.SpielerSpielDaten> spielerDaten = new HashMap<>();
        for (SpielerPosition pos : SpielerPosition.standardReihenfolge()) {
            SpielerEntity spieler = positionZuSpieler.get(pos);
            if (spieler == null) continue;

            Partei partei = abgeschlossenesSpiel.parteien().parteiVon(pos);
            boolean sieger = partei == ergebnis.siegerPartei();
            int spielpunkte = ergebnis.spielpunkteVon(pos).wert();

            int fuchsGefangen = 0, fuchsVerloren = 0, karlchen = 0, doppelkoepfe = 0;
            for (var sonderpunkte : ergebnis.sonderpunkteProPartei().values()) {
                for (SonderpunktEreignis sp : sonderpunkte) {
                    if (sp.art() == Sonderpunkt.FUCHS_GEFANGEN && sp.taeter() == pos) fuchsGefangen++;
                    if (sp.art() == Sonderpunkt.FUCHS_GEFANGEN && sp.opfer() == pos) fuchsVerloren++;
                    if (sp.art() == Sonderpunkt.KARLCHEN && sp.taeter() == pos) karlchen++;
                    if (sp.art() == Sonderpunkt.DOPPELKOPF && sp.taeter() == pos) doppelkoepfe++;
                }
            }

            boolean solist = istSolo && abgeschlossenesSpiel.parteien().spielerVon(Partei.RE).contains(pos);
            spielerDaten.put(spieler.id(), new SpielBeendet.SpielerSpielDaten(
                sieger, spielpunkte, fuchsGefangen, fuchsVerloren, karlchen, doppelkoepfe, solist
            ));
        }

        eventPublisher.publishEvent(new SpielBeendet(
            tisch.id(), tisch.name(), abgeschlossenesSpiel.spielNummer(), Map.copyOf(spielerDaten)
        ));
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
                Spiel spiel = findeLaufendesSpiel(tisch.partie());
                if (spiel == null) {
                    continue;
                }
                spiel.hydriere(tisch.konfiguration().alsSpielregeln());
                // Auswertungsphase hat keinen erwarteten Spieler — trotzdem abschliessen,
                // damit Spiele nicht dauerhaft in AUSWERTUNG haengen bleiben.
                if (spiel.phase() instanceof Spielphase.Auswertung
                        || spiel.phase() instanceof Spielphase.GesamtstandAktualisieren) {
                    LOGGER.warn("Spiel in Auswertungsphase festgefahren, starte Abschluss [tischId={}]", tisch.id());
                    automatisiereTisch(tisch);
                    partieRepository.saveAndFlush(tisch.partie());
                    synchronisiereRegistry(TischId.von(tisch.id()), tisch);
                    veroeffentlichePartieStand(tisch);
                    continue;
                }
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
            .filter(s -> s.dbErgebnis() == null)
            .reduce((a, b) -> b)
            .ifPresentOrElse(
                s -> {
                    s.hydriere(tisch.konfiguration().alsSpielregeln());
                    spielRegistry.registriere(tischId, s);
                },
                () -> spielRegistry.entferne(tischId)
            );
    }

    private void veroeffentlichePartieStand(TischEntity tisch) {
        PartieStandAntwort broadcastStand = PartieStandAntwort.aus(tisch);
        tischEchtzeitService.planePartieEreignis(
            PartieEreignisAntwort.aktualisiert(PartieEreignisTyp.PARTIE_AKTUALISIERT, broadcastStand));
        tisch.spieler().stream()
            .filter(s -> !s.istKi() && !s.istKiUebernommen() && s.sessionId() != null)
            .forEach(s -> tischEchtzeitService.planeAnBenutzer(
                s.sessionId(),
                "/queue/partie/" + tisch.partie().id(),
                PartieEreignisAntwort.snapshot(PartieStandAntwort.aus(tisch, s.id()))
            ));
    }
}
