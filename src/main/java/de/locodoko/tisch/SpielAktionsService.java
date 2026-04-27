package de.locodoko.tisch;

import de.locodoko.karten.Karte;
import de.locodoko.partie.SpielerPosition;
import de.locodoko.karten.UngueltigerSpielzugException;
import de.locodoko.partie.Ansage;
import de.locodoko.partie.Partie;
import de.locodoko.partie.PartieId;
import de.locodoko.tisch.persistenz.PartieRepository;
import de.locodoko.partie.PartieStatus;
import de.locodoko.partie.Spiel;
import de.locodoko.partie.SpielAktion;
import de.locodoko.partie.SpielEreignis;
import de.locodoko.partie.SonderpunktEreignis;
import de.locodoko.partie.VorbehaltAnsage;
import de.locodoko.partie.ereignisse.NaechsterSpielerErwartet;
import de.locodoko.partie.ereignisse.SchweinchenGemeldet;
import de.locodoko.partie.ereignisse.VorbehaltErwartet;
import de.locodoko.spieler.SpielerEntity;
import de.locodoko.spieler.SpielerId;
import de.locodoko.spieler.SpielerRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import de.locodoko.partie.Spielphase;
import org.slf4j.MDC;

@Service
public class SpielAktionsService {

    private static final org.slf4j.Logger LOGGER = org.slf4j.LoggerFactory.getLogger(SpielAktionsService.class);

    private final TischRepository tischRepository;
    private final PartieRepository partieRepository;
    private final SpielerRepository spielerRepository;
    private final SpielRegistry spielRegistry;
    private final ApplicationEventPublisher eventPublisher;
    private final TischEchtzeitService tischEchtzeitService;

