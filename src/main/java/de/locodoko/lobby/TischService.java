package de.locodoko.lobby;

import de.locodoko.karten.Kartendeck;
import de.locodoko.karten.Karte;
import de.locodoko.karten.UngueltigerSpielzugException;
import de.locodoko.karten.SpielerPosition;
import de.locodoko.partie.Ansage;
import de.locodoko.partie.Spiel;
import de.locodoko.partie.VorbehaltAnsage;
import de.locodoko.partie.PartieEntity;
import de.locodoko.partie.PartieRepository;
import de.locodoko.partie.HandEntity;
import de.locodoko.session.SpielerEntity;
import de.locodoko.session.SpielerRepository;
import de.locodoko.partie.SpielEntity;
import de.locodoko.lobby.TischEntity;
import de.locodoko.lobby.TischRepository;
import de.locodoko.lobby.TischStatus;
import de.locodoko.lobby.TischkonfigurationEmbeddable;
import de.locodoko.session.KiSpielerFabrik;
import de.locodoko.session.SpielverwaltungKonfliktException;
import de.locodoko.session.SpielverwaltungNichtGefundenException;
import de.locodoko.session.PartieEreignisAntwort;
import de.locodoko.session.PartieEreignisTyp;
import de.locodoko.session.TischEchtzeitService;
import de.locodoko.session.TischEreignisAntwort;
import de.locodoko.session.TischEreignisTyp;
import de.locodoko.session.TischlisteEreignisAntwort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class TischService {

    private final TischRepository tischRepository;
    private final PartieRepository partieRepository;
    private final SpielerRepository spielerRepository;
    private final KiSpielerFabrik kiSpielerFabrik;
    private final KiOrchestrierungService kiOrchestrierungService;
    private final TischEchtzeitService tischEchtzeitService;

    public TischService(
        TischRepository tischRepository,
        PartieRepository partieRepository,
        SpielerRepository spielerRepository,
        KiSpielerFabrik kiSpielerFabrik,
        KiOrchestrierungService kiOrchestrierungService,
        TischEchtzeitService tischEchtzeitService
    ) {
        this.tischRepository = tischRepository;
        this.partieRepository = partieRepository;
        this.spielerRepository = spielerRepository;
        this.kiSpielerFabrik = kiSpielerFabrik;
        this.kiOrchestrierungService = kiOrchestrierungService;
        this.tischEchtzeitService = tischEchtzeitService;
    }

    @Transactional(readOnly = true)
    public List<TischListenEintragAntwort> listeOffeneTische() {
        return tischRepository.findAllByStatusOrderByErstelltAmAsc(TischStatus.WARTEND)
            .stream()
            .map(TischListenEintragAntwort::aus)
            .toList();
    }

    @Transactional
    public TischAntwort erstelleTisch(SpielerEntity spieler, TischErstellenAnfrage anfrage) {
        SpielerEntity verwalteterSpieler = ladeSpieler(spieler.id());
        pruefeDassSpielerAnKeinemTischSitzt(verwalteterSpieler);
        TischkonfigurationEmbeddable konfiguration = anfrage.konfiguration() == null
            ? TischkonfigurationEmbeddable.standard()
            : anfrage.konfiguration().alsEmbeddable();
        TischEntity tisch = TischEntity.neu(anfrage.name(), verwalteterSpieler, konfiguration);
        tisch.fuegeSpielerHinzu(verwalteterSpieler);
        TischEntity gespeicherterTisch = tischRepository.saveAndFlush(tisch);
        TischAntwort antwort = TischAntwort.aus(gespeicherterTisch);
        veroeffentlicheTischAktualisierung(
            TischlisteEreignisAntwort.aktualisiert(listeOffeneTische()),
            TischEreignisAntwort.aktualisiert(TischEreignisTyp.TISCH_ERSTELLT, antwort)
        );
        return antwort;
    }

    @Transactional
    public TischAntwort betreteTisch(UUID tischId, SpielerEntity spieler) {
        SpielerEntity verwalteterSpieler = ladeSpieler(spieler.id());
        pruefeDassSpielerAnKeinemTischSitzt(verwalteterSpieler);
        TischEntity tisch = ladeTischEntityMitSperre(tischId);
        pruefeWartendenTisch(tisch, "TISCH_BEREITS_GESTARTET", "Ein gestarteter Tisch kann nicht mehr betreten werden.");
        if (tisch.istVoll()) {
            throw new SpielverwaltungKonfliktException("TISCH_VOLL", "Der Tisch ist bereits voll belegt.");
        }
        tisch.fuegeSpielerHinzu(verwalteterSpieler);
        TischEntity gespeicherterTisch = tischRepository.saveAndFlush(tisch);
        TischAntwort antwort = TischAntwort.aus(gespeicherterTisch);
        veroeffentlicheTischAktualisierung(
            TischlisteEreignisAntwort.aktualisiert(listeOffeneTische()),
            TischEreignisAntwort.aktualisiert(TischEreignisTyp.SPIELER_BEIGETRETEN, antwort)
        );
        return antwort;
    }

    @Transactional
    public BestaetigungAntwort verlasseTisch(UUID tischId, SpielerEntity spieler) {
        SpielerEntity verwalteterSpieler = ladeSpieler(spieler.id());
        TischEntity tisch = ladeTischEntityMitSperre(tischId);

        if (!tisch.enthaeltSpieler(verwalteterSpieler)) {
            throw new SpielverwaltungKonfliktException(
                "SPIELER_NICHT_AM_TISCH",
                "Der Spieler sitzt nicht an diesem Tisch."
            );
        }

        // Aktive Partie: Partie abbrechen und alle Spieler per Event zurueck zur Lobby schicken
        if (tisch.status() == TischStatus.IM_SPIEL) {
            return brichAktivePartieAb(tisch, verwalteterSpieler);
        }

        // Wartender Tisch: Spieler einfach entfernen (bisherige Logik)
        tisch.entferneSpieler(verwalteterSpieler);
        if (tisch.spieler().isEmpty()) {
            UUID geloeschterTischId = tisch.id();
            tischRepository.delete(tisch);
            tischRepository.flush();
            tischEchtzeitService.planeTischliste(TischlisteEreignisAntwort.aktualisiert(listeOffeneTische()));
            tischEchtzeitService.planeTischEreignis(TischEreignisAntwort.tischEntfernt(geloeschterTischId));
            return new BestaetigungAntwort("Tisch erfolgreich verlassen. Der leere Tisch wurde entfernt.");
        }
        if (tisch.erstelltVon().id().equals(verwalteterSpieler.id())) {
            tisch.setzeErstelltVon(tisch.spieler().getFirst());
        }
        TischEntity gespeicherterTisch = tischRepository.saveAndFlush(tisch);
        veroeffentlicheTischAktualisierung(
            TischlisteEreignisAntwort.aktualisiert(listeOffeneTische()),
            TischEreignisAntwort.aktualisiert(TischEreignisTyp.SPIELER_VERLASSEN, TischAntwort.aus(gespeicherterTisch))
        );
        return new BestaetigungAntwort("Tisch erfolgreich verlassen.");
    }

    /**
     * Bricht eine laufende Partie ab, weil ein Spieler den Tisch willentlich verlassen hat.
     *
     * <p>Die Partie wird als {@code ABGEBROCHEN} persistiert, alle Spieler am Tisch erhalten
     * ein {@code PARTIE_ABGEBROCHEN}-WebSocket-Event und werden dadurch zur Lobby zurueckgeleitet.
     * Danach wird der Tisch geloescht.</p>
     */
    private BestaetigungAntwort brichAktivePartieAb(TischEntity tisch, SpielerEntity verlassenderSpieler) {
        UUID tischId = tisch.id();
        if (tisch.partie() != null) {
            tisch.partie().markiereAlsAbgebrochen();
            partieRepository.saveAndFlush(tisch.partie());
        }
        tischRepository.delete(tisch);
        tischRepository.flush();
        tischEchtzeitService.planeTischliste(TischlisteEreignisAntwort.aktualisiert(listeOffeneTische()));
        tischEchtzeitService.planeTischEreignis(TischEreignisAntwort.partieAbgebrochen(tischId));
        return new BestaetigungAntwort("Partie abgebrochen. Alle Spieler wurden zur Lobby zurueckgeleitet.");
    }

    @Transactional
    public TischAntwort starteTisch(UUID tischId, SpielerEntity spieler) {
        SpielerEntity verwalteterSpieler = ladeSpieler(spieler.id());
        TischEntity tisch = ladeTischEntityMitSperre(tischId);
        pruefeWartendenTisch(tisch, "TISCH_BEREITS_GESTARTET", "Der Tisch wurde bereits gestartet.");
        if (!tisch.erstelltVon().id().equals(verwalteterSpieler.id())) {
            throw new SpielverwaltungKonfliktException(
                "TISCH_START_NICHT_ERLAUBT",
                "Nur der Tischersteller darf das Spiel starten."
            );
        }
        if (tisch.spieler().stream().noneMatch(spielerEntity -> !spielerEntity.istKi())) {
            throw new SpielverwaltungKonfliktException(
                "TISCH_START_NICHT_ERLAUBT",
                "Zum Starten muss mindestens ein menschlicher Spieler am Tisch sitzen."
            );
        }
        while (!tisch.istVoll()) {
            tisch.fuegeSpielerHinzu(kiSpielerFabrik.erzeugeNaechstenSpieler());
        }
        PartieEntity partie = PartieEntity.neu(tisch.konfiguration().anzahlSpiele());
        partie.fuegeSpielHinzu(erzeugeErstesSpiel(tisch));
        tisch.setzePartie(partie);
        TischEntity gespeicherterTisch = tischRepository.saveAndFlush(tisch);
        kiOrchestrierungService.automatisiereTisch(gespeicherterTisch);
        gespeicherterTisch = tischRepository.saveAndFlush(gespeicherterTisch);
        TischAntwort antwort = TischAntwort.aus(gespeicherterTisch);
        PartieStandAntwort partieStand = PartieStandAntwort.aus(gespeicherterTisch.partie());
        veroeffentlicheTischAktualisierung(
            TischlisteEreignisAntwort.aktualisiert(listeOffeneTische()),
            TischEreignisAntwort.spielGestartet(antwort, partieStand)
        );
        veroeffentlichePartieAktualisierung(gespeicherterTisch);
        return antwort;
    }

    @Transactional(readOnly = true)
    public TischKonfigurationDto ladeKonfiguration(UUID tischId) {
        return TischKonfigurationDto.aus(ladeTischEntity(tischId).konfiguration());
    }

    @Transactional
    public TischKonfigurationDto aktualisiereKonfiguration(
        UUID tischId,
        SpielerEntity spieler,
        TischKonfigurationDto konfiguration
    ) {
        SpielerEntity verwalteterSpieler = ladeSpieler(spieler.id());
        TischEntity tisch = ladeTischEntityMitSperre(tischId);
        pruefeWartendenTisch(
            tisch,
            "TISCH_KONFIGURATION_GESPERRT",
            "Die Tischkonfiguration darf nach Spielbeginn nicht mehr geaendert werden."
        );
        if (!tisch.erstelltVon().id().equals(verwalteterSpieler.id())) {
            throw new SpielverwaltungKonfliktException(
                "TISCH_KONFIGURATION_NICHT_ERLAUBT",
                "Nur der Tischersteller darf die Konfiguration aendern."
            );
        }
        tisch.aktualisiereKonfiguration(konfiguration.alsEmbeddable());
        TischEntity gespeicherterTisch = tischRepository.saveAndFlush(tisch);
        veroeffentlicheTischAktualisierung(
            TischlisteEreignisAntwort.aktualisiert(listeOffeneTische()),
            TischEreignisAntwort.aktualisiert(
                TischEreignisTyp.TISCH_KONFIGURATION_AKTUALISIERT,
                TischAntwort.aus(gespeicherterTisch)
            )
        );
        return TischKonfigurationDto.aus(gespeicherterTisch.konfiguration());
    }

    @Transactional(readOnly = true)
    public PartieStandAntwort ladePartieStand(UUID partieId) {
        return PartieStandAntwort.aus(ladePartieEntity(partieId));
    }

    @Transactional(readOnly = true)
    public PartieStandAntwort ladePartieStand(UUID partieId, SpielerEntity spieler) {
        return PartieStandAntwort.aus(ladePartieEntity(partieId), spieler.id());
    }

    @Transactional(readOnly = true)
    public PartieStandAntwort ladePartieStand(UUID partieId, SpielerEntity spieler, boolean debugModus) {
        return PartieStandAntwort.aus(ladePartieEntity(partieId), spieler.id(), debugModus);
    }

    @Transactional
    public PartieStandAntwort meldeVorbehalt(UUID tischId, SpielerEntity spieler, VorbehaltAnsage vorbehalt) {
        if (vorbehalt == null) {
            throw new IllegalArgumentException("Ein Vorbehalt muss angegeben werden.");
        }
        SpielerEntity verwalteterSpieler = ladeSpieler(spieler.id());
        TischEntity tisch = ladeAktivenTischMitSpieler(tischId, verwalteterSpieler);
        SpielEntity laufendesSpielEntity = ladeLaufendesSpiel(tisch.partie());
        SpielerPosition position = spielerPositionVon(tisch.partie(), verwalteterSpieler);
        Spiel laufendesSpiel = SpielPersistenzAdapter.zuDomainSpiel(laufendesSpielEntity);
        try {
            Spiel aktualisiertesSpiel = laufendesSpiel.meldeVorbehalt(position, vorbehalt);
            if (aktualisiertesSpiel.phase() == de.locodoko.partie.Spielphase.VORBEHALT_AUFLOESUNG) {
                aktualisiertesSpiel = aktualisiertesSpiel.loeseVorbehalteAuf();
            }
            SpielPersistenzAdapter.uebernehmeDomainSpiel(laufendesSpielEntity, aktualisiertesSpiel);
            kiOrchestrierungService.automatisiereTisch(tisch);
        } catch (IllegalStateException exception) {
            throw new SpielverwaltungKonfliktException("VORBEHALT_UNGUELTIG", exception.getMessage());
        }
        partieRepository.saveAndFlush(tisch.partie());
        veroeffentlichePartieAktualisierung(tisch);
        return PartieStandAntwort.aus(tisch.partie(), verwalteterSpieler.id());
    }

    @Transactional
    public PartieStandAntwort verarbeiteArmutAntwort(UUID tischId, SpielerEntity spieler, List<String> kartenIds, boolean angenommen) {
        SpielerEntity verwalteterSpieler = ladeSpieler(spieler.id());
        TischEntity tisch = ladeAktivenTischMitSpieler(tischId, verwalteterSpieler);
        SpielEntity laufendesSpielEntity = ladeLaufendesSpiel(tisch.partie());
        SpielerPosition position = spielerPositionVon(tisch.partie(), verwalteterSpieler);
        Spiel laufendesSpiel = SpielPersistenzAdapter.zuDomainSpiel(laufendesSpielEntity);
        List<Karte> karten = parseKarten(kartenIds);
        try {
            Spiel aktualisiertesSpiel = laufendesSpiel.armutStatus()
                .filter(status -> position == status.armutSpieler() && !status.angebotLiegtVor())
                .map(status -> laufendesSpiel.legeArmutTrumpfkarten(position, karten))
                .orElseGet(() -> angenommen
                    ? laufendesSpiel.nimmArmutAn(position, karten)
                    : laufendesSpiel.lehneArmutAb(position)
                );
            SpielPersistenzAdapter.uebernehmeDomainSpiel(laufendesSpielEntity, aktualisiertesSpiel);
            kiOrchestrierungService.automatisiereTisch(tisch);
        } catch (IllegalStateException exception) {
            throw new SpielverwaltungKonfliktException("ARMUT_ANTWORT_UNGUELTIG", exception.getMessage());
        }
        partieRepository.saveAndFlush(tisch.partie());
        veroeffentlichePartieAktualisierung(tisch);
        return PartieStandAntwort.aus(tisch.partie(), verwalteterSpieler.id());
    }

    @Transactional
    public PartieStandAntwort spieleKarte(UUID tischId, SpielerEntity spieler, String karteId) {
        SpielerEntity verwalteterSpieler = ladeSpieler(spieler.id());
        TischEntity tisch = ladeAktivenTischMitSpieler(tischId, verwalteterSpieler);
        SpielEntity laufendesSpielEntity = ladeLaufendesSpiel(tisch.partie());
        SpielerPosition position = spielerPositionVon(tisch.partie(), verwalteterSpieler);
        Spiel laufendesSpiel = SpielPersistenzAdapter.zuDomainSpiel(laufendesSpielEntity);
        try {
            Spiel aktualisiertesSpiel = laufendesSpiel.spieleKarte(position, parseKarte(karteId));
            SpielPersistenzAdapter.uebernehmeDomainSpiel(laufendesSpielEntity, aktualisiertesSpiel);
            kiOrchestrierungService.automatisiereTisch(tisch);
        } catch (IllegalStateException | UngueltigerSpielzugException exception) {
            throw new SpielverwaltungKonfliktException("KARTE_UNGUELTIG", exception.getMessage());
        }
        partieRepository.saveAndFlush(tisch.partie());
        veroeffentlichePartieAktualisierung(tisch);
        return PartieStandAntwort.aus(tisch.partie(), verwalteterSpieler.id());
    }

    @Transactional
    public PartieStandAntwort sageAn(UUID tischId, SpielerEntity spieler, Ansage ansage) {
        if (ansage == null) {
            throw new IllegalArgumentException("Eine Ansage muss angegeben werden.");
        }
        SpielerEntity verwalteterSpieler = ladeSpieler(spieler.id());
        TischEntity tisch = ladeAktivenTischMitSpieler(tischId, verwalteterSpieler);
        SpielEntity laufendesSpielEntity = ladeLaufendesSpiel(tisch.partie());
        SpielerPosition position = spielerPositionVon(tisch.partie(), verwalteterSpieler);
        Spiel laufendesSpiel = SpielPersistenzAdapter.zuDomainSpiel(laufendesSpielEntity);
        try {
            Spiel aktualisiertesSpiel = laufendesSpiel.sageAn(position, ansage);
            SpielPersistenzAdapter.uebernehmeDomainSpiel(laufendesSpielEntity, aktualisiertesSpiel);
            kiOrchestrierungService.automatisiereTisch(tisch);
        } catch (IllegalStateException exception) {
            throw new SpielverwaltungKonfliktException("ANSAGE_UNGUELTIG", exception.getMessage());
        }
        partieRepository.saveAndFlush(tisch.partie());
        veroeffentlichePartieAktualisierung(tisch);
        return PartieStandAntwort.aus(tisch.partie(), verwalteterSpieler.id());
    }

    private PartieEntity ladePartieEntity(UUID partieId) {
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

    @Transactional(readOnly = true)
    public TischAntwort ladeTisch(UUID tischId) {
        return TischAntwort.aus(ladeTischEntity(tischId));
    }

    private void veroeffentlicheTischAktualisierung(
        TischlisteEreignisAntwort tischlisteEreignis,
        TischEreignisAntwort tischEreignis
    ) {
        tischEchtzeitService.planeTischliste(tischlisteEreignis);
        tischEchtzeitService.planeTischEreignis(tischEreignis);
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

    private TischEntity ladeTischEntity(UUID tischId) {
        return tischRepository.findById(tischId)
            .orElseThrow(() -> new SpielverwaltungNichtGefundenException(
                "TISCH_NICHT_GEFUNDEN",
                "Es wurde kein Tisch mit der ID " + tischId + " gefunden."
            ));
    }

    /**
     * Laedt einen Tisch mit exklusiver Datenbanksperre (PESSIMISTIC_WRITE).
     * Muss fuer alle schreibenden Operationen verwendet werden, die zuerst den
     * Tischzustand pruefen (z.B. istVoll, Status WARTEND) und dann mutieren —
     * sonst koennen zwei gleichzeitige Requests beide die Pruefung bestehen und
     * den Tisch in einen inkonsistenten Zustand bringen.
     */
    private TischEntity ladeTischEntityMitSperre(UUID tischId) {
        return tischRepository.findByIdWithLock(tischId)
            .orElseThrow(() -> new SpielverwaltungNichtGefundenException(
                "TISCH_NICHT_GEFUNDEN",
                "Es wurde kein Tisch mit der ID " + tischId + " gefunden."
            ));
    }

    private SpielerEntity ladeSpieler(UUID spielerId) {
        return spielerRepository.findById(spielerId)
            .orElseThrow(() -> new SpielverwaltungNichtGefundenException(
                "SPIELER_NICHT_GEFUNDEN",
                "Es wurde kein Spieler mit der ID " + spielerId + " gefunden."
            ));
    }

    private void pruefeDassSpielerAnKeinemTischSitzt(SpielerEntity spieler) {
        tischRepository.findBySpieler_Id(spieler.id()).ifPresent(tisch -> {
            throw new SpielverwaltungKonfliktException(
                "SPIELER_BEREITS_AN_TISCH",
                "Ein Spieler darf gleichzeitig nur an einem Tisch sitzen."
            );
        });
    }

    private void pruefeWartendenTisch(TischEntity tisch, String fehlerCode, String nachricht) {
        if (tisch.status() != TischStatus.WARTEND) {
            throw new SpielverwaltungKonfliktException(fehlerCode, nachricht);
        }
    }

    private TischEntity ladeAktivenTischMitSpieler(UUID tischId, SpielerEntity spieler) {
        TischEntity tisch = ladeTischEntity(tischId);
        if (!tisch.enthaeltSpieler(spieler)) {
            throw new SpielverwaltungKonfliktException("SPIELER_NICHT_AM_TISCH", "Der Spieler sitzt nicht an diesem Tisch.");
        }
        if (tisch.status() != TischStatus.IM_SPIEL || tisch.partie() == null) {
            throw new SpielverwaltungKonfliktException("PARTIE_NICHT_AKTIV", "An diesem Tisch laeuft aktuell keine Partie.");
        }
        return tisch;
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

    private SpielEntity erzeugeErstesSpiel(TischEntity tisch) {
        Kartendeck kartendeck = Kartendeck.neu(tisch.konfiguration().alsSpielregeln()).gemischt();
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, tisch.konfiguration().alsSpielregeln(), kartendeck).teileKartenAus();
        SpielEntity spielEntity = SpielEntity.neu(1, spiel.geber(), spiel.spieltyp(), spiel.phase());
        for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
            spielEntity.fuegeHandHinzu(HandEntity.neu(position, spiel.handVon(position).karten()));
        }
        return spielEntity;
    }
}
