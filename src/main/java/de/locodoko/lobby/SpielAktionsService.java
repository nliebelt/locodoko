package de.locodoko.lobby;

import de.locodoko.karten.Karte;
import de.locodoko.karten.SpielerPosition;
import de.locodoko.karten.UngueltigerSpielzugException;
import de.locodoko.partie.Ansage;
import de.locodoko.partie.PartieEntity;
import de.locodoko.partie.PartieId;
import de.locodoko.partie.PartieRepository;
import de.locodoko.partie.Spiel;
import de.locodoko.partie.SpielEntity;
import de.locodoko.partie.VorbehaltAnsage;
import de.locodoko.session.SpielerEntity;
import de.locodoko.session.SpielerId;
import de.locodoko.session.SpielerRepository;
import de.locodoko.session.SpielverwaltungKonfliktException;
import de.locodoko.session.SpielverwaltungNichtGefundenException;
import de.locodoko.session.PartieEreignisAntwort;
import de.locodoko.session.PartieEreignisTyp;
import de.locodoko.session.TischEchtzeitService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import de.locodoko.partie.Spielphase;

@Service
public class SpielAktionsService {

    private final TischRepository tischRepository;
    private final PartieRepository partieRepository;
    private final SpielerRepository spielerRepository;
    private final KiOrchestrierungService kiOrchestrierungService;
    private final TischEchtzeitService tischEchtzeitService;
    private final SpielRegistry spielRegistry;

    public SpielAktionsService(
        TischRepository tischRepository,
        PartieRepository partieRepository,
        SpielerRepository spielerRepository,
        KiOrchestrierungService kiOrchestrierungService,
        TischEchtzeitService tischEchtzeitService,
        SpielRegistry spielRegistry
    ) {
        this.tischRepository = tischRepository;
        this.partieRepository = partieRepository;
        this.spielerRepository = spielerRepository;
        this.kiOrchestrierungService = kiOrchestrierungService;
        this.tischEchtzeitService = tischEchtzeitService;
        this.spielRegistry = spielRegistry;
    }

    @Transactional(readOnly = true)
    public PartieStandAntwort ladePartieStand(PartieId partieId) {
        return PartieStandAntwort.aus(ladePartieEntity(partieId));
    }

    @Transactional(readOnly = true)
    public PartieStandAntwort ladePartieStand(PartieId partieId, SpielerEntity spieler) {
        return PartieStandAntwort.aus(ladePartieEntity(partieId), spieler.id());
    }

    @Transactional(readOnly = true)
    public PartieStandAntwort ladePartieStand(PartieId partieId, SpielerEntity spieler, boolean debugModus) {
        return PartieStandAntwort.aus(ladePartieEntity(partieId), spieler.id(), debugModus);
    }

    @Transactional
    public PartieStandAntwort meldeVorbehalt(TischId tischId, SpielerEntity spieler, VorbehaltAnsage vorbehalt) {
        if (vorbehalt == null) {
            throw new IllegalArgumentException("Ein Vorbehalt muss angegeben werden.");
        }
        SpielerEntity verwalteterSpieler = ladeSpieler(SpielerId.von(spieler.id()));
        TischEntity tisch = ladeAktivenTischMitSpieler(tischId, verwalteterSpieler);
        SpielEntity laufendesSpielEntity = ladeLaufendesSpiel(tisch.partie());
        SpielerPosition position = spielerPositionVon(tisch.partie(), verwalteterSpieler);
        Spiel frischesSpiel = SpielPersistenzAdapter.zuDomainSpiel(laufendesSpielEntity);
        try {
            Spiel aktualisiertesSpiel = spielRegistry.mitSpielGesperrt(tischId, frischesSpiel, spiel -> {
                Spiel nachVorbehalt = spiel.meldeVorbehalt(position, vorbehalt);
                Spiel finales = nachVorbehalt.phase() == Spielphase.VORBEHALT_AUFLOESUNG
                    ? nachVorbehalt.loeseVorbehalteAuf()
                    : nachVorbehalt;
                return new SpielUndErgebnis<>(finales, finales);
            });
            SpielPersistenzAdapter.uebernehmeDomainSpiel(laufendesSpielEntity, aktualisiertesSpiel);
            kiOrchestrierungService.automatisiereTisch(tisch);
        } catch (IllegalStateException exception) {
            throw new SpielverwaltungKonfliktException("VORBEHALT_UNGUELTIG", exception.getMessage());
        }
        partieRepository.saveAndFlush(tisch.partie());
        synchronisiereRegistry(tischId, tisch);
        veroeffentlichePartieAktualisierung(tisch);
        return PartieStandAntwort.aus(tisch.partie(), verwalteterSpieler.id());
    }