    public SpielAktionsService(
        TischRepository tischRepository,
        PartieRepository partieRepository,
        SpielerRepository spielerRepository,
        SpielRegistry spielRegistry,
        ApplicationEventPublisher eventPublisher,
        TischEchtzeitService tischEchtzeitService
    ) {
        this.tischRepository = tischRepository;
        this.partieRepository = partieRepository;
        this.spielerRepository = spielerRepository;
        this.spielRegistry = spielRegistry;
        this.eventPublisher = eventPublisher;
        this.tischEchtzeitService = tischEchtzeitService;
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
            SpielerEntity verwalteterSpieler = ladeSpieler(SpielerId.von(spieler.id()));
            TischEntity tisch = ladeAktivenTischMitSpieler(tischId, verwalteterSpieler);
            Spiel laufendesSpiel = ladeLaufendesSpiel(tisch.partie());
            SpielerPosition position = spielerPositionVon(tisch, verwalteterSpieler);
            laufendesSpiel.hydriere(tisch.konfiguration().alsSpielregeln());
            try {
                Spiel aktualisiertesSpiel = spielRegistry.mitSpielGesperrt(tischId, laufendesSpiel, spiel -> {
                    Spiel nachVorbehalt = spiel.meldeVorbehalt(position, vorbehalt);
                    Spiel finales = nachVorbehalt.phase() instanceof Spielphase.VorbehaltAufloesung
                        ? nachVorbehalt.loeseVorbehalteAuf()
                        : nachVorbehalt;
                    return new SpielUndErgebnis<>(finales, finales);
                });
                laufendesSpiel.uebernehmeDomainStand(aktualisiertesSpiel);
            } catch (IllegalStateException exception) {
                throw new SpielverwaltungKonfliktException("VORBEHALT_UNGUELTIG", exception.getMessage());
            }
            partieRepository.saveAndFlush(tisch.partie());
            synchronisiereRegistry(tischId, tisch);
            veroeffentlicheAnsageEreignisse(tisch);
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
            SpielerEntity verwalteterSpieler = ladeSpieler(SpielerId.von(spieler.id()));
            TischEntity tisch = ladeAktivenTischMitSpieler(tischId, verwalteterSpieler);
            Spiel laufendesSpiel = ladeLaufendesSpiel(tisch.partie());
            SpielerPosition position = spielerPositionVon(tisch, verwalteterSpieler);
            List<Karte> karten = parseKarten(kartenIds);
            laufendesSpiel.hydriere(tisch.konfiguration().alsSpielregeln());
            try {
                Spiel aktualisiertesSpiel = spielRegistry.mitSpielGesperrt(tischId, laufendesSpiel, spiel -> {
                    Spiel neu = spiel.armutStatus()
                        .filter(status -> position == status.armutSpieler() && !status.angebotLiegtVor())
                        .map(status -> spiel.legeArmutTrumpfkarten(position, karten))
                        .orElseGet(() -> angenommen
                            ? spiel.nimmArmutAn(position, karten)
                            : spiel.lehneArmutAb(position)
                        );
                    return new SpielUndErgebnis<>(neu, neu);
                });
                laufendesSpiel.uebernehmeDomainStand(aktualisiertesSpiel);
            } catch (IllegalStateException exception) {
                throw new SpielverwaltungKonfliktException("ARMUT_ANTWORT_UNGUELTIG", exception.getMessage());
            }
            partieRepository.saveAndFlush(tisch.partie());
            synchronisiereRegistry(tischId, tisch);
            veroeffentlicheAnsageEreignisse(tisch);
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
            SpielerEntity verwalteterSpieler = ladeSpieler(SpielerId.von(spieler.id()));
            TischEntity tisch = ladeAktivenTischMitSpieler(tischId, verwalteterSpieler);
            Spiel laufendesSpiel = ladeLaufendesSpiel(tisch.partie());
            SpielerPosition position = spielerPositionVon(tisch, verwalteterSpieler);
            laufendesSpiel.hydriere(tisch.konfiguration().alsSpielregeln());
            boolean schweinchenVorher = laufendesSpiel.schweinchenGemeldetVon().isPresent();
            SpielRegistry.KommandoSchluessel schluessel = new SpielRegistry.KommandoSchluessel(
                tischId.wert(), position, "KARTE:" + karteId + ":" + laufendesSpiel.phase().name()
            );
            List<SpielEreignis> spielEreignisse;
            try {
                SpielAktion aktionsErgebnis = spielRegistry.mitSpielGesperrtIdempotent(tischId, laufendesSpiel, schluessel, spiel -> {
                    LOGGER.trace("Lock erworben (idempotent), spiele Karte {}", karteId);
                    SpielAktion aktion = spiel.spieleKarte(position, parseKarte(karteId));
                    return new SpielUndErgebnis<>(aktion.neuerStand(), aktion);
                });
                laufendesSpiel.uebernehmeDomainStand(aktionsErgebnis.neuerStand());
                spielEreignisse = aktionsErgebnis.ereignisse();
                LOGGER.trace("Domain-Stand uebernommen [events={}]", spielEreignisse.size());
            } catch (IllegalStateException | UngueltigerSpielzugException exception) {
                LOGGER.warn("Ungueltige Karte gespielt [spieler={}, karte={}]: {}", position, karteId, exception.getMessage());
                throw new SpielverwaltungKonfliktException("KARTE_UNGUELTIG", exception.getMessage());
            }
            partieRepository.saveAndFlush(tisch.partie());
            synchronisiereRegistry(tischId, tisch);
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
            SpielerEntity verwalteterSpieler = ladeSpieler(SpielerId.von(spieler.id()));
            TischEntity tisch = ladeAktivenTischMitSpieler(tischId, verwalteterSpieler);
            Spiel laufendesSpiel = ladeLaufendesSpiel(tisch.partie());
            SpielerPosition position = spielerPositionVon(tisch, verwalteterSpieler);
            laufendesSpiel.hydriere(tisch.konfiguration().alsSpielregeln());
            SpielRegistry.KommandoSchluessel schluessel = new SpielRegistry.KommandoSchluessel(
                tischId.wert(), position, "ANSAGE:" + ansage.name() + ":" + laufendesSpiel.phase().name()
            );
            try {
                Spiel aktualisiertesSpiel = spielRegistry.mitSpielGesperrtIdempotent(tischId, laufendesSpiel, schluessel, spiel -> {
                    Spiel neu = spiel.sageAn(position, ansage);
                    return new SpielUndErgebnis<>(neu, neu);
                });
                laufendesSpiel.uebernehmeDomainStand(aktualisiertesSpiel);
            } catch (IllegalStateException exception) {
                throw new SpielverwaltungKonfliktException("ANSAGE_UNGUELTIG", exception.getMessage());
            }
            partieRepository.saveAndFlush(tisch.partie());
            synchronisiereRegistry(tischId, tisch);
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
            .forEach(s -> tischEchtzeitService.planeAnBenutzer(
                s.sessionId(),
                "/queue/partie/" + tisch.partie().id(),
                PartieEreignisAntwort.ansageErfolgt(PartieStandAntwort.aus(tisch, s.id()))
            ));
    }

