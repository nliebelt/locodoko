package de.locodoko.tisch;

import de.locodoko.karten.Karte;
import de.locodoko.partie.SpielerPosition;
import de.locodoko.karten.UngueltigerSpielzugException;
import de.locodoko.partie.SpielzugKonfliktException;
import de.locodoko.partie.Ansage;
import de.locodoko.partie.Partie;
import de.locodoko.partie.PartieId;
import de.locodoko.tisch.persistenz.PartieRepository;
import de.locodoko.partie.PartieStatus;
import de.locodoko.partie.Spiel;
import de.locodoko.partie.SpielEreignis;
import de.locodoko.partie.SonderpunktEreignis;
import de.locodoko.partie.VorbehaltAnsage;
import de.locodoko.partie.ereignisse.DoppelkopfGestochen;
import de.locodoko.partie.ereignisse.FuchsGefangen;
import de.locodoko.partie.ereignisse.KarlchenGespielt;
import de.locodoko.partie.ereignisse.NaechsterSpielerErwartet;
import de.locodoko.partie.ereignisse.VorbehaltErwartet;
import de.locodoko.spieler.SpielerEntity;
import de.locodoko.spieler.SpielerId;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import de.locodoko.partie.Spielphase;
import org.slf4j.MDC;

@Service
public class SpielAktionsService {

    private static final org.slf4j.Logger LOGGER = org.slf4j.LoggerFactory.getLogger(SpielAktionsService.class);

    private final TischRepository tischRepository;
    private final PartieRepository partieRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final TischEchtzeitService tischEchtzeitService;
    private final TischZugriff tischZugriff;

    public SpielAktionsService(
        TischRepository tischRepository,
        PartieRepository partieRepository,
        ApplicationEventPublisher eventPublisher,
        TischEchtzeitService tischEchtzeitService,
        TischZugriff tischZugriff
    ) {
        this.tischRepository = tischRepository;
        this.partieRepository = partieRepository;
        this.eventPublisher = eventPublisher;
        this.tischEchtzeitService = tischEchtzeitService;
        this.tischZugriff = tischZugriff;
    }

    @Transactional(readOnly = true)
    public PartieStandAntwort ladePartieStand(PartieId partieId) {
        MDC.put("partieId", partieId.toString());
        try {
            return PartieStandAntwort.aus(ladeTischFuerPartie(partieId));
        } finally {
            MDC.clear();
        }
    }

    @Transactional(readOnly = true)
    public PartieStandAntwort ladePartieStand(PartieId partieId, SpielerEntity spieler) {
        MDC.put("partieId", partieId.toString());
        try {
            return PartieStandAntwort.aus(ladeTischFuerPartie(partieId), spieler.id());
        } finally {
            MDC.clear();
        }
    }

    @Transactional(readOnly = true)
    public PartieStandAntwort ladePartieStand(PartieId partieId, SpielerEntity spieler, boolean debugModus) {
        MDC.put("partieId", partieId.toString());
        try {
            return PartieStandAntwort.aus(ladeTischFuerPartie(partieId), spieler.id(), debugModus);
        } finally {
            MDC.clear();
        }
    }

    @Transactional
    public PartieStandAntwort meldeVorbehalt(TischId tischId, SpielerEntity spieler, VorbehaltAnsage vorbehalt) {
        if (vorbehalt == null) {
            throw new IllegalArgumentException("Ein Vorbehalt muss angegeben werden.");
        }
        MDC.put("tischId", tischId.toString());
        try {
            SpielerEntity verwalteterSpieler = tischZugriff.ladeSpieler(SpielerId.von(spieler.id()));
            TischEntity tisch = ladeAktivenTischMitSpieler(tischId, verwalteterSpieler);
            Spiel laufendesSpiel = ladeLaufendesSpiel(tisch.partie());
            SpielerPosition position = spielerPositionVon(tisch, verwalteterSpieler);
            int einwurfZaehlerVorher = laufendesSpiel.einwurfZaehler();
            try {
                laufendesSpiel.meldeVorbehalt(position, vorbehalt);
                if (laufendesSpiel.phase() instanceof Spielphase.VorbehaltAufloesung) {
                    laufendesSpiel.loeseVorbehalteAuf();
                }
            } catch (SpielzugKonfliktException | UngueltigerSpielzugException exception) {
                throw new SpielverwaltungKonfliktException("VORBEHALT_UNGUELTIG", exception.getMessage());
            }
            partieRepository.saveAndFlush(tisch.partie());
            if (laufendesSpiel.einwurfZaehler() > einwurfZaehlerVorher) {
                veroeffentlicheEinwurfEreignisse(tisch);
            } else {
                veroeffentlicheAnsageEreignisse(tisch);
            }
            triggereKi(tisch);
            return PartieStandAntwort.aus(tisch, verwalteterSpieler.id());
        } finally {
            MDC.clear();
        }
    }

