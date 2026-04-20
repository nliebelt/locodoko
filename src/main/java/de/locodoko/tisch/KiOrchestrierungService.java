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
import de.locodoko.partie.SpielAktion;
import de.locodoko.partie.SpielEreignis;
import de.locodoko.partie.Spielergebnis;
import de.locodoko.partie.Spielphase;
import de.locodoko.partie.Sonderpunkt;
import de.locodoko.partie.SonderpunktEreignis;
import de.locodoko.partie.VorbehaltAnsage;
import de.locodoko.partie.ereignisse.NaechsterSpielerErwartet;
import de.locodoko.partie.ereignisse.SpielBeendet;
import de.locodoko.partie.ereignisse.VorbehaltErwartet;
import de.locodoko.partie.PartieStatus;
import de.locodoko.spieler.SpielerEntity;
import de.locodoko.spieler.SpielerRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
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

    private record AktionsErgebnis(Spiel naechsterStand, @Nullable String gespielteKarteId, List<SpielEreignis> ereignisse) {}

    private final KiStrategieFactory kiStrategieFactory;
    private final SpielerRepository spielerRepository;
    private final TischEchtzeitService tischEchtzeitService;
    private final ApplicationEventPublisher eventPublisher;

    public KiOrchestrierungService(
        KiStrategieFactory kiStrategieFactory,
        SpielerRepository spielerRepository,
        TischEchtzeitService tischEchtzeitService,
        ApplicationEventPublisher eventPublisher
    ) {
        this.kiStrategieFactory = kiStrategieFactory;
        this.spielerRepository = spielerRepository;
        this.tischEchtzeitService = tischEchtzeitService;
        this.eventPublisher = eventPublisher;
    }

    /**
     * Fuehrt KI-Zuege aus, bis ein menschlicher Spieler am Zug ist oder das Spiel endet.
     *
     * @return {@code true} wenn mindestens eine KI-Aktion ausgefuehrt wurde (Zustand geaendert),
     *         {@code false} wenn der naechste Spieler menschlich ist und nichts geaendert wurde.
     */
    public boolean automatisiereTisch(TischEntity tisch) {
        Objects.requireNonNull(tisch, "tisch darf nicht null sein");
        if (tisch.partie() == null || tisch.partie().statusAusDb() == PartieStatus.BEENDET) {
            return false;
        }
        Spiel startSpiel = findeLaufendesSpiel(tisch.partie());
        String startPhase = startSpiel != null ? startSpiel.phasenName() : null;
        LOGGER.info("KI-Orchestrierung gestartet [tischId={}, spielphase={}]", tisch.id(), startPhase);
        int anzahlAktionen = 0;
        boolean hatKiGespielt = false;

        boolean hatMenschlichenSpieler = tisch.spieler().stream()
            .anyMatch(s -> !s.istKi() && !s.istKiUebernommen());
        while (anzahlAktionen++ < MAXIMALE_KI_AKTIONEN) {
            if (tisch.partie().statusAusDb() == PartieStatus.BEENDET) {
                return hatKiGespielt;
            }
            Spiel laufendesSpiel = findeLaufendesSpiel(tisch.partie());
            if (laufendesSpiel == null) {
                return hatKiGespielt;
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
                    uebernehmeDomainPartieAbschluss(tisch, laufendesSpiel, neuePartie);
                    
                    hatKiGespielt = true;
                    
                    // Wenn Menschen am Tisch sind, brechen wir hier ab, um ihnen Zeit fuer die
                    // Rundenauswertung zu geben. Die naechste Aktion wird via Event getriggert.
                    if (hatMenschlichenSpieler) {
                        triggereKi(tisch);
                        return hatKiGespielt;
                    }
                    // Rein virtuelle Tische (KI-only, z.B. in Tests) spielen sofort weiter.
                } catch (Exception e) {
                    LOGGER.error(
                        "Fehler beim Abschliessen von Spiel {} an Tisch {} – Partie bleibt im letzten konsistenten Stand: {}",
                        laufendesSpiel.spielNummer(), tisch.id(), e.getMessage(), e
                    );
                    return hatKiGespielt;
                }
                continue;
            }
            SpielerPosition erwarteterSpieler = laufendesSpiel.erwarteterSpieler().orElse(null);
            if (erwarteterSpieler == null) {
                return hatKiGespielt;
            }
            SpielerEntity spielerEntity = spielerNachPosition(tisch).get(erwarteterSpieler);
            if (spielerEntity == null || (!spielerEntity.istKi() && !spielerEntity.istKiUebernommen())) {
                return hatKiGespielt;
            }
            LOGGER.info("KI-Spielzug [spielerId={}, phase={}]", erwarteterSpieler, laufendesSpiel.phase());
            try {
                // Delay für menschliche Tische, um das Frontend nicht zu überfluten
                boolean menschAmTisch = tisch.spieler().stream().anyMatch(s -> !s.istKi() && !s.istKiUebernommen());
                if (menschAmTisch) {
                    Thread.sleep(600);
                }

                KiStrategie strategie = kiStrategieFactory.erzeuge(tisch.konfiguration().kiSchwierigkeit());
                Spielphase phaseVorAktion = laufendesSpiel.phase();
                boolean schweinchenVorher = laufendesSpiel.schweinchenGemeldetVon().isPresent();
                
                AktionsErgebnis aktionsErgebnis = fuehreKiAktionAus(laufendesSpiel, erwarteterSpieler, strategie);
                laufendesSpiel.uebernehmeDomainStand(aktionsErgebnis.naechsterStand());
                hatKiGespielt = true;

                // Schweinchen-Broadcast bei KI-Zug
                if (!schweinchenVorher && laufendesSpiel.schweinchenGemeldetVon().isPresent()) {
                    veroeffentlicheSchweinchenEreignis(tisch);
                }

                // Domain-Ereignisse broadcasten (Stichabschluss, Sonderpunkte)
                if (hatMenschlichenSpieler) {
                    veroeffentlicheSpielKarteEreignisse(tisch, aktionsErgebnis.ereignisse());
                }

                // KI-Karten sequenz broadcasten für die Animation (nur wenn nicht bereits durch stichAbgeschlossen abgedeckt)
                if (hatMenschlichenSpieler
                        && phaseVorAktion instanceof Spielphase.Stichphase
                        && aktionsErgebnis.gespielteKarteId() != null
                        && aktionsErgebnis.ereignisse().stream().noneMatch(e -> e instanceof SpielEreignis.StichAbgeschlossenEreignis)) {
                    List<GespielteKarteAntwort> sequenz = List.of(new GespielteKarteAntwort(erwarteterSpieler, aktionsErgebnis.gespielteKarteId()));
                    sendeKiZugSequenz(tisch, sequenz);
                }
            } catch (Exception e) {
                LOGGER.error(
                    "CRITICAL KI-CRASH: Spieler {} in Phase {} an Tisch {} – Fehler: {}",
                    erwarteterSpieler, laufendesSpiel.phase(), tisch.id(), e.getMessage(), e
                );
                return hatKiGespielt;
            }
        }
        LOGGER.error("KI-Orchestrierung hat das Sicherheitslimit von {} Aktionen an Tisch {} erreicht – moegliche Endlosschleife.",
            MAXIMALE_KI_AKTIONEN, tisch.id());
        throw new IllegalStateException("Die KI-Orchestrierung hat das Sicherheitslimit erreicht.");
    }

    private AktionsErgebnis fuehreKiAktionAus(Spiel laufendesSpiel, SpielerPosition spielerPosition, KiStrategie strategie) {
        KiSpielzustand zustand = KiSpielzustand.aus(laufendesSpiel, spielerPosition);
        return switch (laufendesSpiel.phase()) {
            case Spielphase.VorbehaltAnsage _ -> {
                VorbehaltAnsage vorbehalt = strategie.waehleVorbehalt(zustand);
                LOGGER.info("KI meldet Vorbehalt [spielerId={}, vorbehalt={}]", spielerPosition, vorbehalt);
                Spiel spielNachVorbehalt = laufendesSpiel.meldeVorbehalt(spielerPosition, vorbehalt);
                Spiel ergebnis = spielNachVorbehalt.phase() instanceof Spielphase.VorbehaltAufloesung
                    ? spielNachVorbehalt.loeseVorbehalteAuf()
                    : spielNachVorbehalt;
                yield new AktionsErgebnis(ergebnis, null, List.of());
            }
            case Spielphase.ArmutTausch _ -> {
                Spiel ergebnis;
                if (laufendesSpiel.armutStatus().filter(status -> status.armutSpieler() == spielerPosition && !status.angebotLiegtVor()).isPresent()) {
                    ergebnis = laufendesSpiel.legeArmutTrumpfkarten(spielerPosition, strategie.waehleArmutAngebot(zustand));
                } else {
                    KiArmutAntwort armutAntwort = strategie.waehleArmutAntwort(zustand);
                    ergebnis = armutAntwort.angenommen()
                        ? laufendesSpiel.nimmArmutAn(spielerPosition, armutAntwort.rueckgabekarten())
                        : laufendesSpiel.lehneArmutAb(spielerPosition);
                }
                yield new AktionsErgebnis(ergebnis, null, List.of());
            }
            case Spielphase.Stichphase _ -> {
                if (!laufendesSpiel.pflichtansageAusstehend().isEmpty()) {
                    Partei eigenePartei = laufendesSpiel.parteien().parteiVon(spielerPosition);
                    if (laufendesSpiel.pflichtansageAusstehend().contains(eigenePartei)) {
                        Ansage pflichtansage = eigenePartei == Partei.RE ? Ansage.RE : Ansage.KONTRA;
                        LOGGER.info("KI meldet Pflichtansage [spielerId={}, ansage={}]", spielerPosition, pflichtansage);
                        yield new AktionsErgebnis(laufendesSpiel.sageAn(spielerPosition, pflichtansage), null, List.of());
                    }
                }
                Ansage ansage = strategie.waehleAnsage(zustand).orElse(null);
                if (ansage != null) {
                    LOGGER.info("KI meldet Ansage [spielerId={}, ansage={}]", spielerPosition, ansage);
                    yield new AktionsErgebnis(laufendesSpiel.sageAn(spielerPosition, ansage), null, List.of());
                }
                Karte karte = strategie.waehleKarte(zustand);
                LOGGER.debug("KI spielt Karte [karte={}, spielerId={}]", karte, spielerPosition);
                String karteId = "%s-%s-%d".formatted(karte.farbe().name(), karte.wert().name(), karte.exemplarIndex());
                SpielAktion aktion = laufendesSpiel.spieleKarte(spielerPosition, karte);
                yield new AktionsErgebnis(aktion.neuerStand(), karteId, aktion.ereignisse());
            }
            default -> new AktionsErgebnis(laufendesSpiel, null, List.of());
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
            veroeffentlicheSpielBeendet(tisch, abgeschlossenesSpiel);
            return;
        }

        // SPIEL_BEENDET senden, solange das neue Spiel noch nicht in der Liste ist.
        // So enthaelt der Snapshot im Event das Ergebnis des alten Spiels, aber
        // noch nicht die neuen Karten/Phase des Folgespiels -> saubere Trennung.
        veroeffentlicheSpielBeendet(tisch, abgeschlossenesSpiel);

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

    private void triggereKi(TischEntity tisch) {
        if (tisch.partie().statusAusDb() != PartieStatus.BEENDET) {
            Spiel laufendesSpiel = findeLaufendesSpiel(tisch.partie());
            if (laufendesSpiel != null) {
                if ("VORBEHALT_ANSAGE".equals(laufendesSpiel.phasenName())) {
                    eventPublisher.publishEvent(new VorbehaltErwartet(tisch.id()));
                } else {
                    eventPublisher.publishEvent(new NaechsterSpielerErwartet(tisch.id()));
                }
            }
        }
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

        tisch.spieler().stream()
            .filter(s -> !s.istKi() && !s.istKiUebernommen() && s.sessionId() != null)
            .forEach(s -> tischEchtzeitService.planeAnBenutzer(
                s.sessionId(),
                "/queue/partie/" + tisch.partie().id(),
                PartieEreignisAntwort.spielBeendet(PartieStandAntwort.aus(tisch, s.id()))
            ));
    }

    private Map<SpielerPosition, SpielerEntity> spielerNachPosition(TischEntity tisch) {
        EnumMap<SpielerPosition, SpielerEntity> spielerNachPosition = new EnumMap<>(SpielerPosition.class);
        for (int index = 0; index < tisch.spieler().size() && index < SpielerPosition.standardReihenfolge().size(); index++) {
            spielerNachPosition.put(SpielerPosition.standardReihenfolge().get(index), tisch.spieler().get(index));
        }
        return Map.copyOf(spielerNachPosition);
    }

    private void sendeKiZugSequenz(TischEntity tisch, List<GespielteKarteAntwort> sequenz) {
        tisch.spieler().stream()
            .filter(s -> !s.istKi() && !s.istKiUebernommen() && s.sessionId() != null)
            .forEach(s -> tischEchtzeitService.planeAnBenutzer(
                s.sessionId(),
                "/queue/partie/" + tisch.partie().id(),
                PartieEreignisAntwort.kiZugSequenz(PartieStandAntwort.aus(tisch, s.id()), sequenz)
            ));
    }

    private void veroeffentlicheSpielKarteEreignisse(TischEntity tisch, List<SpielEreignis> ereignisse) {
        if (tisch.partie() == null) {
            return;
        }
        for (SpielEreignis ereignis : ereignisse) {
            switch (ereignis) {
                case SpielEreignis.KarteGespielt _ -> sendeKarteGespielt(tisch);
                case SpielEreignis.StichAbgeschlossenEreignis sa -> sendeStichAbgeschlossen(tisch, sa.sonderpunkte());
            }
        }
    }

    private void sendeKarteGespielt(TischEntity tisch) {
        tisch.spieler().stream()
            .filter(s -> !s.istKi() && !s.istKiUebernommen() && s.sessionId() != null)
            .forEach(s -> tischEchtzeitService.planeAnBenutzer(
                s.sessionId(),
                "/queue/partie/" + tisch.partie().id(),
                PartieEreignisAntwort.karteGespielt(PartieStandAntwort.aus(tisch, s.id()))
            ));
    }

    private void sendeStichAbgeschlossen(TischEntity tisch, List<SonderpunktEreignis> sonderpunkte) {
        tisch.spieler().stream()
            .filter(s -> !s.istKi() && !s.istKiUebernommen() && s.sessionId() != null)
            .forEach(s -> {
                List<SonderpunktEreignisAntwort> sonderpunktDtos = sonderpunkte.stream()
                    .map(sp -> SonderpunktEreignisAntwort.aus(sp, spielerNachPosition(tisch)))
                    .toList();
                tischEchtzeitService.planeAnBenutzer(
                    s.sessionId(),
                    "/queue/partie/" + tisch.partie().id(),
                    PartieEreignisAntwort.stichAbgeschlossen(PartieStandAntwort.aus(tisch, s.id()), sonderpunktDtos)
                );
            });
    }

    private void veroeffentlicheSchweinchenEreignis(TischEntity tisch) {
        if (tisch.partie() == null) {
            return;
        }
        tisch.spieler().stream()
            .filter(s -> !s.istKi() && !s.istKiUebernommen() && s.sessionId() != null)
            .forEach(s -> tischEchtzeitService.planeAnBenutzer(
                s.sessionId(),
                "/queue/partie/" + tisch.partie().id(),
                PartieEreignisAntwort.schweinchenGemeldet(PartieStandAntwort.aus(tisch, s.id()))
            ));
    }
}