    private void veroeffentlicheSchweinchenEreignis(TischEntity tisch) {
        if (tisch.partie() == null) {
            return;
        }
        Spiel laufendesSpiel = ladeLaufendesSpiel(tisch.partie());
        laufendesSpiel.hydriere(tisch.konfiguration().alsSpielregeln());
        Optional<SpielerPosition> gemeldetVon = laufendesSpiel.schweinchenGemeldetVon();
        if (gemeldetVon.isPresent()) {
            eventPublisher.publishEvent(new SchweinchenGemeldet(tisch.id(), gemeldetVon.get()));
        }

        tisch.spieler().stream()
            .filter(s -> !s.istKi() && !s.istKiUebernommen() && s.sessionId() != null)
            .forEach(s -> tischEchtzeitService.planeAnBenutzer(
                s.sessionId(),
                "/queue/partie/" + tisch.partie().id(),
                PartieEreignisAntwort.schweinchenGemeldet(PartieStandAntwort.aus(tisch, s.id()))
            ));
    }

    private void veroeffentlicheSpielKarteEreignisse(TischEntity tisch, List<SpielEreignis> ereignisse) {
        if (tisch.partie() == null) {
            return;
        }
        for (SpielEreignis ereignis : ereignisse) {
            switch (ereignis) {
                case SpielEreignis.KarteGespielt kg -> sendeKarteGespielt(tisch);
                case SpielEreignis.StichAbgeschlossenEreignis sa -> sendeStichAbgeschlossen(tisch, sa.sonderpunkte());
                case SpielEreignis.SchweinchenGemeldet _ -> veroeffentlicheSchweinchenEreignis(tisch);
                case SpielEreignis.HochzeitPartnerGefunden hpg -> LOGGER.info("Hochzeit-Partner gefunden: {} [tischId={}]", hpg.partner(), tisch.id());
                default -> LOGGER.trace("Ignoriere Spielereignis: {}", ereignis);
            }
        }
        triggereKi(tisch);
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
        List<SonderpunktEreignisAntwort> sonderpunktDtos = sonderpunkte.stream()
            .map(sp -> new SonderpunktEreignisAntwort(sp.art().name(), sp.taeter(), sp.opfer()))
            .toList();
        tisch.spieler().stream()
            .filter(s -> !s.istKi() && !s.istKiUebernommen() && s.sessionId() != null)
            .forEach(s -> tischEchtzeitService.planeAnBenutzer(
                s.sessionId(),
                "/queue/partie/" + tisch.partie().id(),
                PartieEreignisAntwort.stichAbgeschlossen(PartieStandAntwort.aus(tisch, s.id()), sonderpunktDtos)
            ));
    }