    @Transactional
    public PartieStandAntwort verarbeiteArmutAntwort(TischId tischId, SpielerEntity spieler, List<String> kartenIds, boolean angenommen) {
        SpielerEntity verwalteterSpieler = ladeSpieler(SpielerId.von(spieler.id()));
        TischEntity tisch = ladeAktivenTischMitSpieler(tischId, verwalteterSpieler);
        SpielEntity laufendesSpielEntity = ladeLaufendesSpiel(tisch.partie());
        SpielerPosition position = spielerPositionVon(tisch.partie(), verwalteterSpieler);
        List<Karte> karten = parseKarten(kartenIds);
        Spiel frischesSpiel = SpielPersistenzAdapter.zuDomainSpiel(laufendesSpielEntity);
        try {
            Spiel aktualisiertesSpiel = spielRegistry.mitSpielGesperrt(tischId, frischesSpiel, spiel -> {
                Spiel neu = spiel.armutStatus()
                    .filter(status -> position == status.armutSpieler() && !status.angebotLiegtVor())
                    .map(status -> spiel.legeArmutTrumpfkarten(position, karten))
                    .orElseGet(() -> angenommen
                        ? spiel.nimmArmutAn(position, karten)
                        : spiel.lehneArmutAb(position)
                    );
                return new SpielUndErgebnis<>(neu, neu);
            });
            SpielPersistenzAdapter.uebernehmeDomainSpiel(laufendesSpielEntity, aktualisiertesSpiel);
            kiOrchestrierungService.automatisiereTisch(tisch);
        } catch (IllegalStateException exception) {
            throw new SpielverwaltungKonfliktException("ARMUT_ANTWORT_UNGUELTIG", exception.getMessage());
        }
        partieRepository.saveAndFlush(tisch.partie());
        synchronisiereRegistry(tischId, tisch);
        veroeffentlichePartieAktualisierung(tisch);
        return PartieStandAntwort.aus(tisch.partie(), verwalteterSpieler.id());
    }

    @Transactional
    public PartieStandAntwort spieleKarte(TischId tischId, SpielerEntity spieler, String karteId) {
        SpielerEntity verwalteterSpieler = ladeSpieler(SpielerId.von(spieler.id()));
        TischEntity tisch = ladeAktivenTischMitSpieler(tischId, verwalteterSpieler);
        SpielEntity laufendesSpielEntity = ladeLaufendesSpiel(tisch.partie());
        SpielerPosition position = spielerPositionVon(tisch.partie(), verwalteterSpieler);
        Spiel frischesSpiel = SpielPersistenzAdapter.zuDomainSpiel(laufendesSpielEntity);
        try {
            Spiel aktualisiertesSpiel = spielRegistry.mitSpielGesperrt(tischId, frischesSpiel, spiel -> {
                Spiel neu = spiel.spieleKarte(position, parseKarte(karteId));
                return new SpielUndErgebnis<>(neu, neu);
            });
            SpielPersistenzAdapter.uebernehmeDomainSpiel(laufendesSpielEntity, aktualisiertesSpiel);
            kiOrchestrierungService.automatisiereTisch(tisch);
        } catch (IllegalStateException | UngueltigerSpielzugException exception) {
            throw new SpielverwaltungKonfliktException("KARTE_UNGUELTIG", exception.getMessage());
        }
        partieRepository.saveAndFlush(tisch.partie());
        synchronisiereRegistry(tischId, tisch);
        veroeffentlichePartieAktualisierung(tisch);
        return PartieStandAntwort.aus(tisch.partie(), verwalteterSpieler.id());
    }