    @Transactional
    public PartieStandAntwort verarbeiteArmutAntwort(TischId tischId, SpielerEntity spieler, List<String> kartenIds, boolean angenommen) {
        MDC.put("tischId", tischId.toString());
        try {
            SpielerEntity verwalteterSpieler = tischZugriff.ladeSpieler(SpielerId.von(spieler.id()));
            TischEntity tisch = ladeAktivenTischMitSpieler(tischId, verwalteterSpieler);
            Spiel laufendesSpiel = ladeLaufendesSpiel(tisch.partie());
            SpielerPosition position = spielerPositionVon(tisch, verwalteterSpieler);
            List<Karte> karten = parseKarten(kartenIds);
            int einwurfZaehlerVorher = laufendesSpiel.einwurfZaehler();
            try {
                if (laufendesSpiel.armutStatus()
                        .filter(status -> position == status.armutSpieler() && !status.angebotLiegtVor())
                        .isPresent()) {
                    laufendesSpiel.legeArmutTrumpfkarten(position, karten);
                } else if (angenommen) {
                    laufendesSpiel.nimmArmutAn(position, karten);
                } else {
                    laufendesSpiel.lehneArmutAb(position);
                }
            } catch (SpielzugKonfliktException | UngueltigerSpielzugException exception) {
                throw new SpielverwaltungKonfliktException("ARMUT_ANTWORT_UNGUELTIG", exception.getMessage());
            }
            partieRepository.saveAndFlush(tisch.partie());
            if (laufendesSpiel.einwurfZaehler() > einwurfZaehlerVorher) {
                veroeffentlicheEinwurfEreignisse(tisch);
            } else {
                veroeffentlicheAnsageEreignisse(tisch);
            }
            triggereKi(tisch);
            return PartieStandAntwort.aus(tisch, verwalteterSpieler.id());
        } finally {
            MDC.clear();
        }
    }