    private void veroeffentlicheEreignisse(TischEntity tisch) {
        if (tisch.partie() == null) {
            return;
        }
        tisch.spieler().stream()
            .filter(s -> !s.istKi() && !s.istKiUebernommen() && s.sessionId() != null)
            .forEach(s -> tischEchtzeitService.planeAnBenutzer(
                s.sessionId(),
                "/queue/partie/" + tisch.partie().id(),
                PartieEreignisAntwort.karteGespielt(PartieStandAntwort.aus(tisch, s.id()))
            ));
        triggereKi(tisch);
    }

    private void triggereKi(TischEntity tisch) {
        if (tisch.partie().statusAusDb() != PartieStatus.BEENDET) {
            tisch.partie().spiele().stream()
                .filter(s -> s.ergebnisEmbeddable() == null)
                .reduce((a, b) -> b)
                .ifPresent(laufendesSpiel -> {
                    if ("VORBEHALT_ANSAGE".equals(laufendesSpiel.phasenName())) {
                        eventPublisher.publishEvent(new VorbehaltErwartet(tisch.id()));
                    } else {
                        eventPublisher.publishEvent(new NaechsterSpielerErwartet(tisch.id()));
                    }
                });
        }
    }

    /**
     * Synchronisiert den SpielRegistry-Eintrag nach einem vollstaendigen Aktionszyklus
     * (Human-Aktion + KI-Zuege). Registriert das aktuell laufende Spiel oder entfernt
     * den Eintrag, wenn die Partie beendet ist.
     */
    private void synchronisiereRegistry(TischId tischId, TischEntity tisch) {
        if (tisch.partie() == null) {
            spielRegistry.entferne(tischId);
            return;
        }
        tisch.partie().spiele().stream()
            .filter(s -> s.ergebnisEmbeddable() == null)
            .reduce((a, b) -> b)
            .ifPresentOrElse(
                s -> {
                    s.hydriere(tisch.konfiguration().alsSpielregeln());
                    spielRegistry.registriere(tischId, s);
                },
                () -> spielRegistry.entferne(tischId)
            );
    }

    private TischEntity ladeTischFuerPartie(PartieId partieId) {
        return tischRepository.findByPartieId(partieId)
            .orElseThrow(() -> new SpielverwaltungNichtGefundenException(
                "PARTIE_NICHT_GEFUNDEN",
                "Es wurde keine Partie mit der ID " + partieId + " gefunden."
            ));
    }

    private TischEntity ladeAktivenTischMitSpieler(TischId tischId, SpielerEntity spieler) {
        TischEntity tisch = ladeTischEntity(tischId);
        if (!tisch.enthaeltSpieler(spieler)) {
            throw new SpielverwaltungKonfliktException("SPIELER_NICHT_AM_TISCH", "Der Spieler sitzt nicht an diesem Tisch.");
        }
        if (tisch.status() != TischStatus.IM_SPIEL || tisch.partie() == null) {
            throw new SpielverwaltungKonfliktException("PARTIE_NICHT_AKTIV", "An diesem Tisch laeuft aktuell keine Partie.");
        }
        return tisch;
    }

    private TischEntity ladeTischEntity(TischId tischId) {
        return tischRepository.findById(tischId)
            .orElseThrow(() -> new SpielverwaltungNichtGefundenException(
                "TISCH_NICHT_GEFUNDEN",
                "Es wurde kein Tisch mit der ID " + tischId + " gefunden."
            ));
    }

    private Spiel ladeLaufendesSpiel(Partie partie) {
        return partie.spiele().stream()
            .filter(spiel -> spiel.ergebnisEmbeddable() == null)
            .reduce((erstes, zweites) -> zweites)
            .orElseThrow(() -> new SpielverwaltungKonfliktException(
                "SPIEL_NICHT_AKTIV",
                "Die Partie besitzt aktuell kein laufendes Spiel."
            ));
    }

    private SpielerEntity ladeSpieler(SpielerId spielerId) {
        return spielerRepository.findById(spielerId)
            .orElseThrow(() -> new SpielverwaltungNichtGefundenException(
                "SPIELER_NICHT_GEFUNDEN",
                "Es wurde kein Spieler mit der ID " + spielerId + " gefunden."
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