    @Transactional
    public PartieStandAntwort sageAn(TischId tischId, SpielerEntity spieler, Ansage ansage) {
        if (ansage == null) {
            throw new IllegalArgumentException("Eine Ansage muss angegeben werden.");
        }
        SpielerEntity verwalteterSpieler = ladeSpieler(SpielerId.von(spieler.id()));
        TischEntity tisch = ladeAktivenTischMitSpieler(tischId, verwalteterSpieler);
        SpielEntity laufendesSpielEntity = ladeLaufendesSpiel(tisch.partie());
        SpielerPosition position = spielerPositionVon(tisch.partie(), verwalteterSpieler);
        Spiel frischesSpiel = SpielPersistenzAdapter.zuDomainSpiel(laufendesSpielEntity);
        try {
            Spiel aktualisiertesSpiel = spielRegistry.mitSpielGesperrt(tischId, frischesSpiel, spiel -> {
                Spiel neu = spiel.sageAn(position, ansage);
                return new SpielUndErgebnis<>(neu, neu);
            });
            SpielPersistenzAdapter.uebernehmeDomainSpiel(laufendesSpielEntity, aktualisiertesSpiel);
            kiOrchestrierungService.automatisiereTisch(tisch);
        } catch (IllegalStateException exception) {
            throw new SpielverwaltungKonfliktException("ANSAGE_UNGUELTIG", exception.getMessage());
        }
        partieRepository.saveAndFlush(tisch.partie());
        synchronisiereRegistry(tischId, tisch);
        veroeffentlichePartieAktualisierung(tisch);
        return PartieStandAntwort.aus(tisch.partie(), verwalteterSpieler.id());
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
            .filter(s -> s.ergebnis() == null)
            .reduce((a, b) -> b)
            .ifPresentOrElse(
                s -> spielRegistry.registriere(tischId, SpielPersistenzAdapter.zuDomainSpiel(s)),
                () -> spielRegistry.entferne(tischId)
            );
    }

    private PartieEntity ladePartieEntity(PartieId partieId) {
        // Ueber TischRepository laden, damit befuelleTransienteFelder() ausgefuehrt wird
        // und PartieEntity.tisch() das transiente Tisch-Objekt mit Spielerliste enthaelt.
        // Das ist notwendig fuer PartieStandAntwort, die tisch.spieler() aufruft.
        return tischRepository.findByPartieId(partieId)
            .map(TischEntity::partie)
            .orElseGet(() -> partieRepository.findById(partieId)
                .orElseThrow(() -> new SpielverwaltungNichtGefundenException(
                    "PARTIE_NICHT_GEFUNDEN",
                    "Es wurde keine Partie mit der ID " + partieId + " gefunden."
                )));
    }

    private void veroeffentlichePartieAktualisierung(TischEntity tisch) {
        PartieStandAntwort broadcastStand = PartieStandAntwort.aus(tisch.partie());
        tischEchtzeitService.planePartieEreignis(PartieEreignisAntwort.aktualisiert(PartieEreignisTyp.PARTIE_AKTUALISIERT, broadcastStand));
        tisch.spieler().stream()
            .filter(spieler -> !spieler.istKi() && spieler.sessionId() != null)
            .forEach(spieler -> tischEchtzeitService.planeAnBenutzer(
                spieler.sessionId(),
                "/queue/partie/" + tisch.partie().id(),
                PartieEreignisAntwort.snapshot(PartieStandAntwort.aus(tisch.partie(), spieler.id()))
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

    private SpielEntity ladeLaufendesSpiel(PartieEntity partie) {
        return partie.spiele().stream()
            .filter(spiel -> spiel.ergebnis() == null)
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

    private SpielerPosition spielerPositionVon(PartieEntity partie, SpielerEntity spieler) {
        List<SpielerEntity> spielerAmTisch = partie.tisch().spieler();
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