    @Transactional
    public PartieStandAntwort spieleKarte(TischId tischId, SpielerEntity spieler, String karteId) {
        MDC.put("tischId", tischId.toString());
        try {
            LOGGER.debug("AKTION spieleKarte [spielerId={}, karteId={}]", spieler.id(), karteId);
            SpielerEntity verwalteterSpieler = tischZugriff.ladeSpieler(SpielerId.von(spieler.id()));
            TischEntity tisch = ladeAktivenTischMitSpieler(tischId, verwalteterSpieler);
            Spiel laufendesSpiel = ladeLaufendesSpiel(tisch.partie());
            SpielerPosition position = spielerPositionVon(tisch, verwalteterSpieler);
            List<SpielEreignis> spielEreignisse;
            try {
                LOGGER.trace("Spiele Karte {}", karteId);
                spielEreignisse = laufendesSpiel.spieleKarte(position, parseKarte(karteId));
                LOGGER.trace("Domain-Stand aktualisiert [events={}]", spielEreignisse.size());
            } catch (UngueltigerSpielzugException exception) {
                LOGGER.warn("Regelverstoß beim Kartenspielen [spieler={}, karte={}]: {}", position, karteId, exception.getMessage());
                if (tisch.partie() != null && verwalteterSpieler.sessionId() != null) {
                    PartieStandAntwort stand = PartieStandAntwort.aus(tisch, verwalteterSpieler.id());
                    tischEchtzeitService.planeAnBenutzer(
                        verwalteterSpieler.sessionId(),
                        "/queue/partie/" + tisch.partie().id(),
                        new PartieEreignisBatch(stand.version(), List.of(PartieEreignisAntwort.aktionAbgelehnt(stand, "KARTE_UNGUELTIG")))
                    );
                }
                throw exception;
            } catch (SpielzugKonfliktException exception) {
                LOGGER.warn("Ungueltige Karte gespielt [spieler={}, karte={}]: {}", position, karteId, exception.getMessage());
                if (tisch.partie() != null && verwalteterSpieler.sessionId() != null) {
                    PartieStandAntwort stand = PartieStandAntwort.aus(tisch, verwalteterSpieler.id());
                    tischEchtzeitService.planeAnBenutzer(
                        verwalteterSpieler.sessionId(),
                        "/queue/partie/" + tisch.partie().id(),
                        new PartieEreignisBatch(stand.version(), List.of(PartieEreignisAntwort.aktionAbgelehnt(stand, "KARTE_UNGUELTIG")))
                    );
                }
                throw new SpielverwaltungKonfliktException("KARTE_UNGUELTIG", exception.getMessage());
            }
            partieRepository.saveAndFlush(tisch.partie());
            veroeffentlicheSpielKarteEreignisse(tisch, spielEreignisse);
            LOGGER.debug("Karte-Aktion abgeschlossen");
            return PartieStandAntwort.aus(tisch, verwalteterSpieler.id());
        } finally {
            MDC.clear();
        }
    }

    @Transactional
    public PartieStandAntwort sageAn(TischId tischId, SpielerEntity spieler, Ansage ansage) {
        if (ansage == null) {
            throw new IllegalArgumentException("Eine Ansage muss angegeben werden.");
        }
        MDC.put("tischId", tischId.toString());
        try {
            SpielerEntity verwalteterSpieler = tischZugriff.ladeSpieler(SpielerId.von(spieler.id()));
            TischEntity tisch = ladeAktivenTischMitSpieler(tischId, verwalteterSpieler);
            Spiel laufendesSpiel = ladeLaufendesSpiel(tisch.partie());
            SpielerPosition position = spielerPositionVon(tisch, verwalteterSpieler);
            try {
                laufendesSpiel.sageAn(position, ansage);
            } catch (SpielzugKonfliktException | UngueltigerSpielzugException exception) {
                throw new SpielverwaltungKonfliktException("ANSAGE_UNGUELTIG", exception.getMessage());
            }
            partieRepository.saveAndFlush(tisch.partie());
            veroeffentlicheAnsageEreignisse(tisch);
            triggereKi(tisch);
            return PartieStandAntwort.aus(tisch, verwalteterSpieler.id());
        } finally {
            MDC.clear();
        }
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

    private void veroeffentlicheSpielKarteEreignisse(TischEntity tisch, List<SpielEreignis> spielEreignisse) {
        if (tisch.partie() == null) {
            return;
        }
        // Domain-Events fuer Statistiken separat veroeffentlichen (Seiteneffekte)
        for (SpielEreignis spielEreignis : spielEreignisse) {
            if (spielEreignis instanceof SpielEreignis.StichAbgeschlossenEreignis sa) {
                for (SonderpunktEreignis sp : sa.sonderpunkte()) {
                    switch (sp.art()) {
                        case FUCHS_GEFANGEN -> eventPublisher.publishEvent(new FuchsGefangen(tisch.id(), sp.taeter(), sp.opfer()));
                        case KARLCHEN -> eventPublisher.publishEvent(new KarlchenGespielt(tisch.id(), sp.taeter()));
                        case DOPPELKOPF -> eventPublisher.publishEvent(new DoppelkopfGestochen(tisch.id(), sp.taeter()));
                    }
                }
            }
        }
        // Pro Spieler: Einen Batch mit allen Ereignissen senden
        tisch.spieler().stream()
            .filter(s -> !s.istKi() && !s.istKiUebernommen() && s.sessionId() != null)
            .forEach(s -> {
                PartieStandAntwort stand = PartieStandAntwort.aus(tisch, s.id());
                List<PartieEreignisAntwort> ereignisse = spielEreignisse.stream()
                    .map(spielEreignis -> switch (spielEreignis) {
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
                    new PartieEreignisBatch(stand.version(), ereignisse)
                );
            });
        triggereKi(tisch);
    }

    private void triggereKi(TischEntity tisch) {
        if (tisch.partie().statusAusDb() != PartieStatus.BEENDET) {
            tisch.partie().spiele().stream()
                .filter(s -> s.ergebnis().isEmpty())
                .reduce((a, b) -> b)
                .ifPresent(laufendesSpiel -> {
                    if (laufendesSpiel.phase() instanceof Spielphase.VorbehaltAnsage) {
                        eventPublisher.publishEvent(new VorbehaltErwartet(tisch.id()));
                    } else {
                        eventPublisher.publishEvent(new NaechsterSpielerErwartet(tisch.id()));
                    }
                });
        }
    }

    private TischEntity ladeTischFuerPartie(PartieId partieId) {
        return tischRepository.findByPartieId(partieId)
            .orElseThrow(() -> new SpielverwaltungNichtGefundenException(
                "PARTIE_NICHT_GEFUNDEN",
                "Es wurde keine Partie mit der ID " + partieId + " gefunden."
            ));
    }

    private TischEntity ladeAktivenTischMitSpieler(TischId tischId, SpielerEntity spieler) {
        TischEntity tisch = tischZugriff.ladeTischEntity(tischId);
        if (!tisch.enthaeltSpieler(spieler)) {
            throw new SpielverwaltungKonfliktException("SPIELER_NICHT_AM_TISCH", "Der Spieler sitzt nicht an diesem Tisch.");
        }
        if (tisch.status() != TischStatus.IM_SPIEL || tisch.partie() == null) {
            throw new SpielverwaltungKonfliktException("PARTIE_NICHT_AKTIV", "An diesem Tisch laeuft aktuell keine Partie.");
        }
        return tisch;
    }

    private Spiel ladeLaufendesSpiel(Partie partie) {
        return partie.spiele().stream()
            .filter(spiel -> spiel.ergebnis().isEmpty())
            .reduce((erstes, zweites) -> zweites)
            .orElseThrow(() -> new SpielverwaltungKonfliktException(
                "SPIEL_NICHT_AKTIV",
                "Die Partie besitzt aktuell kein laufendes Spiel."
            ));
    }

    private SpielerPosition spielerPositionVon(TischEntity tisch, SpielerEntity spieler) {
        List<SpielerEntity> spielerAmTisch = tisch.spieler();
        List<SpielerPosition> positionen = SpielerPosition.standardReihenfolge();
        for (int index = 0; index < spielerAmTisch.size() && index < positionen.size(); index++) {
            if (spielerAmTisch.get(index).id().equals(spieler.id())) {
                return positionen.get(index);
            }
        }
        throw new SpielverwaltungKonfliktException("SPIELER_NICHT_AM_TISCH", "Der Spieler sitzt nicht an diesem Tisch.");
    }

    private List<Karte> parseKarten(List<String> kartenIds) {
        if (kartenIds == null) {
            return List.of();
        }
        return kartenIds.stream().map(this::parseKarte).toList();
    }

    private Karte parseKarte(String karteId) {
        if (karteId == null || karteId.isBlank()) {
            throw new IllegalArgumentException("Karten-IDs duerfen nicht leer sein.");
        }
        String[] teile = karteId.split("-");
        if (teile.length != 3) {
            throw new IllegalArgumentException("Ungueltige Karten-ID: " + karteId);
        }
        return new Karte(
            de.locodoko.karten.Farbe.valueOf(teile[0]),
            de.locodoko.karten.Kartenwert.valueOf(teile[1]),
            Integer.parseInt(teile[2])
        );
    }
}
